#!/usr/bin/env python3
"""
FieldOps — Automação de Pull Request no GitHub via GitHub CLI (gh).
Idempotente: cria novo PR ou atualiza PR existente para a branch de trabalho.
"""
from __future__ import annotations

import os
import sys
import re
import json
import shutil
import argparse
import subprocess
from pathlib import Path

# Configuração de encoding UTF-8 no console Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def run_cmd(cmd: list[str], cwd: str | None = None, check: bool = True) -> tuple[int, str, str]:
    """Executa comando de subprocesso capturando stdout, stderr e código de retorno."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if check and result.returncode != 0:
            raise subprocess.CalledProcessError(
                result.returncode, cmd, output=result.stdout, stderr=result.stderr
            )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.CalledProcessError:
        raise
    except Exception as e:
        return 1, "", str(e)


def run_git(cmd: list[str], cwd: str | None = None) -> str:
    """Executa comando git retornando a saída limpa."""
    _, stdout, _ = run_cmd(["git"] + cmd, cwd=cwd, check=True)
    return stdout


def get_git_root() -> Path:
    """Identifica a raiz do repositório Git."""
    try:
        root_str = run_git(["rev-parse", "--show-toplevel"])
        if root_str:
            return Path(root_str)
    except Exception:
        pass
    return Path.cwd()


def verify_gh_cli() -> None:
    """Verifica se o GitHub CLI (gh) está instalado e autenticado."""
    if not shutil.which("gh"):
        print("❌ Erro: O GitHub CLI ('gh') não foi encontrado no PATH do sistema.", file=sys.stderr)
        print("💡 Instale o GitHub CLI através do site oficial: https://cli.github.com/ ou via 'winget install GitHub.cli'", file=sys.stderr)
        sys.exit(1)

    code, stdout, stderr = run_cmd(["gh", "auth", "status"], check=False)
    if code != 0:
        print("❌ Erro: O GitHub CLI ('gh') não está autenticado.", file=sys.stderr)
        if stderr:
            print(f"Detalhes: {stderr}", file=sys.stderr)
        print("💡 Execute 'gh auth login' no seu terminal para conectar sua conta GitHub.", file=sys.stderr)
        sys.exit(1)


def get_repo_info() -> tuple[str, str, str]:
    """
    Retorna (owner, repo_name, repo_url) do repositório GitHub atual.
    Utiliza preferencialmente o gh repo view, com fallback para git remote.
    """
    code, stdout, _ = run_cmd(["gh", "repo", "view", "--json", "owner,name,url"], check=False)
    if code == 0 and stdout:
        try:
            data = json.loads(stdout)
            owner = data.get("owner", {}).get("login", "")
            name = data.get("name", "")
            url = data.get("url", f"https://github.com/{owner}/{name}")
            if owner and name:
                return owner, name, url
        except Exception:
            pass

    # Fallback via git remote
    try:
        remote_url = run_git(["config", "--get", "remote.origin.url"])
        match = re.search(r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?$", remote_url)
        if match:
            owner = match.group("owner")
            repo = match.group("repo")
            return owner, repo, f"https://github.com/{owner}/{repo}"
    except Exception:
        pass

    return "", "", ""


def is_protected_branch(branch: str) -> bool:
    """Verifica se a branch atual é uma branch protegida que não deve originar PR direto."""
    return branch in ["main", "master", "develop"] or branch.startswith("release/")


def check_base_branch_alignment(
    current_branch: str,
    dest_branch: str,
    abort_on_conflict: bool = False,
    skip_fetch: bool = False,
) -> None:
    """
    Valida se a branch local está desatualizada em relação à branch remota de destino (origin/{dest_branch}),
    alertando caso haja risco iminente de conflitos de merge antes do push.
    """
    remote_ref = f"origin/{dest_branch}"
    print(f"🔍 Verificando alinhamento com a branch remota de destino '{remote_ref}'...")

    # 1. Atualizar referências da branch de destino no remote (se skip_fetch for False)
    if not skip_fetch:
        try:
            run_cmd(["git", "fetch", "origin", dest_branch, "--quiet"])
        except subprocess.CalledProcessError as e:
            err_msg = e.stderr.strip() if e.stderr else str(e)
            print(f"⚠️ Aviso: Não foi possível atualizar '{remote_ref}' via git fetch ({err_msg}). Usando referências locais.", file=sys.stderr)
    else:
        print(f"⚡ Modo rápido ativado (--skip-fetch): utilizando referências de '{remote_ref}' previamente sincronizadas.")

    # 2. Verificar se a ref remota existe
    code, _, _ = run_cmd(["git", "rev-parse", "--verify", remote_ref], check=False)
    if code != 0:
        print(f"ℹ️ Referência '{remote_ref}' não encontrada no repositório. Ignorando validação de alinhamento.")
        return

    # 3. Contar commits à frente e atrás
    try:
        commits_behind = int(run_git(["rev-list", "--count", f"HEAD..{remote_ref}"]))
        commits_ahead = int(run_git(["rev-list", "--count", f"{remote_ref}..HEAD"]))
    except Exception as e:
        print(f"⚠️ Erro ao calcular divergência de commits com '{remote_ref}': {e}", file=sys.stderr)
        return

    if commits_behind == 0:
        print(f"✅ Branch local perfeitamente alinhada com '{remote_ref}' ({commits_ahead} commit(s) à frente, 0 atrás).")
        return

    # 4. Caso desatualizada (behind > 0), avalia se há risco de conflito de merge
    print(f"⚠️ AVISO: A branch local está desatualizada em relação a '{remote_ref}'!")
    print(f"   Status de divergência: {commits_ahead} commit(s) à frente, {commits_behind} commit(s) atrás.")

    conflicts: list[str] = []
    has_conflict = False
    try:
        # git merge-tree --write-tree HEAD origin/<dest_branch> simula o merge no banco do git sem tocar o working tree
        code_m, stdout_m, stderr_m = run_cmd(["git", "merge-tree", "--write-tree", "HEAD", remote_ref], check=False)
        if code_m != 0 or "CONFLICT" in stdout_m or "CONFLICT" in stderr_m:
            has_conflict = True
            combined_output = f"{stdout_m}\n{stderr_m}"
            for line in combined_output.splitlines():
                m = re.search(r"CONFLICT.*in\s+(.+)$", line)
                if m:
                    conflicts.append(m.group(1).strip())
                elif "Auto-merging" in line and "CONFLICT" in line:
                    conflicts.append(line.strip())
            conflicts = list(dict.fromkeys(conflicts))
    except Exception as e:
        print(f"⚠️ Não foi possível verificar conflitos de merge via merge-tree ({e}).", file=sys.stderr)

    if has_conflict:
        print("\n" + "=" * 76, file=sys.stderr)
        print(f"⚠️  ALERTA CRÍTICO: RISCO DE CONFLITOS DE MERGE IMINENTES COM '{remote_ref}'!", file=sys.stderr)
        print("=" * 76, file=sys.stderr)
        print(f"A sua branch local está {commits_behind} commit(s) atrás de '{remote_ref}' e a mesclagem", file=sys.stderr)
        print("resultará em conflitos de merge se integrada neste momento!", file=sys.stderr)
        if conflicts:
            print("\nArquivos com risco de conflito detectados:", file=sys.stderr)
            for cf in conflicts[:10]:
                print(f"  • {cf}", file=sys.stderr)
            if len(conflicts) > 10:
                print(f"  • ... e mais {len(conflicts) - 10} arquivo(s)", file=sys.stderr)

        print("\nAções recomendadas antes de publicar o PR:", file=sys.stderr)
        print(f"  1. git fetch origin {dest_branch}", file=sys.stderr)
        print(f"  2. git merge origin/{dest_branch}  (ou git rebase origin/{dest_branch})", file=sys.stderr)
        print("  3. Resolver os conflitos manualmente e reexecutar os testes de validação.", file=sys.stderr)
        print("=" * 76 + "\n", file=sys.stderr)

        if abort_on_conflict:
            print("❌ Operação abortada devido a risco de conflitos de merge (--abort-on-conflict informado).", file=sys.stderr)
            sys.exit(1)
        else:
            print("⚠️ Prosseguindo com o envio por padrão, mas esteja ciente de que o PR poderá apresentar conflitos no GitHub.\n", file=sys.stderr)
    else:
        print(f"ℹ️ A branch local está {commits_behind} commit(s) atrás de '{remote_ref}', porém a mesclagem automática ocorreria sem conflitos (clean merge).")
        print(f"💡 Recomendação: Considere sincronizar sua branch via 'git merge origin/{dest_branch}' para mantê-la atualizada.\n")


def parse_reviewers_arg(raw_list: list[str] | None) -> list[str]:
    """Normaliza argumentos de revisores, aceitando vírgulas ou múltiplos argumentos."""
    if not raw_list:
        return []
    result = []
    for item in raw_list:
        for part in item.split(","):
            part = part.strip().lstrip("@")
            if part:
                result.append(part)
    return list(dict.fromkeys(result))


def find_existing_pull_request(current_branch: str) -> dict | None:
    """
    Verifica se já existe um Pull Request aberto no GitHub para a branch de trabalho.
    Garante idempotência do fluxo.
    """
    cmd = [
        "gh", "pr", "list",
        "--head", current_branch,
        "--state", "open",
        "--json", "number,title,url,baseRefName,headRefName",
    ]
    code, stdout, stderr = run_cmd(cmd, check=False)
    if code == 0 and stdout:
        try:
            prs = json.loads(stdout)
            if prs and isinstance(prs, list) and len(prs) > 0:
                return prs[0]
        except Exception:
            pass
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Publica ou atualiza (idempotente) Pull Request no GitHub via gh CLI."
    )
    parser.add_argument("--title", required=True, help="Título do PR")
    parser.add_argument("--description-file", default=None, help="Caminho do arquivo com a descrição em Markdown (ou '-' para stdin)")
    parser.add_argument("--description", default=None, help="Texto da descrição em Markdown diretamente")
    parser.add_argument("--destination", "--base", default=None, dest="destination", help="Branch de destino (default: develop ou main)")
    parser.add_argument("--reviewers", nargs="*", default=None, help="Lista de usernames dos revisores no GitHub (separados por espaço ou vírgula)")
    parser.add_argument("--draft", action="store_true", help="Cria o Pull Request como rascunho (Draft PR)")
    parser.add_argument("--abort-on-conflict", action="store_true", help="Interrompe o processo se forem detectados riscos de conflitos de merge iminentes com a branch base")
    parser.add_argument("--skip-fetch", action="store_true", help="Pula a sincronização via git fetch caso as referências da base já tenham sido atualizadas na etapa de inspeção da skill")
    args = parser.parse_args()

    # 1. Validar instalação e login do GitHub CLI
    verify_gh_cli()

    # 2. Identificar branch atual e validar proteções
    current_branch = run_git(["branch", "--show-current"])
    if not current_branch:
        print("❌ Erro: Não foi possível identificar a branch atual do Git (HEAD destacado?).", file=sys.stderr)
        sys.exit(1)

    if is_protected_branch(current_branch):
        print(f"❌ Erro: A branch atual '{current_branch}' é uma branch protegida. Crie uma branch de feature/fix antes de abrir o PR.", file=sys.stderr)
        sys.exit(1)

    # 3. Identificar informações do repositório
    owner, repo, repo_url = get_repo_info()
    if owner and repo:
        print(f"📦 Repositório GitHub: {owner}/{repo} ({repo_url})")

    # 4. Definir branch de destino padrão
    dest_branch = args.destination
    if not dest_branch:
        remote_branches = [b.strip() for b in run_git(["branch", "-r"]).splitlines()]
        dest_branch = "develop" if "origin/develop" in remote_branches else "main"

    print(f"🌿 Branch de trabalho: '{current_branch}' ➔ Branch de destino: '{dest_branch}'")

    # 5. Validação de alinhamento com a branch base remota (antes do push)
    check_base_branch_alignment(current_branch, dest_branch, abort_on_conflict=args.abort_on_conflict, skip_fetch=args.skip_fetch)

    # 6. Push da branch atual via Git local
    print(f"🚀 Sincronizando branch '{current_branch}' com origin no GitHub...")
    try:
        run_cmd(["git", "push", "-u", "origin", current_branch], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Falha ao realizar git push da branch '{current_branch}': {e.stderr or e}", file=sys.stderr)
        sys.exit(1)

    # 7. Obter descrição do PR
    temp_desc_path = None
    if args.description:
        temp_desc_path = Path(get_git_root()) / ".pr_temp_description.md"
        temp_desc_path.write_text(args.description, encoding="utf-8")
        desc_file_to_use = str(temp_desc_path)
    elif args.description_file:
        if args.description_file == "-":
            content = sys.stdin.read()
            temp_desc_path = Path(get_git_root()) / ".pr_temp_description.md"
            temp_desc_path.write_text(content, encoding="utf-8")
            desc_file_to_use = str(temp_desc_path)
        else:
            if not os.path.exists(args.description_file):
                print(f"❌ Erro: Arquivo de descrição '{args.description_file}' não encontrado.", file=sys.stderr)
                sys.exit(1)
            desc_file_to_use = args.description_file
    else:
        print("❌ Erro: Informe --description-file ou --description com o conteúdo do PR.", file=sys.stderr)
        sys.exit(1)

    reviewers_list = parse_reviewers_arg(args.reviewers)

    try:
        # 8. Idempotência: verificar se já existe Pull Request aberto para a branch
        print(f"🔍 Verificando se já existe Pull Request aberto para '{current_branch}'...")
        existing_pr = find_existing_pull_request(current_branch)

        if existing_pr:
            pr_number = existing_pr.get("number")
            pr_url = existing_pr.get("url")
            existing_title = existing_pr.get("title", "")
            print(f"🔄 Pull Request existente encontrado (#{pr_number}): '{existing_title}'")
            print("🔄 Atualizando título e descrição no GitHub (idempotência)...")

            edit_cmd = [
                "gh", "pr", "edit", str(pr_number),
                "--title", args.title,
                "--body-file", desc_file_to_use,
                "--base", dest_branch,
            ]
            if reviewers_list:
                for rev in reviewers_list:
                    edit_cmd.extend(["--add-reviewer", rev])

            run_cmd(edit_cmd, check=True)
            print(f"✅ Pull Request #{pr_number} atualizado com sucesso no GitHub!")
            print(f"🔗 URL: {pr_url}")
            return

        # 9. Criar novo PR caso não exista
        print(f"📝 Nenhum PR aberto encontrado para '{current_branch}'. Criando novo Pull Request no GitHub...")
        create_cmd = [
            "gh", "pr", "create",
            "--title", args.title,
            "--body-file", desc_file_to_use,
            "--base", dest_branch,
            "--head", current_branch,
        ]
        if args.draft:
            create_cmd.append("--draft")
        if reviewers_list:
            create_cmd.extend(["--reviewer", ",".join(reviewers_list)])

        code, stdout, stderr = run_cmd(create_cmd, check=False)
        if code != 0:
            # Fallback caso falhe por PR concorrente recém-criado
            if "already exists" in stderr.lower() or "pull request already exists" in stdout.lower():
                print("⚠️ Detectado PR recém-criado. Buscando informações para atualização...", file=sys.stderr)
                fb_pr = find_existing_pull_request(current_branch)
                if fb_pr:
                    fb_number = fb_pr.get("number")
                    fb_url = fb_pr.get("url")
                    run_cmd(["gh", "pr", "edit", str(fb_number), "--title", args.title, "--body-file", desc_file_to_use], check=True)
                    print(f"✅ Pull Request #{fb_number} atualizado com sucesso no GitHub!")
                    print(f"🔗 URL: {fb_url}")
                    return
            print(f"❌ Falha ao criar Pull Request no GitHub: {stderr or stdout}", file=sys.stderr)
            sys.exit(1)

        pr_url = stdout.strip().splitlines()[-1] if stdout else f"https://github.com/{owner}/{repo}/pulls"
        print("✅ Pull Request criado com sucesso no GitHub!")
        print(f"🔗 URL: {pr_url}")

    finally:
        # Limpar arquivo temporário de descrição se foi gerado
        if temp_desc_path and temp_desc_path.exists():
            try:
                temp_desc_path.unlink()
            except Exception:
                pass


if __name__ == "__main__":
    main()
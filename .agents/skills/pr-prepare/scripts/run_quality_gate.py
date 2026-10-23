#!/usr/bin/env python3
"""
FieldOps — Quality Gate Pré-PR
Executa a validação de conformidade técnica, tipos (TypeScript), testes automatizados,
auditoria de segredos e rastreabilidade SDD de acordo com a documentação do projeto (docs/ e Definition of Done).
"""
from __future__ import annotations

import os
import sys
import re
import json
import time
import shutil
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

# Configuração de encoding UTF-8 no console Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def run_cmd(cmd: list[str], cwd: str | None = None, check: bool = False) -> tuple[int, str, str]:
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
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return 1, "", str(e)


def get_git_root() -> Path:
    """Identifica a raiz do repositório Git."""
    code, stdout, _ = run_cmd(["git", "rev-parse", "--show-toplevel"])
    if code == 0 and stdout:
        return Path(stdout)
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / ".git").exists():
            return parent
    return Path.cwd()


def get_branch_info(git_root: Path) -> tuple[str, str]:
    """Identifica a branch atual e a branch de destino sugerida."""
    code, current, _ = run_cmd(["git", "branch", "--show-current"], cwd=str(git_root))
    current_branch = current if code == 0 else ""

    code_r, remotes, _ = run_cmd(["git", "branch", "-r"], cwd=str(git_root))
    dest_branch = "develop" if "origin/develop" in remotes else "main"

    return current_branch, dest_branch


# ==============================================================================
# 1. Verificação Estática de Tipos (TypeScript / Mobile & Web)
# ==============================================================================
def run_typecheck_suite(git_root: Path, strict: bool = False) -> dict:
    """
    Executa a verificação estática de tipos via TypeScript (tsc --noEmit) no projeto mobile
    e outros módulos TypeScript presentes no repositório.
    """
    mobile_dir = git_root / "mobile"
    if not mobile_dir.exists() or not (mobile_dir / "tsconfig.json").exists():
        return {
            "name": "Verificação Estática de Tipos (TypeScript)",
            "status": "SKIPPED",
            "message": "Nenhum módulo TypeScript com tsconfig.json encontrado.",
            "details": "",
            "passed": True,
        }

    node_modules = mobile_dir / "node_modules"
    if not node_modules.exists():
        msg = "Dependências de 'mobile/' não estão instaladas (execute 'npm install' no diretório mobile/)."
        if strict:
            return {
                "name": "Verificação Estática de Tipos (TypeScript)",
                "status": "REPROVADO",
                "message": f"Modo estrito ativado: {msg}",
                "details": msg,
                "passed": False,
            }
        return {
            "name": "Verificação Estática de Tipos (TypeScript)",
            "status": "SKIPPED",
            "message": f"Ignorado: {msg}",
            "details": msg,
            "passed": True,
        }

    # Executa tsc no diretório mobile
    npx_cmd = shutil.which("npx.cmd") if sys.platform == "win32" else shutil.which("npx")
    if not npx_cmd:
        npx_cmd = "npx"

    code, stdout, stderr = run_cmd([npx_cmd, "tsc", "--noEmit"], cwd=str(mobile_dir))
    passed = (code == 0)

    combined_out = stdout if stdout else stderr
    error_count = len(re.findall(r"error TS\d+:", combined_out))

    if passed:
        message = "0 erros de tipagem encontrados. Verificação estática aprovada."
    else:
        message = f"{error_count} erro(s) de tipagem TypeScript detectado(s)."

    return {
        "name": "Verificação Estática de Tipos (TypeScript)",
        "status": "APROVADO" if passed else "REPROVADO",
        "exit_code": code,
        "message": message,
        "details": combined_out,
        "passed": passed,
    }


# ==============================================================================
# 2. Suíte de Testes Automatizados (Mobile / Backend / Web)
# ==============================================================================
def run_automated_tests_suite(git_root: Path, strict: bool = False) -> dict:
    """
    Executa a suíte de testes automatizados conforme configurado nos módulos do projeto
    (ex: npm test em mobile/ ou pytest/dotnet em backend/ se existirem).
    """
    mobile_dir = git_root / "mobile"
    package_json_path = mobile_dir / "package.json"

    has_test_script = False
    if package_json_path.exists():
        try:
            with open(package_json_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
                scripts = pkg.get("scripts", {})
                test_script = scripts.get("test", "")
                if test_script and "no test specified" not in test_script:
                    has_test_script = True
        except Exception:
            pass

    if has_test_script:
        npm_cmd = shutil.which("npm.cmd") if sys.platform == "win32" else shutil.which("npm")
        if not npm_cmd:
            npm_cmd = "npm"
        code, stdout, stderr = run_cmd([npm_cmd, "test", "--", "--watchAll=false"], cwd=str(mobile_dir))
        passed = (code == 0)
        return {
            "name": "Suíte de Testes Automatizados (Mobile)",
            "status": "APROVADO" if passed else "REPROVADO",
            "exit_code": code,
            "message": "Testes automatizados executados com sucesso" if passed else "Falhas na execução dos testes automatizados",
            "details": stdout if stdout else stderr,
            "passed": passed,
        }

    # Verifica backend/api se houver pytest ou dotnet test
    backend_dir = git_root / "backend"
    if backend_dir.exists():
        # Verifica se há pytest
        if (backend_dir / "pytest.ini").exists() or (backend_dir / "tests").exists():
            py_exe = sys.executable or "python"
            code, stdout, stderr = run_cmd([py_exe, "-m", "pytest", "-q"], cwd=str(backend_dir))
            passed = (code == 0)
            return {
                "name": "Suíte de Testes Automatizados (Backend)",
                "status": "APROVADO" if passed else "REPROVADO",
                "exit_code": code,
                "message": "Testes de backend executados com sucesso" if passed else "Falhas nos testes de backend",
                "details": stdout if stdout else stderr,
                "passed": passed,
            }

    msg = "Nenhum script de testes automatizados configurado atualmente no repositório."
    if strict:
        return {
            "name": "Suíte de Testes Automatizados",
            "status": "REPROVADO",
            "message": f"Modo estrito: {msg}",
            "details": msg,
            "passed": False,
        }

    return {
        "name": "Suíte de Testes Automatizados",
        "status": "SKIPPED",
        "message": msg,
        "details": "",
        "passed": True,
    }


# ==============================================================================
# 3. Auditoria de Segredos, Credenciais e Logs Sensíveis (DoD 18.1 & 18.4)
# ==============================================================================
def run_secret_audit_suite(git_root: Path, dest_branch: str) -> dict:
    """
    Audita o repositório e os commits da branch de trabalho em busca de credenciais,
    chaves de API expostas, tokens de acesso ou arquivos .env sensíveis comutados.
    """
    # 1. Obter lista de arquivos alterados em relação à base ou staged
    code, stdout, _ = run_cmd(["git", "diff", "--name-only", f"origin/{dest_branch}..HEAD"], cwd=str(git_root))
    changed_files = stdout.splitlines() if code == 0 and stdout else []

    # Adicionar também unstaged/staged
    code_s, stdout_s, _ = run_cmd(["git", "diff", "--name-only", "HEAD"], cwd=str(git_root))
    if code_s == 0 and stdout_s:
        changed_files.extend(stdout_s.splitlines())

    changed_files = list(dict.fromkeys([f.strip() for f in changed_files if f.strip()]))

    patterns = [
        ("Private Key", re.compile(r"-----BEGIN (?:RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----")),
        ("GitHub Personal Access Token", re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}")),
        ("AWS Access Key ID", re.compile(r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}")),
        ("Google Cloud API Key", re.compile(r"AIza[0-9A-Za-z\\-_]{35}")),
        ("Atlassian Access Token", re.compile(r"ATBB[a-zA-Z0-9\-_]{24,}")),
        ("Generic Secret/Password hardcoded", re.compile(r"(?:api_key|secret_key|auth_token|client_secret)\s*[:=]\s*['\"][A-Za-z0-9\-_+=/]{16,}['\"]", re.IGNORECASE)),
    ]

    findings: list[dict] = []

    # Verifica se algum arquivo .env não-exemplo foi commitado
    for f_path in changed_files:
        norm_path = f_path.replace("\\", "/")
        p = git_root / f_path
        if not p.is_file():
            continue

        base_name = p.name.lower()
        if (base_name == ".env" or base_name.endswith(".env")) and not base_name.endswith((".example", ".sample")):
            findings.append({
                "file": norm_path,
                "line": 1,
                "type": "Arquivo de ambiente com segredos (.env commitado)",
                "preview": f"Arquivo {p.name} potencialmente sensível comitado",
            })
            continue

        # Ignorar binários ou arquivos pesados
        if p.suffix.lower() in [".png", ".jpg", ".jpeg", ".ico", ".pdf", ".lock", ".jsonl"]:
            continue

        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
            for line_idx, line in enumerate(content.splitlines(), start=1):
                # Ignorar comentários ou exemplos
                if "placeholder" in line.lower() or "example" in line.lower() or "your_" in line.lower():
                    continue
                for label, pat in patterns:
                    if pat.search(line):
                        findings.append({
                            "file": norm_path,
                            "line": line_idx,
                            "type": label,
                            "preview": line.strip()[:60] + "...",
                        })
        except Exception:
            pass

    passed = (len(findings) == 0)
    message = "Nenhum segredo ou credencial detectado nas alterações." if passed else f"ALERTA: {len(findings)} possível(is) credencial(is) ou segredo(s) detectado(s)!"

    return {
        "name": "Auditoria de Segurança & Segredos (DoD 18.1)",
        "status": "APROVADO" if passed else "REPROVADO",
        "message": message,
        "findings": findings,
        "passed": passed,
    }


# ==============================================================================
# 4. Integridade da Configuração do Mobile (Expo app.json)
# ==============================================================================
def run_mobile_config_suite(git_root: Path) -> dict:
    """Valida sintaxe e preenchimento dos metadados essenciais no app.json do Expo."""
    app_json_path = git_root / "mobile" / "app.json"
    if not app_json_path.exists():
        return {
            "name": "Configuração do Mobile (Expo app.json)",
            "status": "SKIPPED",
            "message": "mobile/app.json não encontrado.",
            "details": "",
            "passed": True,
        }

    try:
        data = json.loads(app_json_path.read_text(encoding="utf-8"))
        expo_cfg = data.get("expo", {})
        name = expo_cfg.get("name")
        slug = expo_cfg.get("slug")
        version = expo_cfg.get("version")

        missing = []
        if not name:
            missing.append("expo.name")
        if not slug:
            missing.append("expo.slug")
        if not version:
            missing.append("expo.version")

        if missing:
            return {
                "name": "Configuração do Mobile (Expo app.json)",
                "status": "REPROVADO",
                "message": f"Campos obrigatórios ausentes no app.json: {', '.join(missing)}",
                "details": str(missing),
                "passed": False,
            }

        return {
            "name": "Configuração do Mobile (Expo app.json)",
            "status": "APROVADO",
            "message": f"app.json íntegro: App '{name}' (slug: '{slug}', v{version}).",
            "details": "",
            "passed": True,
        }
    except Exception as e:
        return {
            "name": "Configuração do Mobile (Expo app.json)",
            "status": "REPROVADO",
            "message": f"Erro de sintaxe JSON em mobile/app.json: {e}",
            "details": str(e),
            "passed": False,
        }


# ==============================================================================
# 5. Rastreabilidade SDD & Governança (base-conhecimento/governance)
# ==============================================================================
def run_sdd_traceability_suite(git_root: Path, current_branch: str) -> dict:
    """
    Verifica se a branch ou commits estão vinculados a uma Tarefa (TASK-XXX)
    registrada na governança do projeto (base-conhecimento/governance/tasks/).
    """
    task_match = re.search(r"TASK-(\d+)", current_branch, re.IGNORECASE)
    task_id = f"TASK-{task_match.group(1).zfill(3)}" if task_match else None

    # Se não está no nome da branch, checa os commits
    if not task_id:
        code, log_out, _ = run_cmd(["git", "log", "-n", "5", "--oneline"], cwd=str(git_root))
        if code == 0 and log_out:
            c_match = re.search(r"TASK-(\d+)", log_out, re.IGNORECASE)
            if c_match:
                task_id = f"TASK-{c_match.group(1).zfill(3)}"

    if not task_id:
        return {
            "name": "Rastreabilidade e Governança SDD",
            "status": "INFO",
            "message": "Nenhum identificador TASK-XXX detectado na branch. (Classificado como tarefa geral/docs/manutenção).",
            "task_id": None,
            "task_file": None,
            "passed": True,
        }

    # Busca o arquivo da tarefa em tasks/
    tasks_root = git_root / "base-conhecimento" / "governance" / "tasks"
    candidates = list(tasks_root.glob(f"**/*{task_id}*.md")) if tasks_root.exists() else []

    if candidates:
        rel_path = candidates[0].relative_to(git_root)
        status_folder = candidates[0].parent.name
        return {
            "name": "Rastreabilidade e Governança SDD",
            "status": "APROVADO",
            "message": f"Tarefa vinculada: {task_id} ({rel_path.as_posix()} - status: '{status_folder}')",
            "task_id": task_id,
            "task_file": str(rel_path.as_posix()),
            "passed": True,
        }
    else:
        return {
            "name": "Rastreabilidade e Governança SDD",
            "status": "AVISO",
            "message": f"Identificador {task_id} referenciado, mas arquivo correspondente não encontrado em base-conhecimento/governance/tasks/.",
            "task_id": task_id,
            "task_file": None,
            "passed": True,
        }


# ==============================================================================
# 6. Verificação de Evidências Extras
# ==============================================================================
def verify_evidence_files(git_root: Path, required_files: list[str]) -> dict:
    """Verifica existência e preenchimento de arquivos de evidência adicionais."""
    if not required_files:
        return {
            "name": "Verificação de Evidências",
            "status": "SKIPPED",
            "message": "Nenhuma evidência extra exigida.",
            "items": [],
            "passed": True,
        }

    items = []
    all_passed = True
    for rel_path in required_files:
        p = git_root / rel_path
        exists = p.exists()
        size = p.stat().st_size if exists else 0
        valid = exists and size > 0
        if not valid:
            all_passed = False
        items.append({
            "path": rel_path,
            "exists": exists,
            "size": size,
            "passed": valid,
            "status": "VÁLIDO" if valid else ("ARQUIVO VAZIO" if exists else "NÃO ENCONTRADO"),
        })

    return {
        "name": "Verificação de Evidências",
        "status": "APROVADO" if all_passed else "REPROVADO",
        "message": f"{sum(1 for i in items if i['passed'])}/{len(items)} arquivos de evidência válidos.",
        "items": items,
        "passed": all_passed,
    }


# ==============================================================================
# Geração do Resumo em Markdown
# ==============================================================================
def generate_markdown_summary(
    typecheck_res: dict,
    tests_res: dict,
    secrets_res: dict,
    mobile_cfg_res: dict,
    sdd_res: dict,
    evidence_res: dict,
) -> str:
    """Gera um bloco de resumo formatado em Markdown para inserção direta no Pull Request."""
    overall_ok = (
        typecheck_res["passed"]
        and tests_res["passed"]
        and secrets_res["passed"]
        and mobile_cfg_res["passed"]
        and evidence_res["passed"]
    )
    overall_badge = "✅ APROVADO" if overall_ok else "❌ REPROVADO"

    def badge(res: dict) -> str:
        st = res.get("status")
        if st == "APROVADO":
            return "✅ Aprovado"
        elif st == "SKIPPED":
            return "⏭️ Ignorado"
        elif st in ("INFO", "AVISO"):
            return "ℹ️ Info"
        return "❌ Reprovado"

    lines = []
    lines.append("### 🛡️ Quality Gate & Validações Técnicas (FieldOps QA)")
    lines.append(f"- **Status Geral:** `{overall_badge}`")
    lines.append(f"- **Data de Execução:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("| Validador | Status | Detalhes |")
    lines.append("| :--- | :---: | :--- |")
    lines.append(f"| **TypeScript Typecheck** | {badge(typecheck_res)} | {typecheck_res['message']} |")
    lines.append(f"| **Testes Automatizados** | {badge(tests_res)} | {tests_res['message']} |")
    lines.append(f"| **Auditoria de Segredos (DoD)** | {badge(secrets_res)} | {secrets_res['message']} |")
    lines.append(f"| **Configuração Expo (app.json)** | {badge(mobile_cfg_res)} | {mobile_cfg_res['message']} |")
    lines.append(f"| **Rastreabilidade SDD** | {badge(sdd_res)} | {sdd_res['message']} |")

    if evidence_res.get("items"):
        lines.append(f"| **Evidências Adicionais** | {badge(evidence_res)} | {evidence_res['message']} |")

    if secrets_res.get("findings"):
        lines.append("\n> ⚠️ **Atenção:** Segredos detectados:")
        for fd in secrets_res["findings"]:
            lines.append(f"> - `{fd['file']}:{fd['line']}` ({fd['type']})")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Gate prévio de execução de testes e validação de qualidade antes da elaboração do PR no FieldOps."
    )
    parser.add_argument("--skip-typecheck", action="store_true", help="Ignora a validação de tipos TypeScript.")
    parser.add_argument("--skip-tests", action="store_true", help="Ignora a suíte de testes automatizados.")
    parser.add_argument("--skip-secrets", action="store_true", help="Ignora a auditoria de segredos e credenciais.")
    parser.add_argument("--strict", action="store_true", help="Modo estrito: falha caso dependências não estejam instaladas ou avisos ocorram.")
    parser.add_argument("--require-evidence", nargs="*", default=[], help="Arquivos de evidência adicionais obrigatórios.")
    parser.add_argument("--export-summary", default=None, help="Caminho para salvar o resumo em Markdown do Quality Gate.")
    parser.add_argument("--json", action="store_true", help="Exibe a saída final no formato JSON.")
    args = parser.parse_args()

    git_root = get_git_root()
    current_branch, dest_branch = get_branch_info(git_root)

    print("=================================================================")
    print("🛡️  ORQUESTRADOR DO QUALITY GATE PRÉ-PR (FieldOps)")
    print(f"📁 Raiz do Repositório: {git_root}")
    print(f"🌿 Branch: {current_branch} ➔ Base: {dest_branch}")
    print(f"🕒 Início: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=================================================================\n")

    # 1. Typecheck
    if not args.skip_typecheck:
        print("▶️ [1/5] Verificação Estática de Tipos (TypeScript)...")
        typecheck_res = run_typecheck_suite(git_root, strict=args.strict)
        print(f"    Status: [{typecheck_res['status']}] — {typecheck_res['message']}")
    else:
        print("⏭️ [1/5] Verificação de Tipos ignorada via flag.")
        typecheck_res = {"name": "Typecheck", "status": "SKIPPED", "message": "Ignorado via flag.", "passed": True}

    # 2. Testes automatizados
    if not args.skip_tests:
        print("\n▶️ [2/5] Suíte de Testes Automatizados...")
        tests_res = run_automated_tests_suite(git_root, strict=args.strict)
        print(f"    Status: [{tests_res['status']}] — {tests_res['message']}")
    else:
        print("\n⏭️ [2/5] Testes automatizados ignorados via flag.")
        tests_res = {"name": "Testes", "status": "SKIPPED", "message": "Ignorado via flag.", "passed": True}

    # 3. Auditoria de Segredos
    if not args.skip_secrets:
        print("\n▶️ [3/5] Auditoria de Segredos e Credenciais (DoD 18.1)...")
        secrets_res = run_secret_audit_suite(git_root, dest_branch)
        print(f"    Status: [{secrets_res['status']}] — {secrets_res['message']}")
    else:
        print("\n⏭️ [3/5] Auditoria de segredos ignorada via flag.")
        secrets_res = {"name": "Segredos", "status": "SKIPPED", "message": "Ignorado via flag.", "passed": True}

    # 4. Integridade da Configuração Expo
    print("\n▶️ [4/5] Integridade da Configuração Mobile (app.json)...")
    mobile_cfg_res = run_mobile_config_suite(git_root)
    print(f"    Status: [{mobile_cfg_res['status']}] — {mobile_cfg_res['message']}")

    # 5. Rastreabilidade SDD
    print("\n▶️ [5/5] Rastreabilidade e Governança SDD...")
    sdd_res = run_sdd_traceability_suite(git_root, current_branch)
    print(f"    Status: [{sdd_res['status']}] — {sdd_res['message']}")

    # Evidências adicionais
    evidence_res = verify_evidence_files(git_root, args.require_evidence)

    # Avaliação Final
    overall_passed = (
        typecheck_res["passed"]
        and tests_res["passed"]
        and secrets_res["passed"]
        and mobile_cfg_res["passed"]
        and evidence_res["passed"]
    )
    summary_md = generate_markdown_summary(
        typecheck_res, tests_res, secrets_res, mobile_cfg_res, sdd_res, evidence_res
    )

    if args.export_summary:
        out_path = Path(args.export_summary)
        if not out_path.is_absolute():
            out_path = git_root / out_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(summary_md, encoding="utf-8")
        print(f"\n📄 Resumo do Quality Gate exportado para: {out_path}")

    print("\n=================================================================")
    if overall_passed:
        print("🎉 STATUS FINAL DO QUALITY GATE: [APROVADO]")
        print("✅ O repositório está em conformidade técnica para submissão do Pull Request.")
    else:
        print("🚨 STATUS FINAL DO QUALITY GATE: [REPROVADO]")
        print("❌ Existem pendências ou violações críticas. Corrija-as antes de abrir o PR.")
    print("=================================================================")

    if args.json:
        result_payload = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "APROVADO" if overall_passed else "REPROVADO",
            "passed": overall_passed,
            "typecheck": typecheck_res,
            "tests": tests_res,
            "secrets": secrets_res,
            "mobile_config": mobile_cfg_res,
            "sdd_traceability": sdd_res,
            "evidence": evidence_res,
            "summary_markdown": summary_md,
        }
        print("\n" + json.dumps(result_payload, indent=2, ensure_ascii=False))

    sys.exit(0 if overall_passed else 1)


if __name__ == "__main__":
    main()

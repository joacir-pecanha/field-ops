---
name: pr-prepare
description: Analisa alterações da branch atual, executa quality gate de testes e conformidade do FieldOps, elabora título semântico e descrição técnica, e publica ou atualiza o Pull Request automaticamente no GitHub via gh CLI de forma idempotente.
triggers:
  - "/pr-prepare"
  - "pr prepare"
  - "criar pr"
  - "abrir pull request"
  - "atualizar pull request"
---
# PR Prepare — FieldOps

Você é responsável por inspecionar o trabalho da branch atual no projeto **FieldOps**, executar o Quality Gate de testes, tipagem e segurança (alinhado a `docs/` e ao `docs/definition-of-done.md`), sintetizar as mudanças em um Pull Request técnico e bem estruturado (seguindo `template.md` e o modelo SDD), e orquestrar a publicação ou atualização idempotente no **GitHub** via **GitHub CLI (`gh`)**.

---

## 1. Regras Operacionais e Restrições

- **NUNCA** execute a criação de um pull request a partir de branches protegidas (`main`, `master`, `develop`, `release/*`).
- **NUNCA** crie pull requests com títulos vazios ou descrições vagas.
- **NUNCA** crie pull requests sem antes executar e validar o Quality Gate prévio (`run_quality_gate.py`).
- **NUNCA** faça commit ou modifique arquivos de código do repositório automaticamente durante a execução desta skill.
- **NUNCA** ignore arquivos modificados não salvos. Se houver mudanças unstaged/staged pendentes, alerte o usuário antes de prosseguir; após a resposta do usuário, verifique se ainda existem mudanças pendentes.
- **SEMPRE** exiba uma prévia (preview) com Título e Descrição gerados, e solicite aprovação explícita de **Joacir Peçanha** antes de executar o push ou disparar a criação/edição no GitHub.
- **Autenticação e Conexão:** A automação utiliza nativamente o **GitHub CLI (`gh`)** autenticado no ambiente local (`gh auth status`) e o `git push` local com as credenciais do usuário. Nenhuma chave de API ou token deve ser configurada hardcoded ou solicitada manualmente.
- **Idempotência no GitHub:** O script `pr_prepare.py` verifica automaticamente se já existe um PR aberto para a branch de trabalho utilizando o `gh CLI`. Se existir, atualiza o título e a descrição via `gh pr edit` em vez de falhar. Se não existir, cria o novo PR via `gh pr create`.
- **Validação de Desalinhamento Pré-Push:** Antes de executar o push ou criar o PR, valide se a branch local está desatualizada em relação à branch remota de destino (`origin/develop` ou `origin/main`). Se houver commits atrás ou risco iminente de conflitos de merge (`git merge-tree`), alerte o desenvolvedor explicitamente detalhando os arquivos conflitantes.
- **Revisores Técnicos:** Permita a definição de revisores via argumento `--reviewers` no CLI, aceitando usernames do GitHub (ex: `--reviewers joacir-pecanha`).

---

## 2. Instruções Imperativas de Execução

Siga rigorosamente as etapas de execução sequencial abaixo:

### Etapa 1: Coleta de Contexto (Git) e Quality Gate

1. Identifique a branch de trabalho atual:
```bash
git branch --show-current
```
Se a branch de trabalho for: `main`, `master` ou `develop`, interrompa o fluxo e exiba mensagem de erro.

2. Verifique se existem mudanças unstaged/staged pendentes:
```bash
git status --porcelain
```
Se houver alterações pendentes, alerte o desenvolvedor antes de avançar.

3. Identifique a branch de destino padrão comparando com as remotas:
```bash
git branch -r
```
*(Default: `develop` caso `origin/develop` exista, caso contrário `main`).*

4. **Valide o alinhamento com a branch remota de destino:**
```bash
git fetch origin <branch_destino> --quiet
git rev-list --count HEAD..origin/<branch_destino>
git merge-tree --write-tree HEAD origin/<branch_destino>
```
Se a branch estiver desatualizada (commits atrás > 0) ou se `git merge-tree` reportar conflitos (`returncode != 0` ou `CONFLICT`), capture o número de commits e a relação de arquivos conflitantes para alertar o desenvolvedor.

5. Colete o histórico de commits exclusivos da branch:
```bash
git log origin/<branch_destino>..HEAD --oneline
```

6. Inspecione o diff e as estatísticas das alterações:
```bash
git diff --stat origin/<branch_destino>..HEAD
git diff origin/<branch_destino>..HEAD
```

7. **Execute o Quality Gate de testes, tipos e segurança:**
```bash
python .agents/skills/pr-prepare/scripts/run_quality_gate.py --export-summary .quality_gate_summary.md
```
Certifique-se de que o status retornado seja `[APROVADO]`. O script valida:
- Verificação estática de tipos TypeScript (`mobile/tsconfig.json`);
- Suíte de testes automatizados do projeto;
- Auditoria de segurança contra credenciais, segredos e arquivos `.env` expostos;
- Integridade da configuração Expo (`mobile/app.json`);
- Rastreabilidade com tarefas SDD (`base-conhecimento/governance/tasks/`).

Capture o conteúdo gerado em `.quality_gate_summary.md` para embutir na descrição do PR.

---

### Etapa 2: Formulação de Conteúdo Técnico

1. **Título do Pull Request:**
   - Siga estritamente a convenção **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
   - Mantenha o título com no máximo 72 caracteres.
   - Se o nome da branch ou histórico contiver um identificador de tarefa (ex: `TASK-002`), inclua o identificador no título (ex: `feat(mobile): TASK-002 implement outbox pattern engine`).

2. **Montagem da Descrição:**
   - Siga exatamente a estrutura definida em: `.agents/skills/pr-prepare/template.md`.
   - Preencha o bloco `## 🎯 Rastreabilidade e Governança (SDD)` indicando a Task e Spec de referência.
   - Descreva as alterações de forma concisa e técnica.
   - Incorpore o resumo do Quality Gate na seção `## 🛡️ Quality Gate & Validações Técnicas`.
   - Adicione instruções de teste local em `## 🧪 Como Testar e Validar`.
   - Preencha o checklist de Definition of Done (`docs/definition-of-done.md`).

---

### Etapa 3: Validação Humana (Tomada de Decisão)

1. Apresente ao desenvolvedor via chat:
   - A branch de origem e a branch de destino identificadas.
   - **Status de Alinhamento com a Base Remota:** Informar se a branch está alinhada (`0 commits atrás`), desatualizada (`N commits atrás`), e destacar se há risco de conflitos de merge iminentes com a lista de arquivos afetados.
   - **Revisores Propostos:** Listar revisores a incluir (se especificados pelo usuário ou contexto).
   - O **Título formatado** proposto.
   - A **Descrição completa formatada** com a tabela do Quality Gate.
2. Formule explicitamente a pergunta:
   > *"Deseja que eu faça o push da branch e publique este Pull Request no GitHub com o conteúdo acima? (Responda com 'sim' para prosseguir, ou solicite ajustes)"*
3. **Aguarde a resposta do usuário**, não avance para a Etapa 4 sem consentimento explícito.

---

### Etapa 4: Publicação Segura e Idempotente no GitHub

Após a aprovação expressa do usuário:

1. Salve a descrição em um arquivo temporário na raiz do projeto:
```bash
.pr_description.md
```

2. Execute o script de publicação CLI passando o título, arquivo gerado, flag `--skip-fetch` e opções complementares:
```bash
python .agents/skills/pr-prepare/scripts/pr_prepare.py --title "<TITULO_GERADO>" --description-file .pr_description.md --destination "<BRANCH_DESTINO>" --skip-fetch [--reviewers <USUARIOS_GITHUB> ...]
```
*(Nota: O script valida a autenticação com o `gh CLI`, confere o alinhamento com a base antes do push, realiza o push seguro via Git local e é **estritamente idempotente**: criará um novo PR no GitHub se não houver um aberto, ou atualizará o PR existente via `gh pr edit` mantendo a rastreabilidade sem quebrar o fluxo).*

3. Remova os arquivos temporários gerados:
```bash
rm -f .pr_description.md .quality_gate_summary.md
```

4. Capture a saída do script e responda ao desenvolvedor destacando a **URL do Pull Request retornado pelo GitHub** de forma clara e clicável.

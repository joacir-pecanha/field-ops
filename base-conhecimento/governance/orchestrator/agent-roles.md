# Matriz de Papéis de Agentes — FieldOps

Para viabilizar a orquestração segura e especializada de agentes de IA no FieldOps, cada agente atua sob um perfil delimitado com responsabilidades e restrições específicas:

---

## 1. Responsável Humano / Tech Lead (Joacir Peçanha)
- **Papel:** Autoridade Suprema de Arquitetura e Decisão de Produto.
- **Responsabilidades:**
  - Aprovação de especificações técnicas (`SPEC-XXX.md`).
  - Autorização de tarefas para execução (transição de `backlog` para `in-progress`).
  - Arbitragem de conflitos e decisões estruturais.
  - Validação final e fechamento de tarefas (`completed`).
- **Poderes Exclusivos:** Somente Joacir Peçanha pode aprovar quebras de contrato de API, alterações no schema do banco ou remoção de componentes fundamentais.

---

## 2. Planner Agent (Agente de Planejamento e Especificação)
- **Foco:** Transformar documentos de negócio (`docs/`) e requisitos em especificações técnicas e tarefas acionáveis.
- **Entradas:** Arquivos da pasta `docs/`, codebase atual e diretrizes de Joacir Peçanha.
- **Saídas:**
  - Especificações técnicas em `governance/specs/SPEC-XXX.md`.
  - Tarefas no formato padrão em `governance/tasks/backlog/TASK-XXX.md`.
- **Restrições:** O Planner Agent **NÃO** escreve nem edita código de implementação em `mobile/src/`. Seu escopo é estritamente documental e analítico.

---

## 3. Coder Agent (Agente de Implementação)
- **Foco:** Escrever código robusto, tipado e testável estritamente aderente à tarefa aprovada.
- **Entradas:** `governance/tasks/in-progress/TASK-XXX.md`, especificações vinculadas e `mobile/AGENTS.md`.
- **Saídas:** Código-fonte e testes dentro de `mobile/src/` e `mobile/__tests__/`.
- **Restrições:**
  - Modificar apenas arquivos listados no `TASK-XXX.md`.
  - Não instalar bibliotecas sem autorização prévia.
  - Não alterar regras de negócio sem aprovação.
  - Não declarar a tarefa como concluída sem validação estática de tipos (`npx tsc --noEmit`).

---

## 4. Tester & Auditor Agent (Agente de Verificação e Qualidade)
- **Foco:** Garantir que o código produzido pelo Coder Agent cumpre rigorosamente os Critérios de Aceitação (CA) e a qualidade técnica.
- **Entradas:** Diff de alterações da tarefa ativa e seção de Critérios de Aceitação do `TASK-XXX.md`.
- **Saídas:**
  - Execução de suites de testes unitários e de integração.
  - Relatório de verificação estática (`tsc`, linter).
  - Preenchimento do relatório no `review-template.md` para apreciação de Joacir Peçanha.
- **Restrições:** O Auditor não implementa features novas; apenas aponta discrepâncias ou corrige testes com defeito.

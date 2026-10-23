# Spec-Driven Development (SDD) Framework — FieldOps

## 1. O que é Spec-Driven Development no FieldOps?

O **Spec-Driven Development (SDD)** é uma metodologia de engenharia de software desenhada para maximizar a previsibilidade, consistência e confiabilidade de projetos desenvolvidos por ou com o auxílio de agentes de inteligência artificial.

No SDD:
1. **A Especificação é a Fonte Única da Verdade (SSOT):** Nenhuma linha de código de feature é escrita sem antes estar formalizada em uma especificação funcional/técnica em `governance/specs/`.
2. **Tarefas São Unidades Atômicas e Determinísticas:** O trabalho é decomposto em documentos `task.md` independentes, testáveis e com limites precisos de arquivos impactados.
3. **Contratos Blindados:** Estruturas de dados, contratos de API e schemas de banco são fixados antecipadamente por schemas (Zod no frontend, DDL no SQLite/Postgres).
4. **Governança Humana no Loop (Human-in-the-Loop):** **Joacir Peçanha** atua como Arquiteto e Autoridade Aprovadora. Agentes não alteram escopo, não quebram contratos e não removem arquivos sem sua anuência.

---

## 2. As Quatro Fases do Fluxo SDD

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   1. SPECIFY    │ ───►  │   2. APPROVE    │ ───►  │   3. IMPLEMENT  │ ───►  │   4. VERIFY     │
│  (Specs & Tasks)│       │(Joacir Peçanha) │       │ (Coder Agent)   │       │(Tests & Audit)  │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### Fase 1: Specify (Especificação)
- O **Planner Agent** consome a documentação de negócio (`docs/`) e o estado atual do codebase.
- Cria ou atualiza a especificação arquitetural em `governance/specs/SPEC-XXX.md`.
- Desmembra a especificação em tarefas atômicas em `governance/tasks/backlog/TASK-XXX.md`.

### Fase 2: Approve (Aprovação Humana)
- O **Tech Lead (Joacir Peçanha)** analisa a tarefa e os critérios de aceitação.
- Ajusta prioridades e parâmetros técnicos se necessário.
- Autoriza a execução movendo o arquivo para `governance/tasks/in-progress/`.

### Fase 3: Implement (Implementação Controlada)
- O **Coder Agent** lê o `AGENTS.md` do módulo (ex: `mobile/AGENTS.md`), a especificação referenciada e a tarefa ativa.
- Modifica apenas os arquivos declarados na seção de arquivos impactados.
- Não introduz dependências externas sem aprovação prévia.
- Segue rigorosamente o padrão arquitetural definido (Clean Architecture + Outbox Pattern).

### Fase 4: Verify & Handover (Verificação e Entrega)
- Execução de comandos determinísticos de verificação estática:
  * TypeScript typecheck: `npx tsc --noEmit`
  * Linters e formatadores
  * Testes unitários associados
- Preenchimento do relatório de execução no `task.md`.
- Apresentação da entrega para revisão e encerramento por **Joacir Peçanha** (movendo para `governance/tasks/completed/`).

---

## 3. Regras de Ouro para Agentes

1. **Nunca suponha contratos:** Se um endpoint, payload ou schema não estiver claro na spec, pergunte ao responsável humano antes de codificar.
2. **Preserve a Integridade Offline:** Qualquer fluxo que salve dados no mobile deve garantir gravação em SQLite primeiro e criação de operação na Outbox.
3. **Mantenha os Tipos Estritos:** Nenhum uso de `any` desnecessário em TypeScript. Use schemas Zod para validar payloads em tempo de execução.
4. **Uma Tarefa por Vez:** Agentes não devem trabalhar em múltiplas tarefas concorrentes na pasta `tasks/in-progress/`.

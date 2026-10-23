# Governança & Base de Conhecimento — FieldOps

Bem-vindo à base de governança e conhecimento do projeto **FieldOps**. Este repositório adota a metodologia **Spec-Driven Development (SDD)** para coordenar o desenvolvimento assistido por agentes de inteligência artificial em conjunto com a supervisão humana.

---

## 1. Estrutura de Governança e Papéis

- **Responsável Humano / Tech Lead:** Joacir Peçanha
- **Regra Central de Governança:** Qualquer alteração em contratos de API, schemas de banco de dados, remoção de arquivos ou avanço de épicos exige **aprovação explícita de Joacir Peçanha**.
- **Agentes de IA:** Atuam como executores especializados (Planejamento, Implementação, Testes e Verificação), operando estritamente dentro dos limites definidos nas especificações (`specs/`) e tarefas (`tasks/`).

---

## 2. Estrutura de Diretórios da Governança

```
base-conhecimento/governance/
├── README.md                          # Este documento (visão geral)
├── sdd-framework.md                   # Princípios e fluxo metodológico do SDD
├── templates/                         # Templates padronizados
│   ├── task-template.md               # Modelo para criação de tarefas executáveis
│   ├── spec-template.md               # Modelo para especificações técnicas
│   └── review-template.md             # Checklist de validação de entregas
├── specs/                             # Especificações Técnicas (Single Source of Truth)
│   ├── SPEC-001-mobile-sqlite-schema.md
│   ├── SPEC-002-mobile-outbox-sync.md
│   └── SPEC-003-mobile-dynamic-checklist.md
├── tasks/                             # Ciclo de vida das tarefas
│   ├── backlog/                       # Tarefas planejadas aguardando autorização
│   ├── in-progress/                   # Tarefa ativa em desenvolvimento
│   └── completed/                     # Tarefas finalizadas, testadas e aprovadas
└── orchestrator/                      # Guias e protocolos de orquestração
    ├── agent-roles.md                 # Matriz de responsabilidade dos agentes
    └── workflow-orchestrator.md       # Fluxo operacional passo a passo do Orquestrador
```

---

## 3. Ciclo de Vida de uma Tarefa (SDD Workflow)

```
[ Requisito em docs/ ]
         ↓
1. PLANNER AGENT elabora SPEC-XXX e TASK-XXX
         ↓
2. JOACIR PEÇANHA analisa e aprova (Move TASK para tasks/in-progress/)
         ↓
3. CODER AGENT implementa seguindo estritamente as regras de AGENTS.md
         ↓
4. TESTER/AUDITOR AGENT valida tipos (tsc), linter e critérios de aceitação
         ↓
5. JOACIR PEÇANHA realiza a revisão final e move a tarefa para tasks/completed/
```

---

## 4. Documentação de Domínio de Referência

A governança do projeto consolida as decisões detalhadas na pasta `docs/`:
- [project-backlog-cards.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/project-backlog-cards.md): Catálogo completo de cards e tarefas mapeadas para o GitHub Project.
- [visao_geral.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/visao_geral.md): Escopo do MVP, usuários e premissas.
- [objetivos.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/objetivos.md): Objetivos de negócio, mobile e indicadores de sucesso.
- [regras-de-negocio.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/regras-de-negocio.md): 90 regras de negócio auditáveis (RN-001 a RN-090).
- [criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md): Critérios formais de aceitação (AC-AUTH a AC-RELEASE).
- [definition-of-done.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/definition-of-done.md): Definição de pronto para histórias, mobile, web, API, sprint e MVP.
- [fluxo_geral.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/fluxo_geral.md): Máquina de estados, regras de transição e fluxo offline.
- [aplicativo_mobile.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/aplicativo_mobile.md): Catálogo de telas, componentes do checklist dinâmico e stack.
- [inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md): Telas administrativas, builder de modelos e revisão.
- [modelo-de-dados.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/modelo-de-dados.md): DDL e modelos relacionais (PostgreSQL e SQLite).
- [arquitetura.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/arquitetura.md): Clean architecture, Outbox pattern, persistência e segurança.


# FieldOps — Catálogo de Cards e Tarefas do GitHub Project

Este documento consolida todos os **Cards de Tarefas e Histórias** mapeados a partir dos requisitos de negócio (`docs/regras-de-negocio.md`), especificações de domínio (`docs/`), critérios de aceitação (`docs/criterios-de-avaliacao.md`), definição de pronto (`docs/definition-of-done.md`) e do framework SDD (`base-conhecimento/governance/`).

Eles foram estruturados para inserção direta no **GitHub Project** do repositório [`joacir-pecanha/field-ops`](https://github.com/joacir-pecanha/field-ops).

---

## 1. Estrutura de Épicos do MVP (P0)

| Épico | Nome do Épico | Módulos Envolvidos | Qtd Cards | Critérios de Aceitação Principais |
| :--- | :--- | :--- | :---: | :--- |
| **EP-01** | **Identidade, Acesso e Permissões** | Mobile, Backend, Web | 3 | AC-AUTH, AC-SECURITY, AC-USERS |
| **EP-02** | **Cadastros Administrativos (Master Data)** | Backend, Web | 2 | AC-USERS, AC-MASTER |
| **EP-03** | **Modelos de Inspeção e Versionamento** | Backend, Web | 2 | AC-TEMPLATE |
| **EP-04** | **Planejamento, Agendamento e Atribuição** | Backend, Web | 2 | AC-SCHEDULING, AC-ADMIN-MONITOR |
| **EP-05** | **Execução Mobile & Checklist em Campo** | Mobile | 8 | AC-MOBILE-LIST, AC-START, AC-CHECKLIST, AC-QR, AC-LOCATION, AC-EVIDENCE, AC-NONCONFORMITY, AC-COMPLETE |
| **EP-06** | **Operação Offline e Sincronização Outbox** | Mobile, Backend | 2 | AC-SYNC, AC-EVIDENCE |
| **EP-07** | **Interface Web - Revisão e Auditoria** | Backend, Web | 3 | AC-REVIEW, AC-ADMIN-MONITOR, AC-SECURITY |
| **EP-08** | **Qualidade, Seed Data e Release E2E** | Infra, Todos | 1 | AC-RELEASE, Checklist Executivo |

---

## 2. Matriz de Rastreabilidade e Mapeamento de Cards

| Card ID | Título do Card / Issue | Módulo | Prioridade | Regras de Negócio (RN) | Critérios de Aceitação (AC) | Tarefa no SDD |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **TASK-001** | Implementar Camada de Persistência SQLite Real e Migrações | `module:mobile` | P0 | RN-041, RN-065, RN-066 | AC-MOBILE-LIST, AC-CHECKLIST | [TASK-001](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-001-setup-sqlite-migrations.md) |
| **TASK-002** | Implementar Motor de Sincronização Outbox com Idempotência | `module:mobile` | P0 | RN-066, RN-067, RN-070, RN-071 | AC-SYNC | [TASK-002](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-002-implement-outbox-engine.md) |
| **TASK-003** | Implementar Componentes de Entrada do Checklist Dinâmico | `module:mobile` | P0 | RN-016, RN-035, RN-036, RN-041 | AC-CHECKLIST | [TASK-003](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-003-dynamic-checklist-components.md) |
| **TASK-004** | Gerenciamento Seguro de Sessão JWT e Rotas Protegidas no Mobile | `module:mobile` | P0 | RN-001, RN-003, RN-007, RN-008 | AC-AUTH, AC-SECURITY | [TASK-004](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-004-auth-session-management-mobile.md) |
| **TASK-005** | Autenticação JWT, Autorização Baseada em Roles e Gestão de Sessão na API | `module:backend` | P0 | RN-001 a RN-008, RN-086 | AC-AUTH, AC-SECURITY | [TASK-005](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-005-auth-api-jwt-roles.md) |
| **TASK-006** | Autenticação, Interceptors e Guards de Rota na Interface Administrativa Web | `module:web-admin` | P0 | RN-001, RN-003, RN-006, RN-007 | AC-AUTH, AC-SECURITY | [TASK-006](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-006-auth-web-admin-guards.md) |
| **TASK-007** | API de Cadastros Mestres (Usuários, Clientes, Locais e Equipamentos) | `module:backend` | P0 | RN-009 a RN-014, RN-088 | AC-USERS, AC-MASTER | [TASK-007](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-007-master-data-backend-api.md) |
| **TASK-008** | Telas de Gestão Administrativa de Clientes, Locais e Equipamentos | `module:web-admin` | P0 | RN-009 a RN-014, RN-088 | AC-USERS, AC-MASTER | [TASK-008](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-008-master-data-web-management.md) |
| **TASK-009** | Modelagem de Templates de Inspeção, Versionamento Imutável e Snapshots na API | `module:backend` | P0 | RN-015 a RN-023 | AC-TEMPLATE | [TASK-009](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-009-inspection-templates-backend.md) |
| **TASK-010** | Construtor Visual de Modelos de Inspeção e Prévia de Checklist na Web | `module:web-admin` | P0 | RN-015 a RN-023, RN-038, RN-039 | AC-TEMPLATE | [TASK-010](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-010-inspection-templates-web-builder.md) |
| **TASK-011** | Agendamento, Atribuição e Geração de Snapshots de Inspeção na API | `module:backend` | P0 | RN-024 a RN-031, RN-086, RN-089 | AC-SCHEDULING | [TASK-011](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-011-inspection-scheduling-backend.md) |
| **TASK-012** | Telas de Agendamento, Atribuição e Monitoramento de Inspeções na Web | `module:web-admin` | P0 | RN-024 a RN-031 | AC-SCHEDULING, AC-ADMIN-MONITOR | [TASK-012](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-012-inspection-scheduling-web.md) |
| **TASK-013** | Interface Mobile de Listagem de Inspeções Atribuídas e Detalhes Offline | `module:mobile` | P0 | RN-004, RN-028, RN-065, RN-071 | AC-MOBILE-LIST | [TASK-013](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-013-mobile-inspection-list-and-details.md) |
| **TASK-014** | Scanner de QR Code de Equipamentos e Validação de Divergências no Mobile | `module:mobile` | P0 | RN-011, RN-058, RN-059, RN-063, RN-064 | AC-QR | [TASK-014](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-014-mobile-qr-scanner-and-validation.md) |
| **TASK-015** | Ciclo de Vida da Inspeção (Início, Geolocalização, Validação Obrigatória e Conclusão) | `module:mobile` | P0 | RN-032 a RN-044, RN-058 a RN-062 | AC-START, AC-LOCATION, AC-COMPLETE | [TASK-015](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-015-mobile-inspection-lifecycle-start-finish.md) |
| **TASK-016** | Captura, Compressão e Armazenamento Local de Evidências Fotográficas no Mobile | `module:mobile` | P0 | RN-045 a RN-051, RN-058 | AC-EVIDENCE | [TASK-016](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-016-mobile-evidence-camera-capture.md) |
| **TASK-017** | Gestão e Registro de Não Conformidades com Criticidade no Mobile | `module:mobile` | P0 | RN-038, RN-039, RN-052 a RN-057 | AC-NONCONFORMITY | [TASK-017](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-017-mobile-nonconformity-management.md) |
| **TASK-018** | Endpoint de Sincronização em Lote Idempotente e Upload de Evidências na API | `module:backend` | P0 | RN-067 a RN-078, RN-087, RN-089 | AC-SYNC | [TASK-018](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-018-backend-sync-batch-idempotency.md) |
| **TASK-019** | Máquina de Estados de Revisão, Aprovação, Reprovação e Auditoria na API | `module:backend` | P0 | RN-079 a RN-086, RN-089 | AC-REVIEW, AC-SECURITY | [TASK-019](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-019-backend-inspection-review-lifecycle.md) |
| **TASK-020** | Interface Web para Revisão Técnica, Visualização de Evidências e Aprovação | `module:web-admin` | P0 | RN-079 a RN-085 | AC-REVIEW, AC-ADMIN-MONITOR | [TASK-020](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-020-web-inspection-review-and-approval.md) |
| **TASK-021** | Dashboard Operacional e Acompanhamento Gerencial na Interface Web | `module:web-admin` | P0 | RN-005, RN-079 | AC-ADMIN-MONITOR | [TASK-021](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-021-web-dashboard-monitoring.md) |
| **TASK-022** | Roteiro de Demonstração E2E, Massa de Testes (Seed Data) e Validação de Release do MVP | `module:infra` | P0 | RN-001 a RN-090 | AC-RELEASE, Checklist Executivo | [TASK-022](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/tasks/backlog/TASK-022-seed-data-and-e2e-release-validation.md) |

---

## 3. Configuração Recomendada no GitHub Project

Ao vincular o repositório ao **GitHub Projects** (v2), configure as seguintes colunas e visualizações:

### 3.1 Colunas do Quadro Kanban
1. **Backlog Geral:** Tarefas aprovadas aguardando alocação em sprint (`Status: DRAFT / APPROVED`).
2. **Sprint Backlog / Ready:** Tarefas selecionadas para a iteração ativa.
3. **In Progress:** Tarefa ativamente em desenvolvimento pelo Agente Coder (`tasks/in-progress/`).
4. **In Review / Audit:** Implementação concluída aguardando validação de tipos, lint e testes pelo Agente Tester.
5. **Done:** Tarefas validadas, testadas e aprovadas por Joacir Peçanha (`tasks/completed/`).

### 3.2 Campos Customizados (Custom Fields)
- **Module:** Single select (`Mobile`, `Backend API`, `Web Admin`, `Infra/E2E`).
- **Epic:** Single select (`EP-01 Auth`, `EP-02 Master Data`, `EP-03 Templates`, `EP-04 Scheduling`, `EP-05 Field Ops`, `EP-06 Offline Sync`, `EP-07 Review & Audit`, `EP-08 Release`).
- **Priority:** Single select (`P0 - Blocker/MVP`, `P1 - High`, `P2 - Future`).
- **Tech Lead:** Assignee (`joacir-pecanha`).
- **SDD Task ID:** Text (`TASK-001` até `TASK-022`).

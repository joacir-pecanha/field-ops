# TASK-011: Agendamento, Atribuição e Geração de Snapshots de Inspeção na API

## 1. Metadados
- **ID:** TASK-011
- **Épico / Módulo:** Backend API / Planejamento & Agendamento
- **Status:** COMPLETED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/modelo-de-dados.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/modelo-de-dados.md), [docs/regras-de-negocio.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/regras-de-negocio.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-11-13

---

## 2. Contexto e Valor de Negócio
O módulo de planejamento conecta a configuração de modelos ao trabalho prático de campo. Ao agendar uma inspeção, o supervisor define o cliente, local, equipamento, modelo publicado, técnico responsável e prazo previsto. O backend deve congelar imediatamente a estrutura do checklist em registros de snapshot (`InspectionItemSnapshot`), garantindo que o técnico execute exatamente a versão contratada, mesmo que o modelo seja alterado futuramente.

---

## 3. Arquivos Impactados
- `backend/src/main/resources/db/migration/V3__inspections_and_snapshots_schema.sql` (Tabelas de inspeções e snapshots de itens)
- `backend/src/main/java/com/fieldops/modules/inspection/domain/Inspection.java` (Entidade mestre de inspeção e status)
- `backend/src/main/java/com/fieldops/modules/inspection/domain/InspectionItemSnapshot.java` (Cópia imutável do checklist)
- `backend/src/main/java/com/fieldops/modules/inspection/controller/InspectionSchedulingController.java` (Endpoints REST)
- `backend/src/main/java/com/fieldops/modules/inspection/service/InspectionSchedulingService.java` (Regras de agendamento e cancelamento)
- `backend/src/main/java/com/fieldops/modules/inspection/dto/ScheduleInspectionRequest.java` / `CancelInspectionRequest.java`
- `backend/src/test/java/com/fieldops/modules/inspection/InspectionSchedulingTest.java` (Testes de integração)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Toda inspeção deve estar vinculada a uma versão publicada de modelo (RN-024, AC-SCHEDULING).
- **RF-02:** Cliente, local, técnico responsável e data prevista são obrigatórios (RN-025, AC-SCHEDULING).
- **RF-03:** Validar compatibilidade: o equipamento deve pertencer ao local e o local deve pertencer ao cliente (RN-014, AC-SCHEDULING).
- **RF-04:** Somente técnico ativo pode receber atribuição de inspeção (RN-027, AC-SCHEDULING).
- **RF-05:** No MVP, cada inspeção possui somente um técnico responsável (RN-031).
- **RF-06:** No ato do agendamento, copiar todos os itens do modelo para a tabela `inspection_item_snapshots` (RN-021, AC-SCHEDULING).
- **RF-07:** Permitir cancelamento por supervisor/admin registrando obrigatoriamente usuário, data e justificativa (RN-029, AC-SCHEDULING).
- **RF-08:** Inspeções já aprovadas não podem ser canceladas pelo fluxo comum (RN-030).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar estados formais de inspeção: `RASCUNHO`, `ATRIBUÍDA`, `EM_ANDAMENTO`, `ENVIADA`, `EM_REVISÃO`, `APROVADA`, `REPROVADA`, `CANCELADA`.
- **RT-02:** Operação transacional para criar a inspeção e os registros de snapshot de uma só vez.
- **RT-03:** Trilha de auditoria em `audit_logs` ao criar, atribuir ou cancelar a inspeção (RN-086).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de agendar com técnico inativo retorna HTTP 400 Bad Request com mensagem descritiva.
- **EX-02:** Cancelamento sem justificativa é bloqueado com erro de validação (HTTP 422).

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Criar scripts Flyway com as tabelas `inspections` e `inspection_item_snapshots`.
- [x] **Passo 2:** Mapear entidades JPA com anotações de auditoria e validação de enum de estados.
- [x] **Passo 3:** Desenvolver serviço de agendamento que valida as entidades relacionadas e gera o snapshot.
- [x] **Passo 4:** Criar endpoint de agendamento `POST /api/v1/inspections/schedule` e endpoint de cancelamento `POST /api/v1/inspections/{id}/cancel`.
- [x] **Passo 5:** Implementar endpoint para consulta de inspeções atribuídas a um técnico específico para sincronização (`GET /api/v1/inspections/assigned`).
- [x] **Passo 6:** Criar testes automatizados para cenários de agendamento válido, incompatibilidade de local/equipamento e cancelamento com auditoria.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Inspeção agendada com sucesso adquire estado `ATRIBUÍDA` e gera snapshots de todos os itens do modelo.
- [x] **CA-02:** O cancelamento exige justificativa e altera o estado para `CANCELADA`.
- [x] **CA-03:** Técnico ativo consegue listar suas inspeções atribuídas.
- [x] **CA-04:** Alterar o modelo original posteriormente não modifica os snapshots da inspeção já criada.
- [x] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Data da Execução:** 2026-11-13
- **Migration Flyway (`V4`):** Criada a migration `backend/src/main/resources/db/migration/V4__inspections_and_snapshots_schema.sql` com as tabelas `inspections`, `inspection_item_snapshots` e `audit_logs`, chaves estrangeiras e índices (numerada como `V4` pois `V1__init_auth_schema.sql`, `V2__init_master_schema.sql` e `V3__templates_and_snapshots_schema.sql` já estavam ocupadas no repositório).
- **Entidades JPA & Repositórios:** Implementados `InspectionStatus` (`RASCUNHO`, `ATRIBUÍDA`, `EM_ANDAMENTO`, `ENVIADA`, `EM_REVISÃO`, `APROVADA`, `REPROVADA`, `CANCELADA`), `InspectionPriority`, `Inspection`, `InspectionItemSnapshot` e `AuditLog`, além de `InspectionRepository`, `InspectionItemSnapshotRepository`, `AuditLogRepository` e `InspectionSpecifications`, validados via `spring.jpa.hibernate.ddl-auto=validate` no perfil `test`.
- **Regras de Negócio, Exceções e Snapshots:**
  - `InspectionSchedulingService` valida no mesmo fluxo transacional (`@Transactional`) que `TemplateVersion` está `PUBLISHED` e seu `InspectionTemplate` ativo, `Client` e `Site` estão ativos e vinculados entre si, `Equipment` (opcional conforme RN-026) pertence ao `Site` e está ativo, e o usuário atribuído está ativo com papel `TECHNICIAN`.
  - Os itens da versão publicada são congelados em `inspection_item_snapshots` reaproveitando `TemplateSnapshotService.generateSnapshotByVersionId(UUID)`, preservando o checklist contratado mesmo após a publicação de novas versões do modelo.
  - Eventos de criação, atribuição e cancelamento são persistidos em `audit_logs`.
  - Conforme EX-01, `InspectionSchedulingValidationException` foi tratada no `GlobalExceptionHandler` retornando HTTP `400 Bad Request` para técnico inativo/bloqueado, papel inválido ou `scheduledFor` ausente.
  - Conforme EX-02, `CancelInspectionRequest` omitiu `@NotBlank` no campo de motivo para permitir validação no serviço (`BusinessRuleException` com código `CANCEL_REASON_REQUIRED`), retornando HTTP `422 Unprocessable Entity` quando a justificativa estiver vazia/ausente, e bloqueando o cancelamento de inspeções no estado `APROVADA`.
- **Endpoints REST (`InspectionSchedulingController`):** Expostos `POST /api/v1/inspections/schedule` (com alias `POST /api/v1/inspections`), `POST /api/v1/inspections/{id}/cancel` (com alias `PATCH /api/v1/inspections/{id}/cancel`), `GET /api/v1/inspections/assigned`, além de `GET /api/v1/inspections`, `GET /api/v1/inspections/{id}`, `GET /api/v1/inspections/{id}/snapshots` e `GET /api/v1/inspections/{id}/audit-logs`.
- **Evidências de Testes Automatizados:**
  - `.\backend\mvnw.cmd -f backend/pom.xml test "-Dtest=InspectionSchedulingTest"`: **7/7 testes aprovados** (0 falhas, 0 erros, 0 ignorados; `BUILD SUCCESS`).
  - `.\backend\mvnw.cmd -f backend/pom.xml test`: **31/31 testes aprovados** (`FieldOpsBackendApplicationTests`: 1, `AuthControllerTest`: 10, `InspectionSchedulingTest`: 7, `MasterDataIntegrationTest`: 7, `TemplateLifecycleTest`: 6; 0 falhas, 0 erros, 0 ignorados; `BUILD SUCCESS`).

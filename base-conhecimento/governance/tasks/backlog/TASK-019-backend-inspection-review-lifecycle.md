# TASK-019: Máquina de Estados de Revisão, Aprovação, Reprovação e Auditoria na API

## 1. Metadados
- **ID:** TASK-019
- **Épico / Módulo:** Backend API / Revisão & Auditoria
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/fluxo_geral.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/fluxo_geral.md), [docs/regras-de-negocio.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/regras-de-negocio.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
Após o técnico concluir e sincronizar uma inspeção em campo (`ENVIADA`), o supervisor analisa os dados coletados para validar conformidade ou exigir correções. Esta tarefa implementa a máquina de estados formal no backend: abertura de revisão (`EM_REVISÃO`), aprovação final (`APROVADA`) com bloqueio estrito contra alterações comuns, e reprovação (`REPROVADA`) com registro obrigatório de motivo para que o técnico possa corrigir o trabalho.

---

## 3. Arquivos Impactados
- `backend/src/main/resources/db/migration/V5__review_and_audit_schema.sql` (Tabelas de auditoria e colunas de revisão)
- `backend/src/main/java/com/fieldops/modules/inspection/domain/InspectionStatus.java` (Máquina de estados e transições permitidas)
- `backend/src/main/java/com/fieldops/modules/inspection/domain/AuditLog.java` (Entidade JPA de auditoria de ações críticas)
- `backend/src/main/java/com/fieldops/modules/inspection/controller/InspectionReviewController.java` (Endpoints `/start-review`, `/approve`, `/reject`)
- `backend/src/main/java/com/fieldops/modules/inspection/service/InspectionReviewService.java` (Regras de transição e validação de supervisor)
- `backend/src/main/java/com/fieldops/modules/inspection/dto/RejectInspectionRequest.java` / `ApproveInspectionRequest.java`
- `backend/src/test/java/com/fieldops/modules/inspection/InspectionReviewIntegrationTest.java` (Testes de integração)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Somente supervisores autorizados podem iniciar a revisão ou alterar o veredito (RN-079, AC-REVIEW).
- **RF-02:** Abertura da revisão transita o estado de `ENVIADA` para `EM_REVISÃO` e registra log de auditoria (AC-REVIEW).
- **RF-03:** A aprovação transita o estado para `APROVADA`, registra o supervisor, timestamp e comentários opcionais (RN-081, AC-REVIEW).
- **RF-04:** Uma inspeção aprovada fica bloqueada para edição comum por técnicos e supervisores (RN-049, RN-082, AC-REVIEW).
- **RF-05:** A reprovação exige obrigatoriamente motivo explicativo (`rejection_reason`) (RN-080, AC-REVIEW).
- **RF-06:** Inspeção reprovada transita para `REPROVADA` e fica disponível para download pelo técnico para correção (RN-083, AC-REVIEW).
- **RF-07:** O supervisor não pode alterar silenciosamente respostas do técnico; ajustes administrativos devem ser diferenciados e auditados (RN-084, RN-085).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Rejeitar transições inválidas com HTTP 409 Conflict ou 422 Unprocessable Entity (RN-089, DoD 18.4).
- **RT-02:** Registrar todas as mudanças de estado na tabela `audit_logs` contendo: usuário, data, ação, estado anterior e novo estado (RN-086, AC-REVIEW).
- **RT-03:** Proteger endpoints com `@PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")`.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de reprovar sem motivo informado retorna HTTP 400 Bad Request com mensagem "O motivo da reprovação é obrigatório".
- **EX-02:** Tentativa de aprovar inspeção que não esteja no estado `EM_REVISÃO` ou `ENVIADA` é bloqueada.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Criar tabela Flyway `audit_logs` com índices por entidade e timestamp.
- [x] **Passo 2:** Configurar enum de transição de estados validando transições válidas de acordo com a tabela 7.6 de `docs/fluxo_geral.md`.
- [x] **Passo 3:** Implementar métodos `startReview`, `approve` e `reject` no serviço `InspectionReviewService`.
- [x] **Passo 4:** Criar endpoints REST `/api/v1/inspections/{id}/start-review`, `/approve` e `/reject`.
- [x] **Passo 5:** Criar serviço assíncrono de auditoria para persistência dos logs sem onerar o tempo de resposta da API.
- [x] **Passo 6:** Escrever testes de integração cobrindo aprovação bem-sucedida, bloqueio de reprovação sem motivo e validação de permissões de perfil.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Supervisor inicia revisão e a inspeção passa para `EM_REVISÃO`.
- [x] **CA-02:** Aprovação grava o identificador do supervisor, data/hora e bloqueia edições adicionais.
- [x] **CA-03:** Reprovação sem justificativa falha com validação clara; com justificativa altera estado para `REPROVADA`.
- [x] **CA-04:** Registro completo é gerado na tabela de auditoria.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Data da Execução:** 2026-11-22
- **Migration Flyway (`V6`):** Criada a migration `backend/src/main/resources/db/migration/V6__review_and_audit_schema.sql` (numerada como `V6` pois `V4` e `V5` já estavam ocupadas no repositório). Garantiu a tabela `audit_logs` com índices compostos por entidade/timestamp (`idx_audit_logs_entity_occurred_at`, `idx_audit_logs_inspection_occurred_at`, `idx_audit_logs_actor_occurred_at`), adicionou colunas de ciclo de revisão em `inspections` (`review_started_at`, `review_started_by`, `approved_by`, `review_comments`, `rejected_at`, `rejected_by`, `rejection_reason`, `review_cycle`), criou a tabela `inspection_reviews` para preservar múltiplos ciclos de revisão (RN-083) e adicionou colunas diferenciadas de ajuste administrativo em `inspection_responses` (`is_admin_adjusted`, `admin_adjusted_value`, `admin_adjustment_reason`, `admin_adjusted_by`, `admin_adjusted_at`).
- **Máquina de Estados (`InspectionStatus`) & Exceções (`RT-01`, `EX-01`, `EX-02`):**
  - `InspectionStatus` define as transições formais permitidas segundo a tabela 7.6 de `docs/fluxo_geral.md` e EX-02 (`canStartReview`, `canApprove`, `canReject`, `canReopenForCorrection`, `isLockedForCommonEdit`, `allowedTransitions`, `canTransitionTo`).
  - Transições inválidas ou tentativas sobre inspeções `APROVADA`/`CANCELADA` lançam `InvalidInspectionStateTransitionException`, tratada no `GlobalExceptionHandler` com **HTTP 409 Conflict**.
  - Reprovação sem motivo informado lança `InspectionReviewValidationException`, retornando **HTTP 400 Bad Request** com mensagem `"O motivo da reprovação é obrigatório"` (EX-01).
- **Auditoria Assíncrona (`AsyncAuditConfig`, `AsyncAuditLogWriter`, `InspectionAuditService`):**
  - Configurado executor dedicado `auditTaskExecutor` com `@EnableAsync` e persistência isolada via `@Async("auditTaskExecutor")` e `@Transactional(propagation = Propagation.REQUIRES_NEW)`.
  - `InspectionReviewService` confirma a transição da inspeção via `TransactionTemplate` antes do despacho assíncrono para evitar contenção de locks em chaves estrangeiras de `audit_logs`, sincronizando o resultado com timeout curto e fallback síncrono.
- **Endpoints REST, Segurança & Preservação de Respostas (`InspectionReviewController`, `InspectionReviewService`, `SyncBatchProcessor`):**
  - Expostos `POST`/`PATCH /api/v1/inspections/{id}/start-review`, `/approve`, `/reject`, `/responses/{itemId}/admin-adjustment` e `GET /api/v1/inspections/{id}/reviews`, protegidos com `@PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")` e validados adicionalmente quanto ao status ativo do revisor.
  - Inspeções reprovadas permanecem disponíveis ao técnico via `GET /api/v1/inspections/assigned` com `rejectionReason` / `rejection_reason`, respostas, não conformidades e histórico de revisões.
  - `SyncBatchProcessor` bloqueia alterações silenciosas de respostas por perfis `SUPERVISOR`/`ADMIN` (`SILENT_RESPONSE_EDIT_FORBIDDEN`) e registra `previousValueJson` em atualizações pós-reprovação; ajustes administrativos utilizam endpoint dedicado que preserva integralmente os valores originais do técnico e audita a alteração.
- **Evidências de Testes Automatizados:**
  - `.\backend\mvnw.cmd -f backend/pom.xml clean test "-Djava.version=23" "-Dmaven.compiler.release=23"`: **43/43 testes aprovados** (`InspectionReviewIntegrationTest`: 5/5, `InspectionSchedulingTest`: 7/7, `SyncBatchIntegrationTest`: 7/7, `AuthControllerTest`: 10/10, `MasterDataIntegrationTest`: 7/7, `TemplateLifecycleTest`: 6/6, `FieldOpsBackendApplicationTests`: 1/1; `0` falhas, `0` erros, `0` ignorados).

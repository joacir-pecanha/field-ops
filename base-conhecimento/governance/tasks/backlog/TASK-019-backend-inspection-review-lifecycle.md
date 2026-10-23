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
- [ ] **Passo 1:** Criar tabela Flyway `audit_logs` com índices por entidade e timestamp.
- [ ] **Passo 2:** Configurar enum de transição de estados validando transições válidas de acordo com a tabela 7.6 de `docs/fluxo_geral.md`.
- [ ] **Passo 3:** Implementar métodos `startReview`, `approve` e `reject` no serviço `InspectionReviewService`.
- [ ] **Passo 4:** Criar endpoints REST `/api/v1/inspections/{id}/start-review`, `/approve` e `/reject`.
- [ ] **Passo 5:** Criar serviço assíncrono de auditoria para persistência dos logs sem onerar o tempo de resposta da API.
- [ ] **Passo 6:** Escrever testes de integração cobrindo aprovação bem-sucedida, bloqueio de reprovação sem motivo e validação de permissões de perfil.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Supervisor inicia revisão e a inspeção passa para `EM_REVISÃO`.
- [ ] **CA-02:** Aprovação grava o identificador do supervisor, data/hora e bloqueia edições adicionais.
- [ ] **CA-03:** Reprovação sem justificativa falha com validação clara; com justificativa altera estado para `REPROVADA`.
- [ ] **CA-04:** Registro completo é gerado na tabela de auditoria.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*

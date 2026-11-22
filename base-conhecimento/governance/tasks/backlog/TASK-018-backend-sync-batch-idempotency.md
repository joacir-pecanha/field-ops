# TASK-018: Endpoint de Sincronização em Lote Idempotente e Upload de Evidências na API

## 1. Metadados
- **ID:** TASK-018
- **Épico / Módulo:** Backend API / Sincronização & Idempotência
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-002-mobile-outbox-sync.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-002-mobile-outbox-sync.md), [docs/fluxo_geral.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/fluxo_geral.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
A sincronização é o elemento central da arquitetura offline-first do FieldOps. Como dispositivos móveis enfrentam oscilações bruscas de conexão, pacotes de rede podem ser repetidos ou interrompidos pela metade. O backend deve processar lotes de mutações da Outbox móvel garantindo idempotência absoluta: cada mutação possui um UUID único (`operation_id`). Reenviar a mesma operação não cria registros duplicados nem gera inconsistências contábeis.

---

## 3. Arquivos Impactados
- `backend/src/main/resources/db/migration/V4__sync_and_idempotency_schema.sql` (Tabelas de operações processadas, respostas e arquivos de evidência)
- `backend/src/main/java/com/fieldops/modules/sync/domain/ProcessedOperation.java` (Entidade JPA para controle de idempotência)
- `backend/src/main/java/com/fieldops/modules/sync/controller/SyncController.java` (Endpoint `POST /api/v1/sync/batch` e `POST /api/v1/sync/upload`)
- `backend/src/main/java/com/fieldops/modules/sync/service/SyncBatchProcessor.java` (Processamento transacional em lote)
- `backend/src/main/java/com/fieldops/modules/sync/service/EvidenceStorageService.java` (Armazenamento de imagens em disco / MinIO / S3)
- `backend/src/main/java/com/fieldops/modules/sync/dto/SyncBatchRequest.java` / `SyncBatchResponse.java` (DTOs da API)
- `backend/src/test/java/com/fieldops/modules/sync/SyncBatchIntegrationTest.java` (Testes de integração de idempotência)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Endpoint `POST /api/v1/sync/batch` aceitando lote de operações com cabeçalhos de autenticação e identificador de lote (AC-SYNC).
- **RF-02:** Cada operação enviada deve conter UUID idempotente único (`operation_id`) (RN-067, AC-SYNC).
- **RF-03:** Reenviar uma operação já aplicada deve retornar sucesso (`ALREADY_PROCESSED`) sem duplicar registros no banco (RN-068, AC-SYNC).
- **RF-04:** Processar mutações respeitando ordem de dependência: `START_INSPECTION` -> `SAVE_RESPONSE` -> `CREATE_NON_CONFORMITY` -> `COMPLETE_INSPECTION` (RN-069, AC-SYNC).
- **RF-05:** Se uma operação falhar por regra de negócio, registrar o erro específico sem reverter ou descartar outras operações válidas do lote (RN-070, AC-SYNC).
- **RF-06:** Preservar a data e hora informada pelo dispositivo móvel (`client_timestamp`), além do momento de recepção no servidor (`server_timestamp`) (RN-074).
- **RF-07:** Endpoint dedicado para upload multipart de fotografias (`POST /api/v1/sync/upload`), rastreando o status individual do arquivo (RN-078, AC-EVIDENCE).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Registro em tabela `processed_operations` com chave única no `operation_id` para garantir atomicidade no nível do banco.
- **RT-02:** Detecção de concorrência ou alteração conflitante por versão ou estado da inspeção (RN-075, AC-SYNC).
- **RT-03:** Salvar arquivos de foto com hash de integridade e nome baseado no UUID.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Inspeção já aprovada pelo supervisor que recebe operação tardia é rejeitada com código `CONFLICT` (RN-076, AC-SYNC).
- **EX-02:** Upload de imagem corrompida ou com formato inválido deve retornar HTTP 415 com erro individualizado.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Criar tabelas SQL Flyway para `processed_operations`, `inspection_responses` e `evidence_files`.
- [x] **Passo 2:** Implementar despachante `SyncBatchProcessor` que itera sobre o lote chamando os handlers de cada tipo de operação.
- [x] **Passo 3:** Implementar verificação de idempotência antes da execução da mutação.
- [x] **Passo 4:** Criar controller REST para recebimento do lote e montagem do DTO de resposta por operação.
- [x] **Passo 5:** Implementar serviço de armazenamento de arquivos (`EvidenceStorageService`) com validação MIME type (JPEG/PNG) e limite de tamanho.
- [x] **Passo 6:** Escrever testes de integração simulando reenvio de lotes duplicados, falhas parciais e upload de fotos.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Envio de lote com 10 operações aplica todas no banco de dados e retorna confirmação para cada UUID.
- [x] **CA-02:** Reenviar o mesmo lote exatamente igual retorna status `SUCCESS` sem criar registros duplicados no PostgreSQL.
- [x] **CA-03:** Falha em uma operação individual não compromete as operações anteriores que foram bem-sucedidas.
- [x] **CA-04:** Fotos são salvas em armazenamento de objetos/disco e vinculadas às respostas no banco.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Data da Execução:** 2026-11-22
- **Migration Flyway (`V5`):** Criada a migration `backend/src/main/resources/db/migration/V5__sync_and_idempotency_schema.sql` contendo as tabelas `processed_operations` (chave primária e restrição única em `operation_id`), `inspection_responses` (chave única em `inspection_item_id`), `non_conformities`, `evidence_files` e colunas opcionais de geolocalização de início/conclusão na tabela `inspections` (numerada como `V5` pois `V4` já estava ocupada por `V4__inspections_and_snapshots_schema.sql` da TASK-011).
- **Idempotência Atômica & Isolamento Transacional (`SyncBatchProcessor`):**
  - As operações recebidas no lote são ordenadas topologicamente respeitando a precedência causal (`START_INSPECTION` -> `SAVE_RESPONSE`/`SUBMIT_RESPONSE` -> `UPLOAD_EVIDENCE` -> `CREATE_NON_CONFORMITY`/`UPDATE_NON_CONFORMITY`/`CANCEL_NON_CONFORMITY` -> `COMPLETE_INSPECTION`) e o campo `dependencies`.
  - A existência do `operation_id` em `processed_operations` é verificada antes da execução da mutação; em reenvios duplicados retorna sucesso com `status = "ALREADY_PROCESSED"` e `error_code = "ALREADY_PROCESSED"` sem duplicar registros nem eventos de auditoria.
  - Cada mutação é executada em transação isolada (`TransactionDefinition.PROPAGATION_REQUIRES_NEW`) junto da gravação em `processed_operations`. Falhas por regra de negócio ou conflitos revertem apenas a operação falha e registram o erro individual na resposta sem afetar as demais operações válidas do lote.
  - Mutações tardias em inspeções `APROVADA` ou `CANCELADA`, bem como divergência de `base_version`, são rejeitadas com código `CONFLICT`. Os timestamps `client_timestamp` e `server_timestamp` são preservados em todas as entidades e respostas.
- **Armazenamento e Validação de Evidências (`EvidenceStorageService`):**
  - Valida tipo MIME (`image/jpeg`, `image/jpg`, `image/png`), assinatura binária (magic bytes), decodificação da imagem via `ImageIO` (bloqueando imagens vazias ou corrompidas com HTTP `415 Unsupported Media Type` e `file_status = "FAILED"`), limite configurável de tamanho e checksum SHA-256 opcional.
  - Grava arquivos em disco com nome baseado no UUID (`<inspectionId>/<evidenceId>.<ext>`), calcula hash SHA-256 de integridade e vincula automaticamente à inspeção, item do snapshot, resposta (`inspection_responses`) e não conformidade (`non_conformities`).
- **Endpoints REST (`SyncController`) e Cliente Mobile:**
  - Expostos `POST /api/v1/sync/batch`, `POST /api/v1/sync/upload`, `GET /api/v1/sync/evidences/{id}` e `GET /api/v1/sync/evidences/{id}/content`.
  - `HttpSyncApiClient` em `mobile/src/infrastructure/sync/outboxEngine.ts` atualizado para incluir o cabeçalho `Authorization: Bearer <token>` a partir de `authStorage.getAccessToken()` e respeitar `EXPO_PUBLIC_API_URL`.
- **Evidências de Testes Automatizados:**
  - `.\backend\mvnw.cmd -f backend/pom.xml clean test "-Djava.version=23" "-Dmaven.compiler.release=23"`: **38/38 testes aprovados** (`SyncBatchIntegrationTest`: 7/7, `InspectionSchedulingTest`: 7/7, `AuthControllerTest`: 10/10, `MasterDataIntegrationTest`: 7/7, `TemplateLifecycleTest`: 6/6, `FieldOpsBackendApplicationTests`: 1/1; `0` falhas, `0` erros, `0` ignorados).
  - `node mobile\node_modules\typescript\bin\tsc -p mobile\tsconfig.json --noEmit`: saída `0` (`0` erros de tipagem).
  - `npm --prefix mobile test`: **167/167 testes aprovados** em `46` suítes (`0` falhas).

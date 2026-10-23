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
- [ ] **Passo 1:** Criar tabelas SQL Flyway para `processed_operations`, `inspection_responses` e `evidence_files`.
- [ ] **Passo 2:** Implementar despachante `SyncBatchProcessor` que itera sobre o lote chamando os handlers de cada tipo de operação.
- [ ] **Passo 3:** Implementar verificação de idempotência antes da execução da mutação.
- [ ] **Passo 4:** Criar controller REST para recebimento do lote e montagem do DTO de resposta por operação.
- [ ] **Passo 5:** Implementar serviço de armazenamento de arquivos (`EvidenceStorageService`) com validação MIME type (JPEG/PNG) e limite de tamanho.
- [ ] **Passo 6:** Escrever testes de integração simulando reenvio de lotes duplicados, falhas parciais e upload de fotos.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Envio de lote com 10 operações aplica todas no banco de dados e retorna confirmação para cada UUID.
- [ ] **CA-02:** Reenviar o mesmo lote exatamente igual retorna status `SUCCESS` sem criar registros duplicados no PostgreSQL.
- [ ] **CA-03:** Falha em uma operação individual não compromete as operações anteriores que foram bem-sucedidas.
- [ ] **CA-04:** Fotos são salvas em armazenamento de objetos/disco e vinculadas às respostas no banco.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*

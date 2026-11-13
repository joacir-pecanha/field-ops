# TASK-007: API de Cadastros Mestres (Usuários, Clientes, Locais e Equipamentos)

## 1. Metadados
- **ID:** TASK-007
- **Épico / Módulo:** Backend API / Cadastros Mestres
- **Status:** IN_REVIEW
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/modelo-de-dados.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/modelo-de-dados.md), [docs/regras-de-negocio.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/regras-de-negocio.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
Para viabilizar as inspeções de campo, o sistema depende de dados cadastrais organizados: Clientes, Locais de Inspeção (Sites) pertencentes a clientes e Equipamentos pertencentes a locais. Esta tarefa implementa o módulo backend responsável pela persistência, validações hierárquicas, unicidade de QR Code e política de inativação lógica (sem deleção física de dados históricos).

---

## 3. Arquivos Impactados
- `backend/src/main/resources/db/migration/V1__init_master_schema.sql` (Migrações Flyway das tabelas mestras)
- `backend/src/main/java/com/fieldops/modules/master/domain/User.java` (Entidade JPA)
- `backend/src/main/java/com/fieldops/modules/master/domain/Client.java` (Entidade JPA)
- `backend/src/main/java/com/fieldops/modules/master/domain/Site.java` (Entidade JPA com FK para Client)
- `backend/src/main/java/com/fieldops/modules/master/domain/Equipment.java` (Entidade JPA com FK para Site e QR Code único)
- `backend/src/main/java/com/fieldops/modules/master/controller/*.java` (Controllers REST para Usuários, Clientes, Locais e Equipamentos)
- `backend/src/main/java/com/fieldops/modules/master/service/*.java` (Regras de negócio e integridade)
- `backend/src/test/java/com/fieldops/modules/master/MasterDataIntegrationTest.java` (Testes de integração)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Todo local deve pertencer a um cliente (RN-009, AC-MASTER).
- **RF-02:** Todo equipamento deve pertencer a um local (RN-010, AC-MASTER).
- **RF-03:** O código QR de um equipamento deve ser único no sistema (RN-011, AC-MASTER).
- **RF-04:** Registros inativos não podem ser vinculados a novas inspeções (RN-012, AC-MASTER).
- **RF-05:** Registros utilizados em inspeções devem ser inativados (`active = false`), nunca excluídos fisicamente (RN-013, RN-088, AC-USERS).
- **RF-06:** Endpoints de listagem devem suportar paginação, ordenação e pesquisa textual por nome ou código (DoD 18.4, AC-MASTER).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar UUIDs como chave primária em todas as tabelas (DoD 10.2).
- **RT-02:** Separar estritamente entidades de persistência JPA de DTOs de request e response (DoD 18.4).
- **RT-03:** Validar payloads com anotações `@NotNull`, `@NotBlank`, `@Size` e `@Pattern`.
- **RT-04:** Constranger a unicidade do QR Code no banco via índice único (`UNIQUE(qr_code)`).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de cadastrar QR Code duplicado deve retornar HTTP 409 Conflict com mensagem explicativa.
- **EX-02:** Tentativa de exclusão física de entidade com histórico deve ser bloqueada ou convertida em inativação lógica.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Escrever o script SQL Flyway com tabelas `users`, `clients`, `sites` e `equipments` com FKs e índices.
- [x] **Passo 2:** Criar entidades JPA mapeando auditoria automática (`createdAt`, `updatedAt`).
- [x] **Passo 3:** Desenvolver DTOs de entrada e saída com validação Bean Validation.
- [x] **Passo 4:** Implementar Services aplicando regras de integridade e consultas paginadas via Spring Data JPA Specifications.
- [x] **Passo 5:** Expor endpoints REST versionados sob `/api/v1/...` com anotações OpenAPI.
- [x] **Passo 6:** Criar testes de integração validando criação, busca paginada, colisão de QR Code e inativação lógica.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** É possível cadastrar e listar Clientes, Locais e Equipamentos paginados.
- [x] **CA-02:** Tentativa de duplicar QR Code de equipamento falha com código 409.
- [x] **CA-03:** A inativação lógica preserva a entidade no banco mantendo integridade com inspeções existentes.
- [x] **CA-04:** Endpoints documentados no Swagger UI sem erros de serialização.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **2026-11-12 (Coder Agent):**
  - **Passo 1 (`V2__init_master_schema.sql`):** Criada migração Flyway `V2__init_master_schema.sql` adicionando índice de nome em `users` (tabela criada em `V1__init_auth_schema.sql` na TASK-005) e definindo as tabelas `clients`, `sites` (FK `client_id -> clients.id`) e `equipments` (FK `site_id -> sites.id`, `CONSTRAINT uq_equipments_qr_code UNIQUE (qr_code)`), com PKs UUID, campos `status`, `active`, auditoria e índices de pesquisa.
  - **Passo 2 (`AuditableMasterEntity.java`, `Client.java`, `Site.java`, `Equipment.java`, `MasterStatus.java`, `EquipmentStatus.java`):** Implementadas entidades JPA com herança de auditoria automática (`createdAt`, `updatedAt`, `@Version`, UUID) via `@PrePersist`/`@PreUpdate` e sincronização consistente entre `status` e `active`.
  - **Passo 3 (`PageResponse.java`, `UserCreateRequest.java`, `UserUpdateRequest.java`, `UserResponse.java`, `ClientRequest.java`, `ClientResponse.java`, `SiteRequest.java`, `SiteResponse.java`, `EquipmentRequest.java`, `EquipmentResponse.java`):** Separados estritamente DTOs de entrada/saída com Bean Validation (`@NotNull`, `@NotBlank`, `@Size`, `@Pattern`, `@Email`, limites geográficos) e mascaramento de senha em `toString()`.
  - **Passo 4 (`MasterSpecifications.java`, `*Repository.java`, `UserMasterService.java`, `ClientService.java`, `SiteService.java`, `EquipmentService.java`):** Implementados repositórios `JpaSpecificationExecutor` e serviços transacionais validando hierarquia Cliente -> Local -> Equipamento, bloqueando vínculos com registros inativos (HTTP 422), protegendo unicidade de QR Code/e-mail/código (HTTP 409) e convertendo exclusões em inativação lógica (`active = false`, `status = INACTIVE`) com revogação de refresh tokens para usuários inativados.
  - **Passo 5 (`UserController.java`, `ClientController.java`, `SiteController.java`, `EquipmentController.java`, `OpenApiConfig.java`, `GlobalExceptionHandler.java`):** Expostos endpoints REST `/api/v1/users`, `/api/v1/clients`, `/api/v1/sites` e `/api/v1/equipments` (incluindo rotas aninhadas e `/qr/{qrCode}`) com `@PreAuthorize` por role, anotações OpenAPI (`springdoc-openapi-starter-webmvc-ui:3.2.0`), precedência `Ordered.HIGHEST_PRECEDENCE` no `GlobalExceptionHandler` e padronização RFC 7807.
  - **Passo 6 (`MasterDataIntegrationTest.java`, `application-test.properties`):** Criada suíte de integração com Flyway + H2 em modo PostgreSQL (`ddl-auto=validate`) validando criação hierárquica, paginação/ordenação/pesquisa textual, colisão de QR Code (HTTP 409 + constraint UNIQUE), inativação lógica preservando histórico, bloqueio de vínculos inativos, Bean Validation, RBAC e geração de `/v3/api-docs`. Suíte completa do backend (`FieldOpsBackendApplicationTests`, `AuthControllerTest` e `MasterDataIntegrationTest`) aprovada com 18/18 testes passando.

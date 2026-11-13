# TASK-009: Modelagem de Templates de Inspeção, Versionamento Imutável e Snapshots na API

## 1. Metadados
- **ID:** TASK-009
- **Épico / Módulo:** Backend API / Modelos de Inspeção
- **Status:** IN_REVIEW
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/modelo-de-dados.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/modelo-de-dados.md), [docs/regras-de-negocio.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/regras-de-negocio.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
Os modelos de checklist são a espinha dorsal da padronização operacional do FieldOps. Um modelo pode ser editado livremente enquanto em rascunho. Porém, ao ser publicado para uso em campo, sua versão torna-se imutável. Alterações estruturais posteriores geram uma nova versão (`version = N + 1`), garantindo que inspeções agendadas anteriormente mantenham fidelidade absoluta aos itens contratados na época através de um snapshot desnormalizado.

---

## 3. Arquivos Impactados
- `backend/src/main/resources/db/migration/V2__templates_and_snapshots_schema.sql` (Tabelas de templates, versões, seções e itens)
- `backend/src/main/java/com/fieldops/modules/template/domain/InspectionTemplate.java` (Entidade mestre do modelo)
- `backend/src/main/java/com/fieldops/modules/template/domain/TemplateVersion.java` (Versão publicada ou rascunho)
- `backend/src/main/java/com/fieldops/modules/template/domain/TemplateSection.java` (Seção de checklist)
- `backend/src/main/java/com/fieldops/modules/template/domain/TemplateItem.java` (Item individual de resposta)
- `backend/src/main/java/com/fieldops/modules/template/controller/TemplateController.java` (Endpoints REST)
- `backend/src/main/java/com/fieldops/modules/template/service/TemplateService.java` (Regras de publicação e snapshot)
- `backend/src/test/java/com/fieldops/modules/template/TemplateLifecycleTest.java` (Testes de integração)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Criação e edição livre de templates em estado `RASCUNHO` por supervisor ou administrador (RN-015, RN-018, AC-TEMPLATE).
- **RF-02:** Todo item de checklist deve possuir um tipo de resposta válido suportado no MVP (`TEXT_SHORT`, `TEXT_LONG`, `NUMBER`, `BOOLEAN`, `CONFORMITY`, `SINGLE_CHOICE`, `DATE`, `PHOTO`) (RN-016, RN-023, AC-TEMPLATE).
- **RF-03:** Seções e itens devem ter ordenação sequencial explícita (`order_index`) (RN-017).
- **RF-04:** Bloquear publicação se o modelo não possuir ao menos uma seção com item válido (RN-015, AC-TEMPLATE).
- **RF-05:** Ao publicar, gerar versão imutável numerada (`version = 1, 2, ...`) (RN-019, RN-020, AC-TEMPLATE).
- **RF-06:** Alterações em modelo publicado devem gerar nova versão, preservando o snapshot e histórico das anteriores (RN-020, RN-021).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar enum tipado para os tipos de resposta aceitos no backend e frontend.
- **RT-02:** Armazenar opções de seleção única (`SINGLE_CHOICE`) como JSONB estruturado.
- **RT-03:** Transação atômica (`@Transactional`) na publicação para congelar a árvore completa de seções e itens.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de alterar itens de versão já publicada (`status = PUBLISHED`) deve retornar HTTP 422 Unprocessable Entity com orientação para criar nova versão.
- **EX-02:** Publicação de template sem itens cadastrados retorna HTTP 400 informando pendências.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Criar tabelas SQL Flyway para templates, seções, itens e versionamento.
- [x] **Passo 2:** Implementar entidades JPA com cascade e ordenação explícita (`@OrderBy("orderIndex ASC")`).
- [x] **Passo 3:** Implementar serviço de publicação garantindo validações de integridade e imutabilidade.
- [x] **Passo 4:** Criar endpoints REST `/api/v1/inspection-templates` para CRUD de rascunhos, publicação e histórico de versões.
- [x] **Passo 5:** Criar serviço gerador de Snapshot de itens para consumo posterior pelo módulo de agendamento.
- [x] **Passo 6:** Escrever testes de integração cobrindo o ciclo de rascunho, publicação, validação de itens vazios e criação de nova versão.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Um modelo em rascunho com seções e itens é publicado com sucesso recebendo `version = 1`.
- [x] **CA-02:** Uma versão publicada rejeita modificações diretas em seus itens.
- [x] **CA-03:** Ao editar uma versão publicada, uma nova versão é iniciada mantendo a anterior inalterada.
- [x] **CA-04:** Todos os 7 tipos de resposta obrigatórios são aceitos e validados.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Migration Flyway (`V3__templates_and_snapshots_schema.sql`):** Criada como `V3` (pois `V1__init_auth_schema.sql` e `V2__init_master_schema.sql` já existiam no diretório de migrations) em `backend/src/main/resources/db/migration/V3__templates_and_snapshots_schema.sql`, contemplando as tabelas `inspection_templates`, `template_versions`, `template_sections` e `template_items`, incluindo coluna `options_json JSONB`, chaves estrangeiras, restrições `CHECK` (para status e os 8 tipos de resposta do MVP), índices e constraints de unicidade.
- **Domínio JPA e Enum Tipado (`com.fieldops.modules.template.domain`):**
  - Enums `ResponseType` (`TEXT_SHORT`, `TEXT_LONG`, `NUMBER`, `BOOLEAN`, `CONFORMITY`, `SINGLE_CHOICE`, `DATE`, `PHOTO`), `TemplateStatus` (`DRAFT`, `PUBLISHED`, `INACTIVE`) e `TemplateVersionStatus` (`DRAFT`, `PUBLISHED`).
  - Entidades `InspectionTemplate`, `TemplateVersion`, `TemplateSection` e `TemplateItem` com relacionamentos em cascata (`CascadeType.ALL`, `orphanRemoval = true`), `@OrderBy("versionNumber ASC")` nas versões e `@OrderBy("orderIndex ASC")` em seções e itens, além de mapeamento `@JdbcTypeCode(SqlTypes.JSON)` em `TemplateItem.options` para `options_json` (`jsonb`) e helper `TemplateJsonSupport`.
- **Regras de Negócio, Exceções e Snapshots (`com.fieldops.modules.template.service` e `exception`):**
  - `TemplateService`: criação e atualização livre apenas em versões `DRAFT` por `ADMIN` ou `SUPERVISOR`; publicação atômica (`@Transactional`) gerando `versionNumber` sequencial imutável; rejeição de edição direta em modelo/versão publicada com HTTP 422 (`PUBLISHED_VERSION_IMMUTABLE`); bloqueio de publicação sem seções/itens válidos ou `SINGLE_CHOICE` sem opções via `TemplatePublishValidationException` (HTTP 400 `TEMPLATE_PUBLISH_PENDING` com lista de `pendencies` tratada no `GlobalExceptionHandler`); criação de nova versão `N + 1` clonando ou substituindo a árvore sem alterar versões anteriores; suporte a inativação/reativação lógica.
  - `TemplateSnapshotService`: geração de snapshot desnormalizado ordenado (`TemplateSnapshotResponse` / `TemplateItemSnapshotDto`) a partir de versões publicadas para consumo via API e pelo futuro módulo de agendamento (`TASK-011`).
- **API REST (`TemplateController` em `/api/v1/inspection-templates`):**
  - Endpoints implementados para listagem paginada/filtrada (`GET`), consulta por ID (`GET /{id}`), criação de rascunho (`POST`), edição de rascunho (`PUT /{id}` e `PUT /{id}/versions/{versionNumber}`), publicação atômica (`POST /{id}/publish` e `PATCH /{id}/publish`), criação de nova versão (`POST /{id}/versions` e `/{id}/new-version`), histórico/detalhe de versões (`GET /{id}/versions` e `/{id}/versions/{versionNumber}`), geração de snapshots (`GET /{id}/snapshot` e `/{id}/versions/{versionNumber}/snapshot`) e inativação/reativação lógica (`DELETE /{id}`, `PATCH /{id}/deactivate`, `PATCH /{id}/activate`), com proteção RBAC (`ADMIN`/`SUPERVISOR` para escrita, autenticados para leitura) e anotações OpenAPI/Swagger.
- **Testes de Integração e Verificação (`TemplateLifecycleTest`):**
  - Criados 6 cenários de integração em `backend/src/test/java/com/fieldops/modules/template/TemplateLifecycleTest.java` cobrindo rascunho + ordenação + publicação v1, bloqueio de publicação com pendências (HTTP 400), imutabilidade de versão publicada (HTTP 422), evolução para versão N+1 preservando histórico e snapshots, suporte aos 8 `ResponseType` do MVP + `SINGLE_CHOICE` em JSONB + rejeição de tipo inválido, RBAC, unicidade de código (HTTP 409), inativação/reativação lógica e exposição no `/v3/api-docs`.
  - Suíte executada após a última alteração com `.\backend\mvnw.cmd test -f backend/pom.xml "-Djava.version=23"` (JDK `23.0.1` instalado no ambiente vs `java.version=26` no `pom.xml`): **24 testes executados, 0 falhas, 0 erros, 0 ignorados** (`FieldOpsBackendApplicationTests`: 1; `AuthControllerTest`: 10; `MasterDataIntegrationTest`: 7; `TemplateLifecycleTest`: 6).

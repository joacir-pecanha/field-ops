# TASK-008: Telas de Gestão Administrativa de Clientes, Locais e Equipamentos

## 1. Metadados
- **ID:** TASK-008
- **Épico / Módulo:** Web Admin / Cadastros Mestres
- **Status:** IN_PROGRESS
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/mobile/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/mobile/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente (Checkpoint Passos 4 e 5 aguardando validação humana)

---

## 2. Contexto e Valor de Negócio
Supervisores e administradores necessitam de uma interface eficiente para cadastrar, editar e consultar a estrutura de clientes, unidades/locais e parques de equipamentos. A interface deve permitir a geração visual do QR Code único para fixação física nos equipamentos e fornecer mecanismos claros de filtragem e inativação de registros.

---

## 3. Arquivos Impactados
- `web/src/app/core/master/master-data.models.ts` (Contratos tipados compatíveis com OpenAPI e mapeamento de erros RFC 7807)
- `web/src/app/core/master/users-api.service.ts` (Serviço HTTP de Usuários)
- `web/src/app/core/master/clients-api.service.ts` (Serviço HTTP de Clientes)
- `web/src/app/core/master/sites-api.service.ts` (Serviço HTTP de Locais)
- `web/src/app/core/master/equipment-api.service.ts` (Serviço HTTP de Equipamentos e consulta por QR Code)
- `web/src/app/core/master/master-async.validators.ts` (Validadores assíncronos de unicidade)
- `web/src/app/core/master/master-data.services.spec.ts` (Testes unitários dos serviços HTTP e mapeamento 409)
- `web/src/app/pages/api-docs/api-docs-validation.component.ts` (Interface Swagger UI & Console de testes dos endpoints)
- `web/src/app/pages/users/users-list.component.ts` / `.html` (Gestão de usuários e perfis)
- `web/src/app/pages/clients/clients-list.component.ts` / `.html` (Listagem e cadastro de clientes)
- `web/src/app/pages/sites/sites-list.component.ts` / `.html` (Listagem e cadastro de locais)
- `web/src/app/pages/equipment/equipment-list.component.ts` / `.html` (Gestão de equipamentos)
- `web/src/app/shared/components/pagination/pagination.component.ts` (Componente de paginação)
- `web/src/app/shared/styles/master-crud.scss` & `web/src/app/shared/utils/form-error.utils.ts` (Estilos compartilhados e utilitários de formulário)
- `web/src/app/pages/equipment/components/qr-code-modal.component.ts` *(Passo 4 — Modal QR Code Canvas HD / SVG / PNG / Impressão)*
- `web/src/app/pages/equipment/components/qr-code-modal.component.spec.ts` *(Testes unitários do componente de QR Code)*
- `web/src/app/shared/components/confirm-modal/confirm-modal.component.ts` *(Passo 5 — Modal reutilizável de confirmação de inativação com suporte EX-01)*
- `web/src/app/shared/components/confirm-modal/confirm-modal.component.spec.ts` *(Testes unitários do modal de confirmação)*
- `web/package.json` & `web/angular.json` *(Dependência `qrcode` / `@types/qrcode` e whitelist CommonJS)*
- `backend/src/main/java/com/fieldops/config/OpenApiConfig.java` & `DevBootstrapSeedConfig.java` (Swagger UI interativo e massa inicial de validação)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Listar Clientes, Locais e Equipamentos com suporte a busca textual por nome, documento ou código (AC-MASTER).
- **RF-02:** Ao cadastrar/editar um Local, exigir a seleção obrigatória de um Cliente ativo (RN-009).
- **RF-03:** Ao cadastrar/editar um Equipamento, permitir selecionar somente Locais pertencentes ao Cliente selecionado (RN-010, RN-014).
- **RF-04:** Gerar QR Code único com base no identificador/código do equipamento e permitir impressão ou download em imagem (AC-MASTER, RN-011). *(Passo 4)*
- **RF-05:** Inativação de registros mediante confirmação explícita em modal com alerta sobre impedimento em novas inspeções (DoD 18.3, RN-013). *(Passo 5)*

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar paginação no cliente integrada aos parâmetros `page`, `size` e `sort` da API (DoD 18.3).
- **RT-02:** Tratamento dos estados de carregamento (skeletons / spinners), estado vazio amigável e exibição de erros 400/409 (DoD 18.3).
- **RT-03:** Validação em tempo real dos formulários com mensagens claras de erro por campo.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de inativar cliente com inspeções ativas deve exibir modal informativo com confirmação adicional. *(Passo 5)*
- **EX-02:** Erro de colisão de código QR retornado pela API deve ser destacado diretamente no campo com feedback visual em vermelho.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Criar serviços HTTP no frontend para consumo dos endpoints de Users, Clients, Sites e Equipment.
- [x] **Passo 2:** Implementar interface Swagger para validação humana e testes do funcionamento destes endpoints (com paginação e tabelas ordenáveis integradas à API).
- [x] **Passo 3:** Desenvolver formulários reativos para criação e edição com validações assíncronas.
- [x] **Passo 4:** Implementar componente de geração de QR Code usando biblioteca de renderização em Canvas/SVG (ex: `qrcode`).
- [x] **Passo 5:** Integrar modais de confirmação para ações críticas de inativação.
- [ ] **Passo 6:** Escrever testes de componentes para as telas de listagem e formulários. *(Aguardando validação humana dos Passos 4–5)*

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Administrador consegue cadastrar um fluxo completo: Cliente -> Local -> Equipamento com QR Code gerado.
- [x] **CA-02:** Seleção de Local filtra automaticamente apenas os equipamentos vinculados a ele. *(Filtro encadeado entregue no Passo 3)*
- [x] **CA-03:** O QR Code gerado pode ser visualizado e impresso em alta definição.
- [x] **CA-04:** Nenhuma ação crítica de inativação ocorre sem diálogo de confirmação.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **2026-11-13 (Coder Agent — Checkpoint Passos 1 a 3 para Validação Humana):**
  - **Passo 1 (Serviços HTTP Tipados & Validadores Assíncronos):**
    - Criados os modelos `master-data.models.ts` alinhados aos DTOs Java (`PageResponse`, `UserCreateRequest`/`UserUpdateRequest`/`UserResponse`, `ClientRequest`/`ClientResponse`, `SiteRequest`/`SiteResponse`, `EquipmentRequest`/`EquipmentResponse`) e mapeador RFC 7807 `mapMasterDataHttpError` (`MasterDataApiError` com extração de `fieldErrors` para HTTP 400 e códigos `DUPLICATE_QR_CODE`, `DUPLICATE_EMAIL`, `DUPLICATE_CLIENT_CODE`, `DUPLICATE_SITE_CODE`, `INACTIVE_CLIENT`, `INACTIVE_SITE`).
    - Implementados `UsersApiService`, `ClientsApiService`, `SitesApiService` e `EquipmentApiService` em `web/src/app/core/master/` e validadores assíncronos com debounce (`350ms`) em `master-async.validators.ts` (`uniqueUserEmailValidator`, `uniqueClientCodeValidator`, `uniqueSiteCodeValidator`, `uniqueEquipmentQrCodeValidator`).
  - **Passo 2 (Interface Swagger UI & Paginação/Listagens):**
    - Backend (`application.properties`, `OpenApiConfig.java`, `AuthController.java`, `LoginRequest.java`): configurada ordenação por tag/método no Swagger UI (`/swagger-ui.html`), persistência de autorização Bearer, exemplos prontos de login e documentação de todos os endpoints de autenticação e cadastros mestres; criado `DevBootstrapSeedConfig.java` (`@Profile("!test")`) garantindo usuários padrão (`admin@fieldops.com`, `supervisor@fieldops.com`, `tecnico@fieldops.com` com senha `FieldOps@123`) e massa inicial de 2 clientes, 2 locais e 3 equipamentos (`QR-FIELDOPS-GD001`, `QR-FIELDOPS-CP002`, `QR-FIELDOPS-TR003`) para validação imediata.
    - Frontend (`api-docs-validation.component.ts` em `/app/api-docs`): criada tela **Swagger / API** com cópia em 1 clique do token Bearer JWT da sessão, atalho/iframe para `/swagger-ui.html` e `/v3/api-docs`, além de console de teste direto dos 4 serviços HTTP e busca por QR Code.
    - Criado `PaginationComponent` (`web/src/app/shared/components/pagination/pagination.component.ts`) integrado aos parâmetros `page`, `size` e `sort` da API.
  - **Passo 3 (Telas CRUD com Formulários Reativos & Validações Assíncronas):**
    - **Usuários (`/app/users` — `UsersListComponent`):** listagem paginada/ordenável, busca e filtros por perfil/situação, criação e edição com validador assíncrono de e-mail único, senha obrigatória apenas na criação e mapeamento de erros 400/409 por campo.
    - **Clientes (`/app/clients` — `ClientsListComponent`):** listagem paginada/ordenável, busca por nome/razão social/documento/código, atalho para os locais do cliente e formulário com validador assíncrono de código único.
    - **Locais (`/app/sites` e `/app/clients/:clientId/sites` — `SitesListComponent`):** seleção obrigatória de **Cliente ativo** (RF-02, RN-009), validador assíncrono de código único por cliente (revalidado ao trocar o cliente), validação em tempo real de UF/CEP/latitude/longitude/telefone e atalho para equipamentos do local.
    - **Equipamentos (`/app/equipment` e `/app/sites/:siteId/equipment` — `EquipmentListComponent`):** filtro encadeado Cliente -> Local na listagem e no formulário (carregando apenas locais ativos pertencentes ao cliente selecionado — RF-03, RN-010, RN-014), botão **"Sugerir QR Único"**, validador assíncrono em tempo real via `/api/v1/equipments/qr/{qrCode}` e destaque visual em **vermelho vivo** (`#ff1744` / `.input-qr-collision` + `.field-error-vivid`) em colisões de QR Code detectadas assincronamente ou retornadas pela API com HTTP 409 (`EX-02`).
    - Rotas configuradas com lazy loading (`loadComponent`) em `web/src/app/app.routes.ts`.
  - **Validações executadas neste checkpoint:**
    - Frontend `npm --prefix web run typecheck`: aprovado.
    - Frontend `npm --prefix web run build`: aprovado (bundle inicial reduzido para `385.86 kB`).
    - Frontend `npm --prefix web run test:ci`: **35/35 testes aprovados** (incluindo `master-data.services.spec.ts`).
    - Backend `.\backend\mvnw.cmd -f backend\pom.xml test -o -Dmaven.compiler.release=23`: **18/18 testes aprovados** (`FieldOpsBackendApplicationTests`, `AuthControllerTest`, `MasterDataIntegrationTest`).
    - **Ponto de atenção de ambiente local:** `backend/pom.xml` declara `<java.version>26</java.version>`, enquanto esta máquina possui **JDK 23** (`C:\Program Files\Java\jdk-23`), exigindo `-Dmaven.compiler.release=23` ao compilar/executar localmente com JDK 23.
  - **Roteiro rápido para Validação Humana (Joacir Peçanha):**
    1. Subir o PostgreSQL e iniciar o backend (`cd backend; .\mvnw.cmd spring-boot:run -Dmaven.compiler.release=23` se estiver no JDK 23) e o frontend (`cd web; npm start`).
    2. Acessar `http://localhost:4200/login` com `admin@fieldops.com` / `FieldOps@123`.
    3. Abrir **Swagger / API** (`/app/api-docs`) para testar os endpoints diretamente pelos serviços ou abrir `http://localhost:8080/swagger-ui.html` colando o JWT copiado em **Authorize**.
    4. Validar layout, responsividade, paginação, busca, filtros encadeados e validações em tempo real/assíncronas em **Usuários**, **Clientes**, **Locais** e **Equipamentos** (incluindo teste de colisão digitando `QR-FIELDOPS-GD001` no campo QR Code).
    5. Após sua aprovação de design e comportamento, seguiremos para os **Passos 4, 5 e 6** (Modal de QR Code em alta definição + impressão/download, Modais de confirmação de inativação com alerta EX-01 e testes unitários de componentes).
- **2026-11-13 (Coder Agent — Checkpoint Passos 4 e 5 para Validação Humana):**
  - **Passo 4 (Componente de Geração de QR Code — Canvas HD / SVG Vetorial / Impressão):**
    - Instalada a biblioteca `qrcode` (`^1.5.4`) e `@types/qrcode` (`^1.5.6`) no pacote `web/`, configurando `allowedCommonJsDependencies` em `web/angular.json`.
    - Criado `QrCodeModalComponent` (`web/src/app/pages/equipment/components/qr-code-modal.component.ts`) com alternância entre renderização **Canvas HD** (`QRCode.toCanvas`, correção de erro nível `H`) e **SVG Vetorial** (`QRCode.toString`), além de prévia completa da etiqueta patrimonial (Equipamento, Código, Cliente, Local, Patrimônio, Nº de Série e chip do QR Code).
    - Implementadas ações de **Copiar Código**, **Baixar SVG** (vetorial), **Baixar PNG HD** (etiqueta composta em alta resolução `1080x1320` com QR Code `1024px`) e **Imprimir Etiqueta** (layout limpo de impressão com SVG vetorial).
    - Integrado em `EquipmentListComponent` pelo clique direto no chip do QR Code da listagem, pelo botão **QR Code** na linha da tabela e pelo botão **Visualizar QR** ao lado de **Sugerir QR Único** no formulário de cadastro/edição.
  - **Passo 5 (Modais de Confirmação para Ações Críticas de Inativação):**
    - Criado `ConfirmModalComponent` (`web/src/app/shared/components/confirm-modal/confirm-modal.component.ts`) reutilizável com `role="alertdialog"`, aviso de impacto operacional (`RN-013`, `RN-088`), banner de alerta de vínculos ativos (`EX-01`) e suporte a confirmação adicional explícita via checkbox (`requireExtraConfirmation`).
    - Adicionados estilos compartilhados de modal e botões de ação crítica (`.btn-danger`, `.btn-danger-outline`, `.modal-backdrop`, `.modal-card`) em `web/src/app/shared/styles/master-crud.scss`.
    - Integrado nas 4 telas administrativas (`ClientsListComponent`, `SitesListComponent`, `EquipmentListComponent` e `UsersListComponent`), cobrindo tanto os botões **Inativar**/**Reativar** na tabela quanto a mudança de situação para `INACTIVE`/`DECOMMISSIONED`/`BLOCKED` dentro dos formulários de edição (`CA-04`):
      - **Clientes (`EX-01`):** consulta locais ativos vinculados via `SitesApiService.listByClient` e exige marcação do checkbox de confirmação adicional antes de inativar.
      - **Locais:** consulta equipamentos ativos vinculados via `EquipmentApiService.list` exibindo alerta específico quando há equipamentos ativos associados.
      - **Equipamentos:** confirma inativação ou descomissionamento alertando sobre bloqueio em novas inspeções (`RN-012`).
      - **Usuários:** confirma inativação ou bloqueio alertando sobre revogação imediata de sessões (`RN-008`).
  - **Validações executadas neste checkpoint:**
    - Frontend `npm --prefix web run typecheck`: aprovado.
    - Frontend `npm --prefix web run build`: aprovado (bundle inicial `392.69 kB`, sem warnings CommonJS).
    - Frontend `npm --prefix web run test:ci`: **41/41 testes aprovados** (incluindo `qr-code-modal.component.spec.ts` e `confirm-modal.component.spec.ts`).
  - **Roteiro para Validação Humana (Passos 4 e 5):**
    1. Acessar **Equipamentos** (`/app/equipment`), clicar no chip do QR Code ou no botão **QR Code** de um item (ou preencher um QR Code no formulário e clicar em **Visualizar QR**), alternar entre **Canvas HD** e **SVG Vetorial** e testar **Copiar Código**, **Baixar SVG**, **Baixar PNG HD** e **Imprimir Etiqueta**.
    2. Em **Clientes**, **Locais**, **Equipamentos** e **Usuários**, testar o fluxo de **Inativar** (na linha da tabela e alterando a situação no formulário de edição), verificando o bloqueio da confirmação adicional em Clientes (`EX-01`) e a ação **Reativar**.
    3. Após sua aprovação destes fluxos visuais, seguiremos para o **Passo 6** (testes unitários completos das telas de listagem e formulários) e encerramento da `TASK-008`.

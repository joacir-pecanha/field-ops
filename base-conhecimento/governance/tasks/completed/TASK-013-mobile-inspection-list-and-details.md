# TASK-013: Interface Mobile de Listagem de Inspeções Atribuídas e Detalhes Offline

## 1. Metadados
- **ID:** TASK-013
- **Épico / Módulo:** Mobile / Inspeções & Navegação
- **Status:** COMPLETED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md), [docs/aplicativo_mobile.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/aplicativo_mobile.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-11-14

---

## 2. Contexto e Valor de Negócio
O técnico em campo precisa de uma interface ágil e clara para visualizar sua carga de trabalho diária. As inspeções baixadas durante a sincronização devem permanecer disponíveis offline em SQLite. A tela deve apresentar informações críticas de forma direta (cliente, endereço do local, equipamento, prioridade, data limite) e permitir navegação rápida para iniciar ou continuar o checklist.

---

## 3. Arquivos Impactados
- `mobile/src/infrastructure/database/types.ts` (Tipos de filtros, métricas, ação dinâmica e detalhes)
- `mobile/src/infrastructure/database/repositories/inspectionRepository.ts` (Consultas tipadas `findWithFilters`, `findByIdWithDetails`, `getSummaryMetrics`, `upsertMany` e helpers de domínio)
- `mobile/src/features/inspections/hooks/useInspectionList.ts` (Hook reativo e controladores offline-first de listagem e refresh resiliente)
- `mobile/src/features/inspections/hooks/useInspectionDetails.ts` (Hook reativo de detalhes offline, cálculo de progresso e guarda de permissão)
- `mobile/src/features/inspections/components/InspectionCard.tsx` (Card reutilizável com `PriorityBadge`, `SyncStatusBadge` e diferenciação visual)
- `mobile/src/features/inspections/index.ts` (Exportações do módulo `inspections`)
- `mobile/__tests__/features/inspections/InspectionCard.test.tsx` (Testes unitários de renderização do card e badges)
- `mobile/__tests__/features/inspections/InspectionScreens.test.tsx` e `mobile/__tests__/features/inspections/sqliteTestDb.ts` (Testes de renderização de `HomeScreen`, `InspectionsScreen` e `InspectionDetailsScreen` integrados ao SQLite em memória)
- `mobile/__tests__/features/inspections/inspections.test.ts` (Testes de repositório SQLite e lógica dos hooks)
- `mobile/__tests__/mocks/expo-router.mjs`, `mobile/__tests__/mocks/expo-vector-icons.mjs` e `mobile/__tests__/ts-loader.mjs` (Suporte a renderização de rotas/ícones e resolução ESM nos testes)
- `mobile/src/app/(protected)/(tabs)/index.tsx` (Painel operacional do técnico com contadores em tempo real e sincronização rápida)
- `mobile/src/app/(protected)/(tabs)/inspections.tsx` (Lista de inspeções com busca textual, abas de estado, chips e pull-to-refresh offline-first)
- `mobile/src/app/(protected)/inspections/[inspectionId]/index.tsx` (Detalhes offline com equipamento/QR, endereço, progresso, guarda de permissão e botão dinâmico)
- `mobile/src/app/(protected)/inspections/_layout.tsx` (Registro da rota dinâmica `[inspectionId]/index`)
- `mobile/src/infrastructure/sync/networkMonitor.ts` e `mobile/metro.config.js` (Suporte de health-check `/actuator/health` e cabeçalhos WASM para validação Web)
- `mobile/src/features/auth/services/authStorage.ts`, `mobile/src/app/(protected)/(tabs)/profile.tsx` e `mobile/__tests__/auth/authStorage.test.ts` (Fallback seguro para `localStorage`/memória e confirmações Web durante validação no Expo Web)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Exibir apenas inspeções atribuídas ao técnico autenticado (RN-004, AC-MOBILE-LIST).
- **RF-02:** A listagem deve apresentar estado, prioridade, data prevista, cliente e local da atividade (AC-MOBILE-LIST).
- **RF-03:** Diferenciação visual clara entre inspeções atrasadas, em andamento e pendentes de envio (AC-MOBILE-LIST).
- **RF-04:** Filtragem local por estado (`TODAS`, `PENDENTES`, `EM_ANDAMENTO`, `CONCLUÍDAS`) e busca por texto (AC-MOBILE-LIST).
- **RF-05:** Tela de detalhes apresentando informações do equipamento (nome, código, QR Code previsto), endereço completo e botão de ação dinâmico ("Iniciar Inspeção", "Continuar Checklist" ou "Consultar") (AC-MOBILE-LIST).
- **RF-06:** Funcionamento 100% offline para inspeções previamente baixadas no SQLite (RN-065, AC-MOBILE-LIST).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Leitura primária em SQLite via repositório local sem bloquear a interface em caso de indisponibilidade de rede.
- **RT-02:** Tratamento de estado vazio amigável ("Nenhuma inspeção atribuída no momento") ao invés de mensagens de erro (AC-MOBILE-LIST).
- **RT-03:** Preservação de dados locais intactos mesmo se a chamada de refresh falhar na rede (AC-MOBILE-LIST).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de abrir inspeção que pertence a outro usuário deve retornar aviso de permissão negada e retornar à lista.
- **EX-02:** Em caso de falha de conexão durante o pull-to-refresh, exibir um snackbar discreto mantendo os dados da tela inalterados.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Criar consultas tipadas em `inspectionRepository.ts` para listagem com filtros e busca por ID.
- [x] **Passo 2:** Desenvolver hooks reativos `useInspectionList` e `useInspectionDetails` integrados ao SQLite.
- [x] **Passo 3:** Implementar o componente reutilizável `InspectionCard` com badges de prioridade e status.
- [x] **Passo 4:** Criar a tela `(tabs)/index.tsx` com contadores de hoje, atrasadas e botão rápido de sincronizar.
- [x] **Passo 5:** Criar a tela de lista `(tabs)/inspections.tsx` com tabs e busca.
- [x] **Passo 6:** Criar a tela de detalhes `[inspectionId]/index.tsx`.
- [x] **Passo 7:** Escrever testes de renderização com Jest e React Native Testing Library.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** A lista exibe as inspeções atribuídas ordenadas por data com dados carregados do SQLite local.
- [x] **CA-02:** Desativar a conexão de rede no dispositivo/emulador e navegar entre lista e detalhes sem nenhuma lentidão ou falha.
- [x] **CA-03:** O botão de ação altera de "Iniciar" para "Continuar" quando o status é `EM_ANDAMENTO`.
- [x] **CA-04:** `npx tsc --noEmit` executa sem erros.
- [x] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **2026-11-14 (Checkpoint Passos 1 a 3 — Aguardando Validação Humana):**
  - **Passo 1 (`types.ts` e `inspectionRepository.ts`):**
    - Adicionados tipos `InspectionFilterTab`, `InspectionFilterParams`, `InspectionSummaryMetrics`, `InspectionActionType`, `InspectionActionConfig` e `InspectionDetailsData` em `mobile/src/infrastructure/database/types.ts` sem alterar o DDL da versão 1 do SQLite (`SCHEMA_V1_DDL`).
    - Implementados em `inspectionRepository.ts` os métodos `findWithFilters` (filtros por abas `TODAS`/`PENDENTES`/`EM_ANDAMENTO`/`CONCLUÍDAS`, busca textual por cliente/local/endereço/equipamento/código/QR Code, prioridade, atraso e técnico atribuído, ordenados por `due_date ASC`), `findByIdWithDetails` (carregando seções, itens, respostas, evidências, fila Outbox, cálculo de progresso e ação dinâmica via `resolveInspectionAction`), `getSummaryMetrics` e `upsertMany` (preservando registros com pendências locais de sincronização na Outbox ou `sync_status !== 'SINCRONIZADO'`).
  - **Passo 2 (`useInspectionList.ts` e `useInspectionDetails.ts`):**
    - Implementado `useInspectionList` com leitura primária no SQLite (100% funcional offline), filtro por técnico autenticado via `useAuth()`, tratamento de estado vazio amigável (`"Nenhuma inspeção atribuída no momento"`), pull-to-refresh integrado a `GET /api/v1/inspections/assigned` e preservação dos dados locais com snackbar discreto em falhas de rede (`OFFLINE_REFRESH_SNACKBAR_MESSAGE`).
    - Implementado `useInspectionDetails` com leitura offline no SQLite, exposição estruturada de equipamento (`name`, `code`, `qrCode`), endereço completo (`site`), progresso do checklist, ação dinâmica (`"Iniciar Inspeção"` / `"Continuar Checklist"` / `"Consultar"`) e guarda de propriedade bloqueando acesso a inspeções de outro usuário (`EX-01`, `PERMISSION_DENIED_MESSAGE`).
  - **Passo 3 (`InspectionCard.tsx`):**
    - Implementado `InspectionCard` memoizado com `PriorityBadge`, `SyncStatusBadge` e `StatusBadge`, exibindo cliente, local/endereço, equipamento/código, data limite e diferenciação visual explícita (ícones + textos + borda lateral) para inspeções atrasadas (`EM ATRASO`), em andamento (`EM EXECUÇÃO`) e pendentes de envio (`Pendente de envio` / `Falha no envio` / `Conflito de envio`).
  - **Evidências de Verificação:**
    - `npx --prefix mobile tsc -p mobile/tsconfig.json --noEmit`: aprovado (código de saída 0, zero erros).
    - `npm --prefix mobile test`: **104/104 testes aprovados** (29 suítes, 0 falhas), incluindo 19 novos testes dedicados em `InspectionCard.test.tsx` (6) e `inspections.test.ts` (13) executados sobre SQLite real em memória (`node:sqlite`) e `renderToStaticMarkup`.
- **2026-11-14 (Checkpoint Passos 4 a 6 — Aguardando Validação Humana para Passo 7):**
  - **Snapshots & Rota `[inspectionId]`:**
    - Adicionado `syncRemoteSnapshots` em `inspectionRepository.ts` e integrado a `refreshInspectionsFromRemote`, `loadInspectionDetails` e `refreshInspectionDetails`, persistindo seções/itens do backend com normalização de `response_type` (ex.: `PHOTO` -> `TEXT_SHORT`) sem alterar `migrations.ts`.
    - Renomeada a rota dinâmica de `inspections/[id]` para `inspections/[inspectionId]` e atualizado `inspections/_layout.tsx` e `.expo/types/router.d.ts`.
    - Ajustados `networkMonitor.ts` (`/actuator/health`) e `metro.config.js` (headers COOP/COEP) para operação fluida também via Expo Web.
  - **Passo 4 (`(tabs)/index.tsx`):**
    - Painel inicial com saudação personalizada ao usuário autenticado, indicador Online/Offline, grade 2x2 de contadores clicáveis (`Para hoje`, `Atrasadas`, `Em andamento`, `Pendentes de envio`), botão rápido `Sincronizar Dados` (Outbox + pull remoto), preview de até 3 `InspectionCard` prioritários, pull-to-refresh e snackbar discreto em falhas de rede.
  - **Passo 5 (`(tabs)/inspections.tsx`):**
    - Listagem virtualizada (`FlatList`) sobre SQLite com `InspectionCard`, busca textual local com limpar, abas `Todas`, `Pendentes`, `Em andamento` e `Concluídas` com contadores, chips `Atrasadas` / `Para hoje`, estado vazio amigável (`"Nenhuma inspeção atribuída no momento"`) e snackbar discreto preservando dados em falhas offline.
  - **Passo 6 (`inspections/[inspectionId]/index.tsx`):**
    - Detalhes completos 100% offline com equipamento, código, QR Code previsto, unidade, endereço completo, prazos, instruções, progresso e preview de seções/itens; tratamento de permissão negada (`EX-01`) retornando à lista; e botão de ação dinâmico (`"Iniciar Inspeção"` -> transição local para `EM_ANDAMENTO` / `"Continuar Checklist"` -> `"Consultar"`).
  - **Evidências de Verificação:**
    - `npx --prefix mobile tsc -p mobile/tsconfig.json --noEmit`: aprovado (código de saída 0, zero erros).
    - `npm --prefix mobile test`: **105/105 testes aprovados** (29 suítes, 0 falhas), incluindo teste de persistência e normalização de snapshots em `syncRemoteSnapshots`.
- **2026-11-14 (Checkpoint Final Passo 7 — TASK-013 Concluída):**
  - **Passo 7 (`InspectionScreens.test.tsx` e infraestrutura de testes):**
    - Adicionado suporte opcional de injeção de estado inicial (`initialData`) em `useInspectionList` e `useInspectionDetails`, além de props opcionais nas telas (`HomeScreenProps`, `InspectionsScreenProps`, `InspectionDetailsScreenProps`), mantendo o comportamento em produção inalterado.
    - Criado mock determinístico `mobile/__tests__/mocks/expo-router.mjs` e atualizado `mobile/__tests__/ts-loader.mjs` para resolução de `expo-router` e transpilação de `sync`/`database`.
    - Criada a suíte `mobile/__tests__/features/inspections/InspectionScreens.test.tsx` (compartilhando `sqliteTestDb.ts` com `inspections.test.ts`), executada no runner padrão do projeto (`node --test` + `renderToStaticMarkup` sobre `react-native-web` + `node:sqlite`, equivalente ao ecossistema Jest/RNTL já que Jest/RNTL não estão instalados no `mobile/package.json`), cobrindo os 10 cenários de renderização e fluxo offline de `HomeScreen`, `InspectionsScreen` e `InspectionDetailsScreen` (saudação, contadores SQLite, ordenação/filtros, estados vazios, snackbar offline, QR Code/endereço, botão dinâmico `Iniciar Inspeção` -> `Continuar Checklist` -> `Consultar` e bloqueio `EX-01`).
  - **Validação Web Adicional:**
    - Corrigido fallback Web de `authStorage.ts` (`localStorage`/memória) para erro `ExpoSecureStore.default.setValueWithKeyAsync is not a function` e fluxo de logout Web em `profile.tsx`, com cobertura em `authStorage.test.ts`.
  - **Evidências Finais de Verificação:**
    - `npx --prefix mobile tsc -p mobile/tsconfig.json --noEmit`: aprovado (código de saída 0, zero erros).
    - `npm --prefix mobile test`: **116/116 testes aprovados** (33 suítes, 0 falhas).
    - Funcionalidades dos Passos 1 a 6 validadas pelo aprovador Joacir Peçanha (`CA-01` a `CA-05` concluídos).
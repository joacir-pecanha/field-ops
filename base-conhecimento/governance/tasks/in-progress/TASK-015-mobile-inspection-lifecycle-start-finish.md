# TASK-015: Ciclo de Vida da Inspeção (Início, Geolocalização, Validação Obrigatória e Conclusão)

## 1. Metadados
- **ID:** TASK-015
- **Épico / Módulo:** Mobile / Ciclo de Vida da Inspeção
- **Status:** IN_REVIEW
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md), [docs/fluxo_geral.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/fluxo_geral.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
A transição de estados de uma inspeção em campo requer garantia de rastreabilidade e integridade. Ao iniciar a inspeção, o aplicativo registra a data/hora exata do dispositivo e obtém as coordenadas geográficas pontuais. Durante a execução, todas as respostas são salvas localmente. Ao solicitar a conclusão, o sistema valida se todos os itens obrigatórios foram respondidos e se as evidências exigidas foram anexadas, bloqueando edições posteriores e enfileirando o encerramento na Outbox.

---

## 3. Arquivos Impactados
- `mobile/src/features/inspections/services/inspectionLifecycleService.ts` (Serviço de transição de estados e validações)
- `mobile/src/features/location/services/locationService.ts` (Captura pontual de latitude, longitude e precisão)
- `mobile/src/features/inspections/hooks/useInspectionProgress.ts` (Cálculo de percentual de preenchimento e pendências)
- `mobile/src/app/(protected)/inspections/[inspectionId]/summary.tsx` (Tela de resumo pré-conclusão)
- `mobile/src/features/inspections/components/PendingItemsModal.tsx` (Lista de pendências obrigatórias bloqueantes)
- `mobile/__tests__/features/inspections/inspectionLifecycleService.test.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Somente inspeções atribuídas ao técnico logado podem ser iniciadas (RN-032, RN-033, AC-START).
- **RF-02:** Ao iniciar, registrar data e hora do dispositivo (`started_at`) e tentar capturar localização GPS (RN-034, RN-061, AC-START).
- **RF-03:** Transição local imediata para o estado `EM_ANDAMENTO` e criação de operação na Outbox (AC-START).
- **RF-04:** Calcular dinamicamente o progresso da inspeção: itens respondidos vs itens aplicáveis (RN-040, AC-CHECKLIST).
- **RF-05:** Antes de concluir, validar se todos os itens marcados como `required = true` foram respondidos (RN-037, AC-COMPLETE).
- **RF-06:** Se houver pendências obrigatórias, bloquear a conclusão e exibir a lista de itens pendentes com atalho para preenchimento (AC-COMPLETE).
- **RF-07:** Ao confirmar conclusão válida, registrar `completed_at`, capturar GPS de conclusão, marcar inspeção como `ENVIADA` localmente ("Aguardando Sincronização") e bloquear edição de respostas (RN-042, RN-043, AC-COMPLETE).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar `expo-location` para captura pontual, nunca rastreamento em segundo plano ou contínuo no MVP (RN-060, AC-LOCATION).
- **RT-02:** Armazenar latitude, longitude, precisão em metros e timestamp da captura no banco SQLite (RN-062).
- **RT-03:** Salvar cada alteração confirmada no SQLite local de forma atômica (RN-041).
- **RT-04:** Gerar UUID idempotente para as operações de início (`START_INSPECTION`) e conclusão (`COMPLETE_INSPECTION`) na Outbox.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Se a permissão de GPS for negada ou o sinal estiver indisponível, permitir iniciar e concluir registrando a ausência de coordenadas sem travar a aplicação (RN-059, AC-START, AC-LOCATION).
- **EX-02:** Inspeção concluída em modo offline exibe status "Aguardando Sincronização" mantendo o checklist em modo somente leitura (RN-043, AC-COMPLETE).

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Implementar `locationService.ts` com chamada a `getCurrentPositionAsync` e timeouts seguros.
- [x] **Passo 2:** Desenvolver `useInspectionProgress.ts` para contabilizar itens totais, respondidos e pendentes obrigatórios.
- [x] **Passo 3:** Implementar métodos `startInspection` e `completeInspection` em `inspectionLifecycleService.ts`.
- [x] **Passo 4:** Criar a tela de resumo `summary.tsx` exibindo contadores de respostas, não conformidades e evidências.
- [x] **Passo 5:** Integrar o modal de bloqueio `PendingItemsModal.tsx` quando existirem pendências obrigatórias.
- [x] **Passo 6:** Escrever testes unitários para cálculo de progresso, validação de bloqueio e geração de Outbox.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Iniciar inspeção altera estado para `EM_ANDAMENTO`, salva timestamp e cria registro de início na outbox.
- [x] **CA-02:** Tentar concluir com item obrigatório não preenchido bloqueia a ação e indica os itens pendentes.
- [x] **CA-03:** Concluir inspeção 100% preenchida bloqueia os inputs de resposta e enfileira a operação de encerramento.
- [x] **CA-04:** Coordenadas GPS são gravadas no SQLite quando a permissão for concedida.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Dependências e Permissões (`mobile/package.json` e `mobile/app.json`):**
  - Adicionados `expo-location` (`~57.0.22`), `react-native-webview` (`13.16.1`), `leaflet` (`^1.9.4`) e `@types/leaflet` (`^1.9.12`) compatíveis com Expo SDK 57.
  - Configurado plugin `expo-location` em `mobile/app.json` exclusivamente com `locationWhenInUsePermission`, sem permissões de rastreamento em segundo plano (`RT-01`, `RN-060`).
- **Passo 1 — `locationService.ts` (`mobile/src/features/location/services/locationService.ts`):**
  - Implementadas `captureCurrentLocation` / `getCurrentPositionSafe` com solicitação de permissão em primeiro plano, verificação de serviços de localização e `getCurrentPositionAsync` protegido por timeout seguro (`DEFAULT_LOCATION_TIMEOUT_MS = 8000`ms). Recusa de permissão, GPS desativado ou timeout retornam estrutura segura sem lançar exceções bloqueantes (`EX-01`, `RN-059`).
  - Implementados `buildOsmLeafletHtml` e o componente multiplataforma `OsmLeafletMap` utilizando OpenStreetMap + Leaflet sem chave Google Maps: `react-native-webview` em dispositivos nativos (Android/iOS) e `leaflet` diretamente no DOM em navegadores Web (com fallback estruturado em SSR).
- **Passo 2 — `useInspectionProgress.ts` (`mobile/src/features/inspections/hooks/useInspectionProgress.ts`):**
  - Implementados `calculateInspectionProgress`, `isChecklistItemAnswered` e o hook reativo `useInspectionProgress` calculando dinamicamente itens aplicáveis vs respondidos, percentual, pendências obrigatórias ordenadas por seção/item, não conformidades e evidências (`RF-04`, `RF-05`, `RN-040`).
- **Passo 3 — `inspectionLifecycleService.ts` (`mobile/src/features/inspections/services/inspectionLifecycleService.ts`):**
  - Implementados `startInspection`, `completeInspection`, `saveChecklistResponse`, `getInspectionLocations`, `ensureInspectionLocationsTable` e `isInspectionReadOnly` com execução em transações atômicas no SQLite (`RT-03`, `RN-041`).
  - Criada tabela auxiliar `inspection_locations` (etapas `START` e `COMPLETE`) gravando `latitude`, `longitude`, `accuracy`, `captured_at`, `permission_status`, `available` e `fallback_reason` sem quebrar a versão 1 de `migrations.ts` (`RT-02`, `CA-04`, `EX-01`).
  - Geração de UUID v4 idempotente na fila `outbox_operations` para `START_INSPECTION`, `SUBMIT_RESPONSE` e `COMPLETE_INSPECTION` (com dependências explícitas para operações pendentes anteriores), além de bloqueio estrito contra edições pós-conclusão (`READ_ONLY_INSPECTION`, `CA-03`, `EX-02`).
- **Passos 4 e 5 — `summary.tsx`, `PendingItemsModal.tsx` e integração (`mobile/src/app/(protected)/inspections/[inspectionId]/index.tsx`):**
  - Criada tela pré-conclusão `summary.tsx` (registrada em `_layout.tsx` e `router.d.ts`) exibindo progresso, contadores de respostas, obrigatórios pendentes, não conformidades, evidências, timestamps, coordenadas + mapa OpenStreetMap/Leaflet e banner `"Aguardando Sincronização"` em modo somente leitura após conclusão (`EX-02`).
  - Integrado `PendingItemsModal.tsx` exibindo itens obrigatórios bloqueantes com atalho direto (`"Preencher"`) para focar e destacar o item pendente no checklist (`RF-06`, `CA-02`).
- **Passo 6 — Testes Unitários & Verificações (`mobile/__tests__/features/inspections/inspectionLifecycleService.test.ts`):**
  - Adicionados mocks `mobile/__tests__/mocks/expo-location.mjs` e `mobile/__tests__/mocks/react-native-webview.mjs` em `mobile/__tests__/ts-loader.mjs`.
  - `node mobile\node_modules\typescript\bin\tsc -p mobile\tsconfig.json --noEmit` -> Exit code `0` (`0` erros de tipagem).
  - `npm --prefix mobile test` -> Exit code `0` (`142/142` testes aprovados em `40` suítes, `0` falhas, incluindo 11 novos testes para `locationService`, `calculateInspectionProgress`, `inspectionLifecycleService`, `PendingItemsModal` e `summary.tsx`).

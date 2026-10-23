# TASK-002: Implementar Motor de Sincronização Outbox com Idempotência

## 1. Metadados
- **ID:** TASK-002
- **Épico / Módulo:** Mobile / Sincronização & Resiliência
- **Status:** COMPLETED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-002-mobile-outbox-sync.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-002-mobile-outbox-sync.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-10-23

---

## 2. Contexto e Valor de Negócio
O técnico de campo opera rotineiramente em áreas sem cobertura de internet móvel. Esta tarefa constrói o motor da Outbox no aplicativo, responsável por monitorar o estado de conectividade, enfileirar operações com UUIDs idempotentes e despachar lotes de mutações assim que a conexão for restabelecida ou sob comando manual.

---

## 3. Arquivos Impactados
- `mobile/src/infrastructure/sync/outboxEngine.ts` (Motor principal de envio e retentativas)
- `mobile/src/infrastructure/sync/networkMonitor.ts` (Detector de conectividade)
- `mobile/src/features/sync/useSyncStatus.ts` (Hook reativo para feedback visual na UI)
- `mobile/src/app/(protected)/(tabs)/sync.tsx` (Interface de acompanhamento da sincronização)
- `mobile/__tests__/sync/outboxEngine.test.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos
- **RF-01:** Exibir na tela de sincronização a quantidade de operações pendentes, sincronizadas ou com erro.
- **RF-02:** Permitir disparo manual de sincronização através de botão "Sincronizar Agora".
- **RT-01:** Cada requisição de envio deve incluir UUID idempotente para garantir que reenvios acidentais não dupliquem dados no backend.
- **RT-02:** Erros de rede temporários não devem descartar a operação; o status permanece `PENDING` ou `ERROR` com contagem incremental de `retries`.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Criar o monitor de conectividade (`networkMonitor.ts`).
- [x] **Passo 2:** Implementar a lógica de envio em lote e atualização de status em `outboxEngine.ts`.
- [x] **Passo 3:** Criar o hook de estado `useSyncStatus.ts` integrando com Zustand e SQLite.
- [x] **Passo 4:** Atualizar a tela `sync.tsx` para apresentar métricas reais de sincronização.
- [x] **Passo 5:** Criar testes unitários para os cenários online, offline e falha de rede.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Operações pendentes são despachadas com sucesso ao simular conexão online.
- [x] **CA-02:** Em caso de falha de conexão, nenhuma operação é removida da tabela `outbox_operations`.
- [x] **CA-03:** A UI de sincronização exibe claramente o estado atual (ex: "Sincronizado", "3 operações pendentes").
- [x] **CA-04:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Detector de Conectividade (`networkMonitor.ts`):**
  - Implementada a classe `NetworkMonitor` com detecção ativa (ping HTTP com AbortController timeout), verificação de `navigator.onLine` e mecanismo de pub/sub (`subscribe`) para emissão reativa de eventos.
  - Adicionado suporte a mock de conectividade (`setMockStatus`) para viabilizar testes unitários determinísticos e alternância de simulação offline diretamente na interface do app.
- **Motor de Sincronização Outbox (`outboxEngine.ts`):**
  - Implementado o despachante de mutações em lote (`POST /api/v1/sync/batch`) com injeção de dependências (`OutboxRepository`, `InspectionRepository`, `NetworkMonitor`, `SyncApiClient`).
  - **Idempotência (RT-01):** Cada operação carrega seu UUID v4 original (`operation_id`). Casos em que a API retorna código `ALREADY_PROCESSED` são tratados como sucesso sem duplicação.
  - **Resiliência e Retentativas (RT-02):** Em falhas temporárias de rede (exceções de conexão/timeout), nenhuma operação é descartada. O contador `retries` é incrementado atomicamente e o status permanece `ERROR`/`PENDING` no SQLite.
  - **Tratamento de Conflito:** Rejeições permanentes de regra de negócio (`CONFLICT`) atualizam a operação e o status da entidade local (`Inspection.sync_status = 'CONFLITO'`).
  - **Ordenação Causal e Dependências (RN-069):** O algoritmo `resolveBatchWithDependencies` garante que operações dependentes (ex: `COMPLETE_INSPECTION` dependendo de `START_INSPECTION` ou `SUBMIT_RESPONSE`) só sejam enviadas após a confirmação das anteriores.
  - **Proteção de Concorrência:** Implementado bloqueio contra sincronizações simultâneas disparadas por múltiplos cliques do usuário.
- **Hook Reativo e Estado (`useSyncStatus.ts`):**
  - Criada store Zustand v5 (`useSyncStore`) sincronizada com o SQLite durável e listener do `NetworkMonitor`.
  - Expõe contadores reativos (`pendingCount`, `syncedCount`, `errorCount`), flags (`isSyncing`, `isOnline`), timestamp e mensagem da última sincronização, além das funções `syncNow()` e `refreshStatus()`.
- **Interface de Sincronização (`sync.tsx`):**
  - Totalmente reescrita sobre os tokens do design system do FieldOps, exibindo:
    - Indicador de rede ativo (Online / Offline) com botão de simulação rápida.
    - Cartão de estado geral (Hero) com feedback dinâmico ("Sincronizado", "X operações pendentes", "Enviando...").
    - Métricas em cartões destacados (Pendentes, Sincronizadas, Com Falha).
    - Botão de ação "Sincronizar Agora" com estado de carregamento acessível.
    - Listagem detalhada das operações na fila outbox exibindo tipo, identificador idempotente UUID, badges de status, contagem de retries e mensagem de erro quando aplicável.
    - Suporte a pull-to-refresh nativo.
- **Testes Unitários & Validação de Guardrails:**
  - Criado `mobile/__tests__/sync/outboxEngine.test.ts` com 7 testes unitários abrangentes:
    1. Despacho online com UUIDs idempotentes e atualização de status de inspeção (CA-01).
    2. Comportamento offline garantindo que nenhuma operação é deletada (CA-02).
    3. Falhas transitórias de conexão com incremento de `retries` e status `ERROR` (RT-02).
    4. Reenvio idempotente com tratamento de `ALREADY_PROCESSED` (RT-01, RN-068).
    5. Falha parcial em lote com isolamento de operações (RN-070).
    6. Sequenciamento estrito por dependências (RN-069).
    7. Bloqueio de concorrência com compartilhamento de promessa ativa.
  - **Resultados:**
    - `npm test`: 20/20 testes unitários passando (100% de sucesso).
    - `npx tsc --noEmit`: 0 erros de tipagem estática.

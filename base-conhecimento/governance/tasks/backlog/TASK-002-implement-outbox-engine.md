# TASK-002: Implementar Motor de Sincronização Outbox com Idempotência

## 1. Metadados
- **ID:** TASK-002
- **Épico / Módulo:** Mobile / Sincronização & Resiliência
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-002-mobile-outbox-sync.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-002-mobile-outbox-sync.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

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
- [ ] **Passo 1:** Criar o monitor de conectividade (`networkMonitor.ts`).
- [ ] **Passo 2:** Implementar a lógica de envio em lote e atualização de status em `outboxEngine.ts`.
- [ ] **Passo 3:** Criar o hook de estado `useSyncStatus.ts` integrando com Zustand e SQLite.
- [ ] **Passo 4:** Atualizar a tela `sync.tsx` para apresentar métricas reais de sincronização.
- [ ] **Passo 5:** Criar testes unitários para os cenários online, offline e falha de rede.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Operações pendentes são despachadas com sucesso ao simular conexão online.
- [ ] **CA-02:** Em caso de falha de conexão, nenhuma operação é removida da tabela `outbox_operations`.
- [ ] **CA-03:** A UI de sincronização exibe claramente o estado atual (ex: "Sincronizado", "3 operações pendentes").
- [ ] **CA-04:** Aprovação de Joacir Peçanha.

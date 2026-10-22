# SPEC-002: Motor de Sincronização e Outbox Pattern

## 1. Metadados
- **ID:** SPEC-002
- **Módulo:** Mobile / Sincronização & Resiliência
- **Status:** APPROVED
- **Responsável Humano:** Joacir Peçanha
- **Autor:** Planner Agent
- **Documentos de Referência:** [docs/arquitetura.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/arquitetura.md), [docs/fluxo_geral.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/fluxo_geral.md)

---

## 2. Visão Geral
O padrão **Transactional Outbox** garante que nenhuma alteração realizada pelo técnico em campo seja perdida, mesmo com quedas bruscas de energia, falhas de sinal ou reinicialização do dispositivo.

---

## 3. Funcionamento da Fila Outbox

### 3.1 Ciclo de Vida de uma Operação
1. **Enfileiramento Local:** Sempre que o técnico executa uma mutação (ex: salvar resposta do checklist), o registro de domínio e a operação na outbox são inseridos **na mesma transação SQLite**.
2. **Identificador Idempotente:** O `id` da operação é um UUID v4 gerado no cliente. A API REST utiliza esse identificador como chave de idempotência (`X-Idempotency-Key` ou campo payload), impedindo duplicações em reenvios.
3. **Ordenação por Dependência:** Operações com dependências declaradas (ex: enviar resposta antes de completar inspeção; enviar metadados antes da confirmação de upload da foto) são processadas em sequência estrita.
4. **Execução em Lote:** O motor envia lotes de operações estruturadas via POST `/api/v1/sync/batch`.
5. **Retentativa com Backoff Exponencial:** Falhas transitórias de rede incrementam o contador `retries` e definem o status como `PENDING` para a próxima tentativa; falhas permanentes de negócio (ex: inspeção já cancelada) marcam o status como `CONFLICT`.

---

## 4. Contratos de Tipos e Schemas (TypeScript)

```typescript
export type OutboxStatus = 'PENDING' | 'SYNCING' | 'ERROR' | 'CONFLICT';

export type OutboxOperationType = 
  | 'START_INSPECTION'
  | 'SUBMIT_RESPONSE'
  | 'UPLOAD_EVIDENCE'
  | 'COMPLETE_INSPECTION';

export interface OutboxOperation {
  id: string; // UUID v4 idempotente
  entity_type: 'INSPECTION' | 'CHECKLIST_RESPONSE' | 'EVIDENCE';
  global_id: string;
  operation_type: OutboxOperationType;
  payload: string; // JSON serializado
  dependencies?: string[]; // IDs de operações que devem ser concluídas antes
  status: OutboxStatus;
  retries: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncBatchResponse {
  processed: {
    operation_id: string;
    success: boolean;
    error_code?: string;
    message?: string;
  }[];
}
```

---

## 5. Tarefas Associadas
- [TASK-002](file:///c:/Users/Joacir/Desktop/field-ops/governance/tasks/backlog/TASK-002-implement-outbox-engine.md): Implementação do Motor de Outbox e Sincronização.

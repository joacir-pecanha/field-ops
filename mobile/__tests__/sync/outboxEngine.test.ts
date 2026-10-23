import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../../src/infrastructure/database/migrations';
import { InspectionRepository } from '../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../src/infrastructure/database/repositories/outboxRepository';
import { NetworkMonitor } from '../../src/infrastructure/sync/networkMonitor';
import {
  OutboxEngine,
  type SyncApiClient,
  type SyncBatchRequest,
} from '../../src/infrastructure/sync/outboxEngine';
import type { SyncBatchResponse } from '../../src/infrastructure/database/types';

/**
 * Cria uma instância de SQLiteDatabase em memória para testes nativos.
 */
function createTestSqliteDb(): SQLiteDatabase {
  const rawDb = new DatabaseSync(':memory:');

  const adapter: Partial<SQLiteDatabase> = {
    async execAsync(source: string) {
      rawDb.exec(source);
    },
    async runAsync(source: string, ...params: any[]) {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const stmt = rawDb.prepare(source);
      const result = stmt.run(...flatParams);
      return {
        lastInsertRowId: Number(result.lastInsertRowid ?? 0),
        changes: Number(result.changes ?? 0),
      };
    },
    async getFirstAsync<T>(source: string, ...params: any[]) {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const stmt = rawDb.prepare(source);
      const row = stmt.get(...flatParams);
      return (row as T) ?? null;
    },
    async getAllAsync<T>(source: string, ...params: any[]) {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const stmt = rawDb.prepare(source);
      const rows = stmt.all(...flatParams);
      return (rows as T[]) ?? [];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      rawDb.exec('BEGIN;');
      try {
        await task();
        rawDb.exec('COMMIT;');
      } catch (err) {
        rawDb.exec('ROLLBACK;');
        throw err;
      }
    },
    async closeAsync() {
      rawDb.close();
    },
  };

  return adapter as SQLiteDatabase;
}

class MockSyncApiClient implements SyncApiClient {
  public dispatchedBatches: SyncBatchRequest[] = [];
  public mockResponse?: SyncBatchResponse;
  public shouldThrowNetworkError: boolean = false;
  public networkErrorMessage: string = 'Network request failed';

  async sendBatch(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    this.dispatchedBatches.push(batch);

    if (this.shouldThrowNetworkError) {
      throw new Error(this.networkErrorMessage);
    }

    if (this.mockResponse) {
      return this.mockResponse;
    }

    // Resposta padrão: todas as operações do lote foram processadas com sucesso
    return {
      processed: batch.operations.map((op) => ({
        operation_id: op.id,
        success: true,
      })),
    };
  }
}

describe('Motor de Sincronização Outbox (SPEC-002 / TASK-002)', () => {
  let db: SQLiteDatabase;
  let outboxRepo: OutboxRepository;
  let inspectionRepo: InspectionRepository;
  let networkMonitor: NetworkMonitor;
  let mockApiClient: MockSyncApiClient;
  let engine: OutboxEngine;

  beforeEach(async () => {
    db = createTestSqliteDb();
    await runMigrations(db);

    outboxRepo = new OutboxRepository(db);
    inspectionRepo = new InspectionRepository(db);
    networkMonitor = new NetworkMonitor({ initialOnline: true });
    networkMonitor.setMockStatus(true);
    mockApiClient = new MockSyncApiClient();

    engine = new OutboxEngine({
      outboxRepository: outboxRepo,
      inspectionRepository: inspectionRepo,
      networkMonitor,
      apiClient: mockApiClient,
      autoSyncOnReconnect: false,
    });
  });

  test('CA-01: Operações pendentes são despachadas com sucesso e com UUIDs idempotentes ao simular conexão online', async () => {
    // 1. Cria uma inspeção base com sync_status = PENDENTE
    await inspectionRepo.create({
      id: 'insp-001',
      template_id: 'tmpl-1',
      client_name: 'Cliente Alpha',
      site_name: 'Usina 1',
      equipment_name: 'Turbina A',
      status: 'EM_ANDAMENTO',
      sync_status: 'PENDENTE',
    });

    // 2. Enfileira 2 operações outbox com UUIDs v4
    await outboxRepo.create({
      id: 'b6f2f3e8-5b1e-4f1a-b6b8-1d2a3c4e5f60',
      entity_type: 'INSPECTION',
      global_id: 'insp-001',
      operation_type: 'START_INSPECTION',
      payload: JSON.stringify({ started_at: '2026-10-23T14:00:00Z' }),
      status: 'PENDING',
    });

    await outboxRepo.create({
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
      entity_type: 'CHECKLIST_RESPONSE',
      global_id: 'resp-001',
      operation_type: 'SUBMIT_RESPONSE',
      payload: JSON.stringify({ item_id: 'item-1', value: 'CONFORME' }),
      status: 'PENDING',
    });

    assert.equal(await outboxRepo.countPending(), 2);

    // 3. Executa a sincronização
    const result = await engine.sync();

    // 4. Validações
    assert.equal(result.success, true);
    assert.equal(result.processedCount, 2);
    assert.equal(result.failedCount, 0);

    // As operações foram removidas da tabela outbox_operations
    assert.equal(await outboxRepo.countPending(), 0);

    // O cliente enviou exatamente 1 lote contendo os 2 UUIDs idempotentes
    assert.equal(mockApiClient.dispatchedBatches.length, 1);
    const sentOperations = mockApiClient.dispatchedBatches[0].operations;
    assert.equal(sentOperations.length, 2);
    assert.equal(sentOperations[0].id, 'b6f2f3e8-5b1e-4f1a-b6b8-1d2a3c4e5f60');
    assert.equal(sentOperations[1].id, 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d');

    // A inspeção foi atualizada para SINCRONIZADO
    const updatedInspection = await inspectionRepo.findById('insp-001');
    assert.equal(updatedInspection?.sync_status, 'SINCRONIZADO');
  });

  test('CA-02: Em caso de ausência de rede (OFFLINE), nenhuma operação é removida da tabela outbox_operations', async () => {
    // 1. Simula estado offline
    networkMonitor.setMockStatus(false);

    // 2. Enfileira operação
    await outboxRepo.create({
      id: 'op-offline-1',
      entity_type: 'INSPECTION',
      global_id: 'insp-off',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
      retries: 0,
    });

    // 3. Dispara sincronização
    const result = await engine.sync();

    // 4. Validações
    assert.equal(result.success, false);
    assert.equal(result.reason, 'OFFLINE');
    assert.equal(mockApiClient.dispatchedBatches.length, 0, 'Nenhuma requisição deve ser feita à API');

    // Operação permanece intacta no SQLite com status PENDING
    const op = await outboxRepo.findById('op-offline-1');
    assert.ok(op);
    assert.equal(op?.status, 'PENDING');
    assert.equal(op?.retries, 0);
  });

  test('RT-02: Erro temporário de rede (queda de conexão) incrementa retries e mantém operação em ERROR sem descartá-la', async () => {
    // 1. Configura a API para simular queda de conexão / timeout
    mockApiClient.shouldThrowNetworkError = true;
    mockApiClient.networkErrorMessage = 'Failed to connect to /192.168.1.100:8080: Connection timed out';

    // 2. Enfileira operação
    await outboxRepo.create({
      id: 'op-network-fail',
      entity_type: 'INSPECTION',
      global_id: 'insp-fail',
      operation_type: 'COMPLETE_INSPECTION',
      payload: JSON.stringify({ completed_at: '2026-10-23T15:00:00Z' }),
      status: 'PENDING',
      retries: 0,
    });

    // 3. Executa a sincronização
    const result = await engine.sync();

    // 4. Validações
    assert.equal(result.success, false);
    assert.equal(result.reason, 'NETWORK_ERROR');
    assert.equal(result.processedCount, 0);
    assert.equal(result.failedCount, 1);

    // Operação não foi excluída! Permanece com retries = 1 e status ERROR
    const op = await outboxRepo.findById('op-network-fail');
    assert.ok(op, 'Operação deve continuar existindo na tabela outbox_operations');
    assert.equal(op?.status, 'ERROR');
    assert.equal(op?.retries, 1);
    assert.ok(op?.error_message?.includes('Connection timed out'));
  });

  test('RT-01 & RN-068: Reenvio de operação já processada (ALREADY_PROCESSED) é tratado com sucesso idempotente', async () => {
    await outboxRepo.create({
      id: 'op-already-synced',
      entity_type: 'INSPECTION',
      global_id: 'insp-dup',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
    });

    // API responde que a operação já foi recebida anteriormente no servidor
    mockApiClient.mockResponse = {
      processed: [
        {
          operation_id: 'op-already-synced',
          success: false,
          error_code: 'ALREADY_PROCESSED',
          message: 'Operação já processada anteriormente',
        },
      ],
    };

    const result = await engine.sync();

    assert.equal(result.success, true);
    assert.equal(result.processedCount, 1);

    // A operação é removida da fila do cliente sem erro
    assert.equal(await outboxRepo.countPending(), 0);
  });

  test('RN-070: Falha parcial no lote — operação com erro é mantida e operação com sucesso é removida', async () => {
    await outboxRepo.create({
      id: 'op-success',
      entity_type: 'INSPECTION',
      global_id: 'insp-1',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
    });

    await outboxRepo.create({
      id: 'op-bad-request',
      entity_type: 'CHECKLIST_RESPONSE',
      global_id: 'resp-bad',
      operation_type: 'SUBMIT_RESPONSE',
      payload: 'invalid-json',
      status: 'PENDING',
    });

    // API aprova a primeira e rejeita a segunda
    mockApiClient.mockResponse = {
      processed: [
        {
          operation_id: 'op-success',
          success: true,
        },
        {
          operation_id: 'op-bad-request',
          success: false,
          error_code: 'VALIDATION_ERROR',
          message: 'Payload inválido',
        },
      ],
    };

    const result = await engine.sync();

    assert.equal(result.success, false);
    assert.equal(result.processedCount, 1);
    assert.equal(result.failedCount, 1);

    // op-success foi removida
    assert.equal(await outboxRepo.findById('op-success'), null);

    // op-bad-request foi mantida com retries incrementado
    const failedOp = await outboxRepo.findById('op-bad-request');
    assert.ok(failedOp);
    assert.equal(failedOp?.status, 'ERROR');
    assert.equal(failedOp?.retries, 1);
    assert.equal(failedOp?.error_message, 'Payload inválido');
  });

  test('RN-069: Ordenação e respeito a dependências declaradas', async () => {
    // op-2 depende de op-1
    await outboxRepo.create({
      id: 'op-1',
      entity_type: 'INSPECTION',
      global_id: 'insp-dep',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
    });

    await outboxRepo.create({
      id: 'op-2',
      entity_type: 'INSPECTION',
      global_id: 'insp-dep',
      operation_type: 'COMPLETE_INSPECTION',
      payload: '{}',
      dependencies: ['op-1'],
      status: 'PENDING',
    });

    await engine.sync();

    assert.equal(mockApiClient.dispatchedBatches.length, 1);
    const sent = mockApiClient.dispatchedBatches[0].operations;
    assert.equal(sent[0].id, 'op-1', 'op-1 deve ser despachada antes');
    assert.equal(sent[1].id, 'op-2', 'op-2 deve vir após a dependência');
  });

  test('Proteção contra concorrência: chamadas paralelas compartilham a mesma execução em andamento', async () => {
    let resolveBatch: (value: SyncBatchResponse) => void;
    const delayedPromise = new Promise<SyncBatchResponse>((resolve) => {
      resolveBatch = resolve;
    });

    mockApiClient.sendBatch = async (batch: SyncBatchRequest) => {
      mockApiClient.dispatchedBatches.push(batch);
      return delayedPromise;
    };

    await outboxRepo.create({
      id: 'op-concurrent',
      entity_type: 'INSPECTION',
      global_id: 'insp-conc',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
    });

    // Dispara duas sincronizações simultâneas
    const sync1 = engine.sync();
    const sync2 = engine.sync();

    assert.equal(engine.getIsSyncing(), true);

    // Libera a resposta da API
    resolveBatch!({
      processed: [{ operation_id: 'op-concurrent', success: true }],
    });

    const [res1, res2] = await Promise.all([sync1, sync2]);

    assert.equal(res1.success, true);
    assert.equal(res2.success, true);
    // Apenas 1 requisição foi enviada à API
    assert.equal(mockApiClient.dispatchedBatches.length, 1);
  });
});

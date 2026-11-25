import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../../src/infrastructure/database/migrations';
import { clearLocalDatabaseData } from '../../src/infrastructure/database/db';
import { InspectionRepository } from '../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../src/infrastructure/database/repositories/outboxRepository';
import { ApiClient } from '../../src/infrastructure/http/apiClient';
import { NetworkMonitor } from '../../src/infrastructure/sync/networkMonitor';
import {
  HttpSyncApiClient,
  OutboxEngine,
  type SyncApiClient,
  type SyncBatchRequest,
} from '../../src/infrastructure/sync/outboxEngine';
import {
  buildEvidenceUploadFormData,
  createNativeMultipartFilePart,
} from '../../src/infrastructure/sync/evidenceMultipart';
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

  test('Priorização: operações PENDING não ficam bloqueadas por operações antigas em ERROR e deleteFailed limpa apenas falhas', async () => {
    const limitedEngine = new OutboxEngine({
      outboxRepository: outboxRepo,
      inspectionRepository: inspectionRepo,
      networkMonitor,
      apiClient: mockApiClient,
      batchSize: 1,
      autoSyncOnReconnect: false,
    });

    await outboxRepo.create({
      id: 'op-old-error',
      entity_type: 'INSPECTION',
      global_id: 'insp-old',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'ERROR',
      retries: 5,
      error_message: 'Inspeção não encontrada',
      created_at: '2026-11-15T11:52:11.000Z',
    });

    await outboxRepo.create({
      id: 'op-old-conflict',
      entity_type: 'INSPECTION',
      global_id: 'insp-old-conflict',
      operation_type: 'COMPLETE_INSPECTION',
      payload: '{}',
      status: 'CONFLICT',
      retries: 1,
      error_message: 'Conflito permanente',
      created_at: '2026-11-15T11:55:00.000Z',
    });

    await outboxRepo.create({
      id: 'op-new-pending',
      entity_type: 'INSPECTION',
      global_id: 'insp-new',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
      created_at: '2026-11-24T11:00:00.000Z',
    });

    const result = await limitedEngine.sync();

    assert.equal(result.success, true);
    assert.equal(result.processedCount, 1);
    assert.equal(mockApiClient.dispatchedBatches[0].operations[0].id, 'op-new-pending');
    assert.equal(await outboxRepo.findById('op-new-pending'), null);
    assert.ok(await outboxRepo.findById('op-old-error'));

    // Recria uma PENDING para validar que deleteFailed() remove ERROR e CONFLICT mantendo PENDING
    await outboxRepo.create({
      id: 'op-keep-pending',
      entity_type: 'INSPECTION',
      global_id: 'insp-keep',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
    });

    await outboxRepo.deleteFailed();

    assert.equal(await outboxRepo.findById('op-old-error'), null);
    assert.equal(await outboxRepo.findById('op-old-conflict'), null);
    assert.ok(await outboxRepo.findById('op-keep-pending'));
  });

  test('HttpSyncApiClient renova token JWT automaticamente ao receber HTTP 401 e reenvia com X-Idempotency-Key', async () => {
    let currentAccessToken = 'expired-access-token';
    const calls: Array<{ url: string; auth?: string; idempotencyKey?: string }> = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url,
        auth: headers['Authorization'],
        idempotencyKey: headers['X-Idempotency-Key'],
      });

      if (url.endsWith('/api/v1/auth/refresh')) {
        return new Response(
          JSON.stringify({ accessToken: 'fresh-access-token', refreshToken: 'fresh-refresh-token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (headers['Authorization'] === 'Bearer expired-access-token') {
        return new Response(
          JSON.stringify({ status: 401, code: 'UNAUTHORIZED', detail: 'Token expirado' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ processed: [{ operation_id: 'op-401-retry', success: true }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const apiClientWith401 = new ApiClient({
      baseUrl: 'http://localhost:8080',
      getAccessToken: async () => currentAccessToken,
      getRefreshToken: async () => 'valid-refresh-token',
      onTokenRefreshed: async (tokens) => {
        currentAccessToken = tokens.accessToken;
      },
      customFetch: mockFetch,
    });

    const syncClient = new HttpSyncApiClient(undefined, undefined, apiClientWith401);
    const response = await syncClient.sendBatch({
      batch_id: 'batch-123',
      operations: [
        {
          id: 'op-401-retry',
          entity_type: 'INSPECTION',
          global_id: 'insp-123',
          operation_type: 'START_INSPECTION',
          payload: '{}',
          client_timestamp: '2026-11-24T12:00:00Z',
        },
      ],
    });

    assert.equal(response.processed.length, 1);
    assert.equal(response.processed[0].success, true);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].auth, 'Bearer expired-access-token');
    assert.equal(calls[1].url, 'http://localhost:8080/api/v1/auth/refresh');
    assert.equal(calls[2].auth, 'Bearer fresh-access-token');
    assert.equal(calls[2].idempotencyKey, 'batch-123');
  });

  test('clearLocalDatabaseData limpa inspeções e fila outbox respeitando foreign_keys = ON', async () => {
    await inspectionRepo.create({
      id: 'insp-clear-1',
      template_id: 'tmpl-1',
      client_name: 'Cliente X',
      site_name: 'Site Y',
      equipment_name: 'Gerador Z',
      status: 'ENVIADA',
      sync_status: 'ERRO',
    });

    await outboxRepo.create({
      id: 'op-clear-1',
      entity_type: 'INSPECTION',
      global_id: 'insp-clear-1',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'ERROR',
    });

    await clearLocalDatabaseData(db);

    assert.equal(await inspectionRepo.findById('insp-clear-1'), null);
    assert.equal(await outboxRepo.countPending(), 0);
    assert.equal((await outboxRepo.findAll()).length, 0);
  });

  test('ApiClient com FormData omite Content-Type JSON e preserva Authorization e X-Idempotency-Key', async () => {
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: unknown = null;

    const client = new ApiClient({
      baseUrl: 'http://localhost:8080',
      getAccessToken: async () => 'token-multipart-123',
      customFetch: async (_url, init) => {
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
        capturedBody = init?.body;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'foto.jpg');
    form.append('inspectionId', 'insp-1');

    const res = await client.post<{ ok: boolean }>('/api/v1/sync/upload', form, {
      headers: { 'X-Idempotency-Key': 'op-multipart-1' },
    });

    assert.equal(res.ok, true);
    assert.equal(capturedHeaders['Content-Type'], undefined);
    assert.equal(capturedHeaders['Authorization'], 'Bearer token-multipart-123');
    assert.equal(capturedHeaders['X-Idempotency-Key'], 'op-multipart-1');
    assert.ok(capturedBody instanceof FormData);
  });

  test('HttpSyncApiClient.uploadEvidence decodifica Data URL do armazenamento Web e envia multipart para /api/v1/sync/upload', async () => {
    const previousStorage = (globalThis as { localStorage?: Storage }).localStorage;
    const storageMap = new Map<string, string>();
    const webUri = 'fieldops-web://documents/evidences/ev-100.jpg';
    const tinyJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    storageMap.set(
      'fieldops:web_evidence_files:v1',
      JSON.stringify({
        [webUri]: {
          dataUrl: `data:image/jpeg;base64,${tinyJpegBase64}`,
          size: 120,
          createdAt: '2026-11-24T12:00:00Z',
        },
      })
    );

    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => void storageMap.set(k, v),
      removeItem: (k: string) => void storageMap.delete(k),
      clear: () => storageMap.clear(),
      key: (idx: number) => Array.from(storageMap.keys())[idx] ?? null,
      get length() {
        return storageMap.size;
      },
    };

    try {
      let calledUrl = '';
      const captured: { form: FormData | null; idempotency: string } = {
        form: null,
        idempotency: '',
      };

      const apiClient = new ApiClient({
        baseUrl: 'http://localhost:8080',
        getAccessToken: async () => 'jwt-tech',
        customFetch: async (input, init) => {
          calledUrl = typeof input === 'string' ? input : input.toString();
          captured.form = (init?.body as FormData) ?? null;
          captured.idempotency =
            ((init?.headers ?? {}) as Record<string, string>)['X-Idempotency-Key'] ?? '';
          return new Response(
            JSON.stringify({
              evidenceId: 'ev-100',
              status: 'UPLOADED',
              storageKey: 'insp-100/ev-100.jpg',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        },
      });

      const syncClient = new HttpSyncApiClient(undefined, undefined, apiClient);
      const response = await syncClient.uploadEvidence({
        operationId: 'op-ev-100',
        evidenceId: 'ev-100',
        inspectionId: 'insp-100',
        itemId: 'item-100',
        fileName: 'ev-100.jpg',
        mimeType: 'image/jpeg',
        localUri: webUri,
        clientTimestamp: '2026-11-24T12:00:00Z',
      });

      assert.equal(calledUrl, 'http://localhost:8080/api/v1/sync/upload');
      assert.equal(captured.idempotency, 'op-ev-100');
      assert.equal(response.status, 'UPLOADED');
      assert.ok(captured.form instanceof FormData);
      const form = captured.form;
      assert.equal(form.get('inspectionId'), 'insp-100');
      assert.equal(form.get('evidenceId'), 'ev-100');
      assert.equal(form.get('operationId'), 'op-ev-100');
      assert.equal(form.get('itemId'), 'item-100');
      const uploadedFile = form.get('file');
      assert.ok(uploadedFile instanceof Blob);
      assert.ok((uploadedFile as Blob).size > 0);
    } finally {
      (globalThis as { localStorage?: Storage }).localStorage = previousStorage;
    }
  });

  test('OutboxEngine envia UPLOAD_EVIDENCE via multipart na ordem causal (item -> batch JSON -> não conformidade) e atualiza status para UPLOADED', async () => {
    await inspectionRepo.create({
      id: 'insp-media-1',
      remote_id: 'remote-insp-media-1',
      template_id: 'tmpl-1',
      client_name: 'Indústria Alfa',
      site_name: 'Planta Sorocaba',
      equipment_name: 'Gerador GD-001',
      status: 'ENVIADA',
      sync_status: 'PENDENTE',
    });

    await db.runAsync(
      `INSERT INTO checklist_sections (id, inspection_id, title, order_index)
       VALUES (?, ?, ?, ?);`,
      ['sec-1', 'insp-media-1', 'Seção Visual', 0]
    );

    await db.runAsync(
      `INSERT INTO checklist_items (id, section_id, inspection_id, title, response_type, required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['snap-item-1', 'sec-1', 'insp-media-1', 'Lacre externo', 'CONFORMITY', 1, 0]
    );

    await db.runAsync(
      `INSERT INTO inspection_evidences (id, inspection_id, item_id, local_uri, file_size, mime_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['ev-item-1', 'insp-media-1', 'snap-item-1', 'file:///docs/ev-item-1.jpg', 1024, 'image/jpeg', 'PENDING']
    );

    await db.runAsync(
      `INSERT INTO inspection_evidences (id, inspection_id, item_id, local_uri, file_size, mime_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['ev-nc-1', 'insp-media-1', 'snap-item-1', 'file:///docs/ev-nc-1.jpg', 2048, 'image/jpeg', 'PENDING']
    );

    await outboxRepo.create({
      id: 'op-ev-item-1',
      entity_type: 'EVIDENCE',
      global_id: 'ev-item-1',
      operation_type: 'UPLOAD_EVIDENCE',
      payload: JSON.stringify({
        evidenceId: 'ev-item-1',
        inspectionId: 'insp-media-1',
        itemId: 'snap-item-1',
        fileName: 'ev-item-1.jpg',
        mimeType: 'image/jpeg',
      }),
      status: 'PENDING',
      created_at: '2026-11-24T12:01:00Z',
    });

    await outboxRepo.create({
      id: 'op-nc-create-1',
      entity_type: 'NON_CONFORMITY',
      global_id: 'nc-1',
      operation_type: 'CREATE_NON_CONFORMITY',
      payload: JSON.stringify({ id: 'nc-1', inspectionId: 'insp-media-1', title: 'Vazamento', severity: 'ALTA' }),
      status: 'PENDING',
      created_at: '2026-11-24T12:02:00Z',
    });

    await outboxRepo.create({
      id: 'op-ev-nc-1',
      entity_type: 'EVIDENCE',
      global_id: 'ev-nc-1',
      operation_type: 'UPLOAD_EVIDENCE',
      payload: JSON.stringify({
        evidenceId: 'ev-nc-1',
        inspectionId: 'insp-media-1',
        itemId: 'snap-item-1',
        nonConformityId: 'nc-1',
        fileName: 'ev-nc-1.jpg',
        mimeType: 'image/jpeg',
      }),
      status: 'PENDING',
      created_at: '2026-11-24T12:03:00Z',
    });

    const timeline: string[] = [];
    const customApi: SyncApiClient = {
      async sendBatch(batch) {
        timeline.push(`batch:${batch.operations.map((o) => o.id).join(',')}`);
        return {
          processed: batch.operations.map((op) => ({ operation_id: op.id, success: true })),
        };
      },
      async uploadEvidence(req) {
        timeline.push(`upload:${req.evidenceId}:${req.inspectionId}`);
        return {
          evidenceId: req.evidenceId,
          status: 'UPLOADED',
          storageKey: `${req.inspectionId}/${req.evidenceId}.jpg`,
        };
      },
    };

    const engineWithUpload = new OutboxEngine({
      outboxRepository: outboxRepo,
      inspectionRepository: inspectionRepo,
      networkMonitor,
      apiClient: customApi,
      autoSyncOnReconnect: false,
    });

    const result = await engineWithUpload.sync();

    assert.equal(result.success, true);
    assert.equal(result.processedCount, 3);
    assert.equal(result.failedCount, 0);
    assert.deepEqual(timeline, [
      'upload:ev-item-1:remote-insp-media-1',
      'batch:op-nc-create-1',
      'upload:ev-nc-1:remote-insp-media-1',
    ]);
    assert.equal(await outboxRepo.countPending(), 0);

    const updatedEv1 = await db.getFirstAsync<{ status: string; remote_key: string }>(
      'SELECT status, remote_key FROM inspection_evidences WHERE id = ?;',
      ['ev-item-1']
    );
    const updatedEv2 = await db.getFirstAsync<{ status: string; remote_key: string }>(
      'SELECT status, remote_key FROM inspection_evidences WHERE id = ?;',
      ['ev-nc-1']
    );
    assert.equal(updatedEv1?.status, 'UPLOADED');
    assert.equal(updatedEv1?.remote_key, 'remote-insp-media-1/ev-item-1.jpg');
    assert.equal(updatedEv2?.status, 'UPLOADED');
    assert.equal(updatedEv2?.remote_key, 'remote-insp-media-1/ev-nc-1.jpg');
  });

  test('createNativeMultipartFilePart gera parte compatível com expo/fetch (bytes, name e type)', async () => {
    const sampleBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const nativeUri = 'file:///data/user/0/com.fieldops.mobile/files/evidences/ev-native.jpg';

    const part = await createNativeMultipartFilePart(
      nativeUri,
      'ev-native.jpg',
      'image/jpeg',
      async (uri) => {
        assert.equal(uri, nativeUri);
        return sampleBytes;
      }
    );

    assert.equal(part.uri, nativeUri);
    assert.equal(part.name, 'ev-native.jpg');
    assert.equal(part.type, 'image/jpeg');
    assert.equal(part.size, sampleBytes.byteLength);
    assert.deepEqual(await part.bytes(), sampleBytes);
    assert.equal((await part.arrayBuffer()).byteLength, sampleBytes.byteLength);
  });

  test('buildEvidenceUploadFormData aceita URI file:// nativa usando bytes em vez de descritor legado sem bytes()', async () => {
    const sampleBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const nativeUri = 'file:///data/user/0/com.fieldops.mobile/files/evidences/ev-native-2.jpg';

    const formData = await buildEvidenceUploadFormData(
      {
        operationId: 'op-native-1',
        evidenceId: 'ev-native-2',
        inspectionId: 'insp-native-1',
        itemId: 'item-native-1',
        fileName: 'ev-native-2.jpg',
        mimeType: 'image/jpeg',
        localUri: nativeUri,
      },
      {
        readNativeBytes: async (uri) => {
          assert.equal(uri, nativeUri);
          return sampleBytes;
        },
      }
    );

    const fileEntry = formData.get('file');
    assert.ok(fileEntry instanceof Blob);
    assert.equal(fileEntry.type, 'image/jpeg');
    assert.equal(fileEntry.size, sampleBytes.byteLength);
    assert.equal(formData.get('inspectionId'), 'insp-native-1');
    assert.equal(formData.get('evidenceId'), 'ev-native-2');
    assert.equal(formData.get('operationId'), 'op-native-1');
    assert.equal(formData.get('itemId'), 'item-native-1');
  });
});

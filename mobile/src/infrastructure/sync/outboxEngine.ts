import {
  type OutboxOperation,
  type OutboxStatus,
  type OutboxEntityType,
  type OutboxOperationType,
  type SyncBatchResponse,
} from '../database/types';
import { OutboxRepository, outboxRepository as defaultOutboxRepo } from '../database/repositories/outboxRepository';
import { InspectionRepository, inspectionRepository as defaultInspectionRepo } from '../database/repositories/inspectionRepository';
import { NetworkMonitor, networkMonitor as defaultNetworkMonitor, type INetworkMonitor } from './networkMonitor';
import { generateUUID } from './uuid';

export interface SyncBatchOperation {
  id: string; // UUID v4 idempotente
  entity_type: OutboxEntityType;
  global_id: string;
  operation_type: OutboxOperationType;
  payload: string;
  client_timestamp: string;
  dependencies?: string[];
}

export interface SyncBatchRequest {
  batch_id: string;
  operations: SyncBatchOperation[];
}

export interface SyncResult {
  success: boolean;
  reason?: 'OFFLINE' | 'ALREADY_SYNCING' | 'NETWORK_ERROR' | 'PARTIAL_ERROR' | 'SUCCESS';
  message: string;
  processedCount: number;
  failedCount: number;
  syncedIds: string[];
  failedIds: string[];
  errors?: Array<{ operation_id: string; message?: string; error_code?: string }>;
}

export interface SyncApiClient {
  sendBatch(batch: SyncBatchRequest): Promise<SyncBatchResponse>;
}

/**
 * Cliente HTTP padrão para o endpoint de sincronização em lote.
 */
export class HttpSyncApiClient implements SyncApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  async sendBatch(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    const url = `${this.baseUrl}/api/v1/sync/batch`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': batch.batch_id,
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Falha na sincronização (HTTP ${response.status}): ${errorText || response.statusText}`);
    }

    return (await response.json()) as SyncBatchResponse;
  }
}

export interface OutboxEngineOptions {
  outboxRepository?: OutboxRepository;
  inspectionRepository?: InspectionRepository;
  networkMonitor?: INetworkMonitor;
  apiClient?: SyncApiClient;
  batchSize?: number;
  autoSyncOnReconnect?: boolean;
}

/**
 * Motor de Sincronização Outbox com Idempotência (SPEC-002 / TASK-002).
 * 
 * Responsabilidades:
 * - Despachar operações pendentes em lotes estruturados via POST /api/v1/sync/batch
 * - Garantir idempotência com UUIDs v4 exclusivos por mutação
 * - Respeitar dependências declaradas entre operações (FIFO e ordem causal)
 * - Proteger a integridade offline: não descartar operações em caso de erro temporário
 * - Incrementar retries e atualizar status para PENDING, SYNCING, ERROR ou CONFLICT
 */
export class OutboxEngine {
  private outboxRepo: OutboxRepository;
  private inspectionRepo: InspectionRepository;
  private networkMon: INetworkMonitor;
  private apiClient: SyncApiClient;
  private batchSize: number;
  private isSyncing: boolean = false;
  private activeSyncPromise: Promise<SyncResult> | null = null;
  private unsubscribeNetwork?: () => void;

  constructor(options?: OutboxEngineOptions) {
    this.outboxRepo = options?.outboxRepository ?? defaultOutboxRepo;
    this.inspectionRepo = options?.inspectionRepository ?? defaultInspectionRepo;
    this.networkMon = options?.networkMonitor ?? defaultNetworkMonitor;
    this.apiClient = options?.apiClient ?? new HttpSyncApiClient();
    this.batchSize = options?.batchSize ?? 50;

    if (options?.autoSyncOnReconnect !== false) {
      this.enableAutoSyncOnReconnect();
    }
  }

  /**
   * Configura o listener para sincronizar automaticamente quando a conexão for restabelecida.
   */
  enableAutoSyncOnReconnect(): void {
    if (this.unsubscribeNetwork) {
      return;
    }
    let wasOffline = false;
    this.unsubscribeNetwork = this.networkMon.subscribe((isOnline) => {
      if (wasOffline && isOnline) {
        // Conexão restabelecida: dispara sincronização em segundo plano
        this.sync().catch((err) => {
          console.warn('[OutboxEngine] Erro ao sincronizar automaticamente na reconexão:', err);
        });
      }
      wasOffline = !isOnline;
    });
  }

  /**
   * Cancela a inscrição de sincronização automática na reconexão.
   */
  disableAutoSyncOnReconnect(): void {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = undefined;
    }
  }

  /**
   * Retorna se uma sincronização está em andamento.
   */
  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Dispara a sincronização da fila outbox.
   * Método idempotente e protegido contra execuções concorrentes.
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing && this.activeSyncPromise) {
      return this.activeSyncPromise;
    }

    this.isSyncing = true;
    this.activeSyncPromise = this.executeSync()
      .finally(() => {
        this.isSyncing = false;
        this.activeSyncPromise = null;
      });

    return this.activeSyncPromise;
  }

  private async executeSync(): Promise<SyncResult> {
    // 1. Verificação de conectividade de rede
    const isOnline = await this.networkMon.isOnline();
    if (!isOnline) {
      return {
        success: false,
        reason: 'OFFLINE',
        message: 'Dispositivo sem conexão de rede. As alterações permanecem salvas localmente.',
        processedCount: 0,
        failedCount: 0,
        syncedIds: [],
        failedIds: [],
      };
    }

    // 2. Busca operações pendentes ou em erro (FIFO)
    const pendingOps = await this.outboxRepo.findPendingOperations();
    if (pendingOps.length === 0) {
      return {
        success: true,
        reason: 'SUCCESS',
        message: 'Todas as operações já estão sincronizadas.',
        processedCount: 0,
        failedCount: 0,
        syncedIds: [],
        failedIds: [],
      };
    }

    // 3. Ordenação por dependência e seleção do lote
    const batch = this.resolveBatchWithDependencies(pendingOps, this.batchSize);
    if (batch.length === 0) {
      return {
        success: true,
        reason: 'SUCCESS',
        message: 'Nenhuma operação pronta para envio no momento.',
        processedCount: 0,
        failedCount: 0,
        syncedIds: [],
        failedIds: [],
      };
    }

    // 4. Marca operações como SYNCING no SQLite
    for (const op of batch) {
      await this.outboxRepo.updateStatus(op.id, 'SYNCING');
    }

    // 5. Constrói payload com UUIDs idempotentes e timestamp do cliente
    const batchId = generateUUID();
    const batchRequest: SyncBatchRequest = {
      batch_id: batchId,
      operations: batch.map((op) => ({
        id: op.id, // UUID v4 idempotente
        entity_type: op.entity_type,
        global_id: op.global_id,
        operation_type: op.operation_type,
        payload: op.payload,
        client_timestamp: op.created_at ?? new Date().toISOString(),
        dependencies: Array.isArray(op.dependencies) ? op.dependencies : [],
      })),
    };

    // 6. Envio para a API
    let apiResponse: SyncBatchResponse;
    try {
      apiResponse = await this.apiClient.sendBatch(batchRequest);
    } catch (networkError: any) {
      // RT-02: Erro temporário de rede não descarta a operação.
      // Incrementa retries e mantém em PENDING ou ERROR no banco local.
      const errorMsg = networkError?.message || 'Falha temporária de comunicação com o servidor';
      for (const op of batch) {
        await this.outboxRepo.incrementRetries(op.id, errorMsg);
        await this.outboxRepo.updateStatus(op.id, 'ERROR', errorMsg);
      }

      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: `Falha de rede ao enviar lote: ${errorMsg}`,
        processedCount: 0,
        failedCount: batch.length,
        syncedIds: [],
        failedIds: batch.map((op) => op.id),
      };
    }

    // 7. Processamento dos resultados individuais da resposta
    const syncedIds: string[] = [];
    const failedIds: string[] = [];
    const errors: Array<{ operation_id: string; message?: string; error_code?: string }> = [];

    // Mapeia resultados por operation_id
    const resultsMap = new Map<string, { success: boolean; error_code?: string; message?: string }>();
    if (Array.isArray(apiResponse.processed)) {
      for (const item of apiResponse.processed) {
        resultsMap.set(item.operation_id, item);
      }
    }

    for (const op of batch) {
      const result = resultsMap.get(op.id);

      // Se a operação foi processada com sucesso ou já havia sido processada anteriormente (idempotência)
      if (result && (result.success || result.error_code === 'ALREADY_PROCESSED')) {
        syncedIds.push(op.id);
        // Operação confirmada sai da fila ativa (SPEC-002)
        await this.outboxRepo.delete(op.id);

        // Atualiza status de sincronização da entidade de domínio se aplicável
        await this.checkAndUpdateDomainEntitySyncStatus(op.entity_type, op.global_id);
      } else {
        // Falha no item individual
        failedIds.push(op.id);
        const itemMsg = result?.message || 'Erro não especificado retornado pela API';
        const errorCode = result?.error_code || 'UNPROCESSABLE_ENTITY';

        errors.push({
          operation_id: op.id,
          message: itemMsg,
          error_code: errorCode,
        });

        if (errorCode === 'CONFLICT') {
          // Conflito permanente de negócio
          await this.outboxRepo.updateStatus(op.id, 'CONFLICT', itemMsg);
          if (op.entity_type === 'INSPECTION') {
            await this.inspectionRepo.update(op.global_id, { sync_status: 'CONFLITO' }).catch(() => {});
          }
        } else {
          // Erro retentável: incrementa retries e define status ERROR
          await this.outboxRepo.incrementRetries(op.id, itemMsg);
          await this.outboxRepo.updateStatus(op.id, 'ERROR', itemMsg);
          if (op.entity_type === 'INSPECTION') {
            await this.inspectionRepo.update(op.global_id, { sync_status: 'ERRO' }).catch(() => {});
          }
        }
      }
    }

    const allSucceeded = failedIds.length === 0;
    const partialSuccess = syncedIds.length > 0 && failedIds.length > 0;

    let summaryMessage = `${syncedIds.length} operação(ões) sincronizada(s) com sucesso.`;
    if (failedIds.length > 0) {
      summaryMessage += ` ${failedIds.length} falha(s) registrada(s).`;
    }

    return {
      success: allSucceeded,
      reason: allSucceeded ? 'SUCCESS' : partialSuccess ? 'PARTIAL_ERROR' : 'NETWORK_ERROR',
      message: summaryMessage,
      processedCount: syncedIds.length,
      failedCount: failedIds.length,
      syncedIds,
      failedIds,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Ordena e filtra operações respeitando dependências declaradas.
   */
  private resolveBatchWithDependencies(operations: OutboxOperation[], limit: number): OutboxOperation[] {
    const batch: OutboxOperation[] = [];
    const scheduledIds = new Set<string>();
    const allPendingIds = new Set(operations.map((op) => op.id));

    for (const op of operations) {
      if (batch.length >= limit) {
        break;
      }

      const deps = Array.isArray(op.dependencies) ? op.dependencies : [];
      
      // Verifica se todas as dependências declaradas que ainda estão pendentes
      // já foram adicionadas antes no mesmo lote
      let canAdd = true;
      for (const depId of deps) {
        if (allPendingIds.has(depId) && !scheduledIds.has(depId)) {
          canAdd = false;
          break;
        }
      }

      if (canAdd) {
        batch.push(op);
        scheduledIds.add(op.id);
      }
    }

    return batch;
  }

  /**
   * Verifica se a entidade de domínio (ex: Inspeção) ainda possui operações pendentes na outbox.
   * Caso não possua, atualiza o status de sincronização local para SINCRONIZADO.
   */
  private async checkAndUpdateDomainEntitySyncStatus(entityType: string, globalId: string): Promise<void> {
    if (entityType === 'INSPECTION') {
      try {
        const remaining = await this.outboxRepo.findByEntity('INSPECTION', globalId);
        const hasPending = remaining.some((r) => r.status === 'PENDING' || r.status === 'ERROR' || r.status === 'SYNCING');
        if (!hasPending) {
          await this.inspectionRepo.update(globalId, { sync_status: 'SINCRONIZADO' });
        }
      } catch (err) {
        console.warn(`[OutboxEngine] Falha ao atualizar sync_status da inspeção ${globalId}:`, err);
      }
    }
  }
}

export const outboxEngine = new OutboxEngine();

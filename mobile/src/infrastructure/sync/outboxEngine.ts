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
import { ApiClient, ApiError, apiClient as defaultHttpClient } from '../http/apiClient';
import {
  buildEvidenceUploadFormData,
  resolveStoredEvidenceUri,
  type UploadEvidenceRequest,
  type UploadEvidenceResponse,
} from './evidenceMultipart';

export type { UploadEvidenceRequest, UploadEvidenceResponse };

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
  uploadEvidence?(request: UploadEvidenceRequest): Promise<UploadEvidenceResponse>;
}

/**
 * Cliente HTTP padrão para o endpoint de sincronização em lote e upload multipart de evidências.
 * Utiliza o ApiClient central para garantir renovação automática de JWT (401 -> refresh)
 * e limpeza de sessão expirada.
 */
export class HttpSyncApiClient implements SyncApiClient {
  private httpClient: ApiClient;

  constructor(
    baseUrl?: string,
    getAccessToken?: () => Promise<string | null>,
    httpClient?: ApiClient
  ) {
    if (httpClient) {
      this.httpClient = httpClient;
    } else if (!baseUrl && !getAccessToken) {
      this.httpClient = defaultHttpClient;
    } else {
      this.httpClient = new ApiClient({
        baseUrl: baseUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080',
        getAccessToken,
      });
    }
  }

  async sendBatch(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    try {
      return await this.httpClient.post<SyncBatchResponse>('/api/v1/sync/batch', batch, {
        headers: {
          'X-Idempotency-Key': batch.batch_id,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`Falha na sincronização (HTTP ${error.status}): ${error.message}`);
      }
      throw error;
    }
  }

  async uploadEvidence(request: UploadEvidenceRequest): Promise<UploadEvidenceResponse> {
    const formData = await buildEvidenceUploadFormData(request);
    try {
      return await this.httpClient.post<UploadEvidenceResponse>('/api/v1/sync/upload', formData, {
        headers: {
          'X-Idempotency-Key': request.operationId,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        const wrapped = new Error(
          `Falha no upload da evidência (HTTP ${error.status}): ${error.message}`
        ) as Error & { status?: number };
        wrapped.status = error.status;
        throw wrapped;
      }
      throw error;
    }
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

    // 4. Particiona entre uploads multipart (Fase A / Fase C) e mutações JSON em lote (Fase B)
    const supportsMultipartUpload = typeof this.apiClient.uploadEvidence === 'function';
    const preBatchEvidenceOps: OutboxOperation[] = [];
    const postBatchEvidenceOps: OutboxOperation[] = [];
    const jsonBatchOps: OutboxOperation[] = [];

    for (const op of batch) {
      if (supportsMultipartUpload && op.operation_type === 'UPLOAD_EVIDENCE') {
        const parsed = this.parseOperationPayload(op.payload);
        const ncId = parsed.nonConformityId ?? parsed.non_conformity_id ?? null;
        if (ncId) {
          postBatchEvidenceOps.push(op);
        } else {
          preBatchEvidenceOps.push(op);
        }
      } else {
        jsonBatchOps.push(op);
      }
    }

    const syncedIds: string[] = [];
    const failedIds: string[] = [];
    const errors: Array<{ operation_id: string; message?: string; error_code?: string }> = [];

    // Fase A: Envia evidências de itens/checklist antes do lote JSON (permite vincular responseId e validar PHOTO obrigatório)
    for (const op of preBatchEvidenceOps) {
      const outcome = await this.processEvidenceUploadOperation(op);
      if (outcome.synced) {
        syncedIds.push(op.id);
      } else {
        failedIds.push(op.id);
        if (outcome.error) {
          errors.push(outcome.error);
        }
      }
    }

    // Fase B: Envia mutações JSON via POST /api/v1/sync/batch
    if (jsonBatchOps.length > 0) {
      for (const op of jsonBatchOps) {
        await this.outboxRepo.updateStatus(op.id, 'SYNCING');
      }

      const batchId = generateUUID();
      const batchRequest: SyncBatchRequest = {
        batch_id: batchId,
        operations: jsonBatchOps.map((op) => ({
          id: op.id, // UUID v4 idempotente
          entity_type: op.entity_type,
          global_id: op.global_id,
          operation_type: op.operation_type,
          payload: op.payload,
          client_timestamp: op.created_at ?? new Date().toISOString(),
          dependencies: Array.isArray(op.dependencies) ? op.dependencies : [],
        })),
      };

      let apiResponse: SyncBatchResponse;
      try {
        apiResponse = await this.apiClient.sendBatch(batchRequest);
      } catch (networkError: any) {
        // RT-02: Erro temporário de rede não descarta a operação.
        // Incrementa retries e mantém em PENDING ou ERROR no banco local.
        const errorMsg = networkError?.message || 'Falha temporária de comunicação com o servidor';
        for (const op of jsonBatchOps) {
          await this.outboxRepo.incrementRetries(op.id, errorMsg);
          await this.outboxRepo.updateStatus(op.id, 'ERROR', errorMsg);
          failedIds.push(op.id);
          errors.push({
            operation_id: op.id,
            message: errorMsg,
            error_code: 'NETWORK_ERROR',
          });
        }

        if (syncedIds.length === 0) {
          return {
            success: false,
            reason: 'NETWORK_ERROR',
            message: `Falha de rede ao enviar lote: ${errorMsg}`,
            processedCount: 0,
            failedCount: failedIds.length,
            syncedIds: [],
            failedIds,
          };
        }

        return {
          success: false,
          reason: 'PARTIAL_ERROR',
          message: `${syncedIds.length} operação(ões) sincronizada(s) com sucesso. ${failedIds.length} falha(s) registrada(s).`,
          processedCount: syncedIds.length,
          failedCount: failedIds.length,
          syncedIds,
          failedIds,
          errors,
        };
      }

      const resultsMap = new Map<string, { success: boolean; error_code?: string; message?: string }>();
      if (Array.isArray(apiResponse.processed)) {
        for (const item of apiResponse.processed) {
          resultsMap.set(item.operation_id, item);
        }
      }

      for (const op of jsonBatchOps) {
        const result = resultsMap.get(op.id);

        if (result && (result.success || result.error_code === 'ALREADY_PROCESSED')) {
          syncedIds.push(op.id);
          await this.outboxRepo.delete(op.id);
          await this.checkAndUpdateDomainEntitySyncStatus(op.entity_type, op.global_id);
        } else {
          failedIds.push(op.id);
          const itemMsg = result?.message || 'Erro não especificado retornado pela API';
          const errorCode = result?.error_code || 'UNPROCESSABLE_ENTITY';

          errors.push({
            operation_id: op.id,
            message: itemMsg,
            error_code: errorCode,
          });

          if (errorCode === 'CONFLICT') {
            await this.outboxRepo.updateStatus(op.id, 'CONFLICT', itemMsg);
            if (op.entity_type === 'INSPECTION') {
              await this.inspectionRepo.update(op.global_id, { sync_status: 'CONFLITO' }).catch(() => {});
            }
          } else {
            await this.outboxRepo.incrementRetries(op.id, itemMsg);
            await this.outboxRepo.updateStatus(op.id, 'ERROR', itemMsg);
            if (op.entity_type === 'INSPECTION') {
              await this.inspectionRepo.update(op.global_id, { sync_status: 'ERRO' }).catch(() => {});
            }
          }
        }
      }
    }

    // Fase C: Envia evidências vinculadas a Não Conformidades após a criação da NC no lote JSON
    for (const op of postBatchEvidenceOps) {
      const outcome = await this.processEvidenceUploadOperation(op);
      if (outcome.synced) {
        syncedIds.push(op.id);
      } else {
        failedIds.push(op.id);
        if (outcome.error) {
          errors.push(outcome.error);
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

  private parseOperationPayload(raw: string): Record<string, any> {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async resolveRemoteInspectionId(
    localOrRemoteId?: string | null,
    remoteHint?: string | null
  ): Promise<string> {
    if (typeof remoteHint === 'string' && remoteHint.trim().length > 0) {
      return remoteHint.trim();
    }
    if (typeof localOrRemoteId === 'string' && localOrRemoteId.trim().length > 0) {
      const trimmed = localOrRemoteId.trim();
      const localInspection = await this.inspectionRepo.findById(trimmed).catch(() => null);
      if (localInspection?.remote_id) {
        return localInspection.remote_id;
      }
      return trimmed;
    }
    return '';
  }

  private async processEvidenceUploadOperation(op: OutboxOperation): Promise<{
    synced: boolean;
    error?: { operation_id: string; message?: string; error_code?: string };
  }> {
    await this.outboxRepo.updateStatus(op.id, 'SYNCING');

    const payload = this.parseOperationPayload(op.payload);
    const evidenceId = String(payload.evidenceId || payload.evidence_id || op.global_id || '').trim();
    const localRecord = evidenceId
      ? await this.outboxRepo.findLocalEvidenceFile(evidenceId).catch(() => null)
      : null;

    const rawInspectionId =
      payload.remoteInspectionId ||
      payload.inspectionId ||
      payload.inspection_id ||
      localRecord?.inspection_id ||
      '';
    const inspectionId = await this.resolveRemoteInspectionId(
      rawInspectionId,
      payload.remoteInspectionId
    );
    const itemId = payload.itemId ?? payload.item_id ?? localRecord?.item_id ?? null;
    const nonConformityId =
      payload.nonConformityId ??
      payload.non_conformity_id ??
      localRecord?.non_conformity_id ??
      null;
    const fileName = String(
      payload.fileName || payload.file_name || localRecord?.file_name || `${evidenceId || 'evidencia'}.jpg`
    );
    const mimeType = String(
      payload.mimeType || payload.mime_type || localRecord?.mime_type || 'image/jpeg'
    );
    const clientTimestamp =
      payload.createdAt || payload.clientTimestamp || op.created_at || new Date().toISOString();
    const description = payload.description ?? null;

    let localUri = localRecord?.local_uri || '';
    if (!localUri && fileName) {
      const candidateWebUri = `fieldops-web://documents/evidences/${fileName}`;
      if (resolveStoredEvidenceUri(candidateWebUri) !== candidateWebUri) {
        localUri = candidateWebUri;
      }
    }

    if (!evidenceId || !inspectionId || !localUri) {
      const errMsg = !localUri
        ? 'Arquivo local da evidência não encontrado no dispositivo.'
        : 'Metadados obrigatórios da evidência ausentes para upload.';
      if (evidenceId) {
        await this.outboxRepo
          .updateLocalEvidenceSyncStatus(evidenceId, 'FAILED', { errorMessage: errMsg })
          .catch(() => {});
      }
      await this.outboxRepo.incrementRetries(op.id, errMsg);
      await this.outboxRepo.updateStatus(op.id, 'ERROR', errMsg);
      return {
        synced: false,
        error: {
          operation_id: op.id,
          message: errMsg,
          error_code: 'MISSING_LOCAL_EVIDENCE',
        },
      };
    }

    await this.outboxRepo.updateLocalEvidenceSyncStatus(evidenceId, 'UPLOADING').catch(() => {});

    try {
      const uploadResponse = await this.apiClient.uploadEvidence!({
        operationId: op.id,
        evidenceId,
        inspectionId,
        itemId,
        nonConformityId,
        fileName,
        mimeType,
        localUri,
        clientTimestamp,
        description,
      });

      await this.outboxRepo
        .updateLocalEvidenceSyncStatus(evidenceId, 'UPLOADED', {
          remoteKey: uploadResponse?.storage_key ?? uploadResponse?.storageKey ?? null,
          remoteUrl: uploadResponse?.url ?? null,
          errorMessage: null,
        })
        .catch(() => {});

      await this.outboxRepo.delete(op.id);
      await this.checkAndUpdateDomainEntitySyncStatus(
        'INSPECTION',
        localRecord?.inspection_id || rawInspectionId || inspectionId
      );

      return { synced: true };
    } catch (err: any) {
      const statusCode = typeof err?.status === 'number' ? err.status : undefined;
      const errMsg = err?.message || 'Falha ao enviar fotografia de evidência.';

      await this.outboxRepo
        .updateLocalEvidenceSyncStatus(evidenceId, 'FAILED', { errorMessage: errMsg })
        .catch(() => {});

      if (statusCode === 409) {
        await this.outboxRepo.updateStatus(op.id, 'CONFLICT', errMsg);
        return {
          synced: false,
          error: {
            operation_id: op.id,
            message: errMsg,
            error_code: 'CONFLICT',
          },
        };
      }

      await this.outboxRepo.incrementRetries(op.id, errMsg);
      await this.outboxRepo.updateStatus(op.id, 'ERROR', errMsg);
      return {
        synced: false,
        error: {
          operation_id: op.id,
          message: errMsg,
          error_code: 'UPLOAD_FAILED',
        },
      };
    }
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

import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '@/infrastructure/database/db';
import {
  InspectionRepository,
  inspectionRepository as defaultInspectionRepo,
  isInspectionAssignedToTechnician,
} from '@/infrastructure/database/repositories/inspectionRepository';
import {
  OutboxRepository,
  outboxRepository as defaultOutboxRepo,
} from '@/infrastructure/database/repositories/outboxRepository';
import type {
  ChecklistItem,
  ChecklistResponse,
  Inspection,
  InspectionDetailsData,
  OutboxOperation,
} from '@/infrastructure/database/types';
import { generateUUID } from '@/infrastructure/sync/uuid';
import {
  captureCurrentLocation,
  type CaptureLocationOptions,
  type LocationCaptureResult,
  type LocationProviderAdapter,
} from '@/features/location/services/locationService';
import {
  calculateInspectionProgress,
  type InspectionProgressSummary,
  type PendingInspectionItem,
} from '../hooks/useInspectionProgress';

export const AWAITING_SYNC_LABEL = 'Aguardando Sincronização';

const READ_ONLY_STATUSES = new Set([
  'ENVIADA',
  'EM_REVISÃO',
  'EM_REVISAO',
  'APROVADA',
  'CANCELADA',
  'SUBMITTED',
  'IN_REVIEW',
  'APPROVED',
  'CANCELLED',
]);

const STARTABLE_STATUSES = new Set([
  'ATRIBUÍDA',
  'ATRIBUIDA',
  'RASCUNHO',
  'REPROVADA',
  'EM_ANDAMENTO',
  'ASSIGNED',
  'DRAFT',
  'REJECTED',
  'IN_PROGRESS',
]);

export type LocationStage = 'START' | 'COMPLETE';

export interface InspectionLocationRecord {
  id: string;
  inspection_id: string;
  stage: LocationStage;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  captured_at: string;
  permission_status: string | null;
  available: boolean;
  fallback_reason: string | null;
}

export interface InspectionLocationsResult {
  startLocation: InspectionLocationRecord | null;
  completeLocation: InspectionLocationRecord | null;
  records: InspectionLocationRecord[];
}

export interface InspectionLifecycleDependencies {
  db?: SQLiteDatabase;
  inspectionRepo?: InspectionRepository;
  outboxRepo?: OutboxRepository;
  locationProvider?: LocationProviderAdapter;
  locationTimeoutMs?: number;
  now?: () => Date;
}

export interface StartInspectionParams {
  inspectionId: string;
  technicianId?: string | null;
  userRole?: string | null;
  equipmentVerification?: unknown;
  locationOptions?: CaptureLocationOptions;
}

export interface StartInspectionResult {
  success: boolean;
  code:
    | 'STARTED'
    | 'ALREADY_IN_PROGRESS'
    | 'NOT_FOUND'
    | 'FORBIDDEN_TECHNICIAN'
    | 'INVALID_STATUS';
  message: string;
  inspection: Inspection | null;
  startedAt: string | null;
  location: LocationCaptureResult | null;
  locationRecord: InspectionLocationRecord | null;
  outboxOperation: OutboxOperation | null;
}

export interface CompleteInspectionParams {
  inspectionId: string;
  technicianId?: string | null;
  userRole?: string | null;
  locationOptions?: CaptureLocationOptions;
}

export interface CompleteInspectionResult {
  success: boolean;
  blockedByPendingItems: boolean;
  code:
    | 'COMPLETED'
    | 'PENDING_REQUIRED_ITEMS'
    | 'NOT_FOUND'
    | 'FORBIDDEN_TECHNICIAN'
    | 'ALREADY_COMPLETED'
    | 'INVALID_STATUS';
  message: string;
  pendingItems: PendingInspectionItem[];
  progress: InspectionProgressSummary | null;
  inspection: Inspection | null;
  completedAt: string | null;
  location: LocationCaptureResult | null;
  locationRecord: InspectionLocationRecord | null;
  outboxOperation: OutboxOperation | null;
  isReadOnly: boolean;
  syncDisplayLabel: string | null;
}

export interface SaveChecklistResponseParams {
  inspectionId: string;
  item: ChecklistItem;
  value: unknown;
  observation?: string | null;
  nonConformityDescription?: string | null;
  technicianId?: string | null;
  userRole?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
}

export interface SaveChecklistResponseResult {
  response: ChecklistResponse;
  inspection: Inspection;
  outboxOperation: OutboxOperation;
}

export type LifecycleErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN_TECHNICIAN'
  | 'READ_ONLY_INSPECTION'
  | 'INVALID_STATUS';

export class InspectionLifecycleError extends Error {
  readonly code: LifecycleErrorCode;

  constructor(code: LifecycleErrorCode, message: string) {
    super(message);
    this.name = 'InspectionLifecycleError';
    this.code = code;
  }
}

export function isInspectionReadOnly(status?: string | null): boolean {
  if (!status) return false;
  return READ_ONLY_STATUSES.has(String(status).trim().toUpperCase());
}

function isPrivilegedRole(userRole?: string | null): boolean {
  const normalized = String(userRole ?? '').trim().toUpperCase();
  return normalized === 'ADMIN' || normalized === 'SUPERVISOR';
}

function hasExecutionPermission(
  inspection: Pick<Inspection, 'technician_id'>,
  technicianId?: string | null,
  userRole?: string | null
): boolean {
  if (isPrivilegedRole(userRole)) {
    return true;
  }
  return isInspectionAssignedToTechnician(inspection, technicianId);
}

async function resolveDatabase(deps: InspectionLifecycleDependencies): Promise<SQLiteDatabase> {
  if (deps.db) {
    return deps.db;
  }
  const repoWithInternalDb = deps.inspectionRepo as unknown as { db?: SQLiteDatabase } | undefined;
  if (repoWithInternalDb?.db) {
    return repoWithInternalDb.db;
  }
  const outboxWithInternalDb = deps.outboxRepo as unknown as { db?: SQLiteDatabase } | undefined;
  if (outboxWithInternalDb?.db) {
    return outboxWithInternalDb.db;
  }
  return getDatabase();
}

function resolveRepositories(
  db: SQLiteDatabase,
  deps: InspectionLifecycleDependencies
): { inspectionRepo: InspectionRepository; outboxRepo: OutboxRepository } {
  const inspectionRepo =
    deps.inspectionRepo ?? (deps.db ? new InspectionRepository(db) : defaultInspectionRepo);
  const outboxRepo =
    deps.outboxRepo ?? (deps.db ? new OutboxRepository(db) : defaultOutboxRepo);
  return { inspectionRepo, outboxRepo };
}

/**
 * Executa mutações em transação atômica no SQLite (RT-03 / RN-041).
 */
async function runInAtomicTransaction<T>(
  db: SQLiteDatabase,
  task: () => Promise<T>
): Promise<T> {
  const alreadyInTx =
    typeof db.isInTransactionAsync === 'function'
      ? await db.isInTransactionAsync().catch(() => false)
      : false;

  if (alreadyInTx) {
    return task();
  }

  let startedTx = false;
  try {
    await db.execAsync('BEGIN;');
    startedTx = true;
  } catch {
    startedTx = false;
  }

  try {
    const result = await task();
    if (startedTx) {
      await db.execAsync('COMMIT;');
    }
    return result;
  } catch (err) {
    if (startedTx) {
      await db.execAsync('ROLLBACK;').catch(() => {});
    }
    throw err;
  }
}

/**
 * Garante a tabela auxiliar de coordenadas GPS por etapa (START / COMPLETE) sem alterar migrations v1 (RT-02).
 */
export async function ensureInspectionLocationsTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS inspection_locations (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('START', 'COMPLETE')),
      latitude REAL,
      longitude REAL,
      accuracy REAL,
      captured_at TEXT NOT NULL,
      permission_status TEXT,
      available INTEGER NOT NULL DEFAULT 0,
      fallback_reason TEXT,
      FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_inspection_locations_insp_stage
      ON inspection_locations(inspection_id, stage);
  `);
}

async function upsertInspectionLocation(
  db: SQLiteDatabase,
  inspectionId: string,
  stage: LocationStage,
  locationResult: LocationCaptureResult
): Promise<InspectionLocationRecord> {
  const recordId = `${inspectionId}_${stage}`;
  const availableInt = locationResult.captured ? 1 : 0;
  const fallbackReason = locationResult.captured ? null : locationResult.message;

  await db.runAsync(
    `INSERT INTO inspection_locations (
      id, inspection_id, stage, latitude, longitude, accuracy, captured_at, permission_status, available, fallback_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy = excluded.accuracy,
      captured_at = excluded.captured_at,
      permission_status = excluded.permission_status,
      available = excluded.available,
      fallback_reason = excluded.fallback_reason;`,
    [
      recordId,
      inspectionId,
      stage,
      locationResult.latitude,
      locationResult.longitude,
      locationResult.accuracy,
      locationResult.timestamp,
      locationResult.permissionStatus,
      availableInt,
      fallbackReason,
    ]
  );

  return {
    id: recordId,
    inspection_id: inspectionId,
    stage,
    latitude: locationResult.latitude,
    longitude: locationResult.longitude,
    accuracy: locationResult.accuracy,
    captured_at: locationResult.timestamp,
    permission_status: locationResult.permissionStatus,
    available: locationResult.captured,
    fallback_reason: fallbackReason,
  };
}

/**
 * Consulta coordenadas GPS registradas no SQLite para início e conclusão da inspeção (RT-02, CA-04).
 */
export async function getInspectionLocations(
  inspectionId: string,
  dependencies: InspectionLifecycleDependencies = {}
): Promise<InspectionLocationsResult> {
  if (!inspectionId) {
    return { startLocation: null, completeLocation: null, records: [] };
  }

  const db = await resolveDatabase(dependencies);
  await ensureInspectionLocationsTable(db);
  const { inspectionRepo } = resolveRepositories(db, dependencies);

  const inspection =
    (await inspectionRepo.findById(inspectionId)) ??
    (await inspectionRepo.findByRemoteId(inspectionId));
  const resolvedId = inspection?.id ?? inspectionId;

  const rows = await db.getAllAsync<{
    id: string;
    inspection_id: string;
    stage: LocationStage;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    captured_at: string;
    permission_status: string | null;
    available: number;
    fallback_reason: string | null;
  }>(
    'SELECT * FROM inspection_locations WHERE inspection_id = ? ORDER BY captured_at ASC;',
    [resolvedId]
  );

  const records: InspectionLocationRecord[] = rows.map((row) => ({
    id: row.id,
    inspection_id: row.inspection_id,
    stage: row.stage,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    accuracy: row.accuracy ?? null,
    captured_at: row.captured_at,
    permission_status: row.permission_status ?? null,
    available: Boolean(row.available),
    fallback_reason: row.fallback_reason ?? null,
  }));

  const startLocation = records.find((r) => r.stage === 'START') ?? null;
  const completeLocation = records.find((r) => r.stage === 'COMPLETE') ?? null;

  return { startLocation, completeLocation, records };
}

function serializeChecklistValue(nextValue: unknown): string {
  if (nextValue === null || nextValue === undefined) {
    return '';
  }
  if (typeof nextValue === 'string') {
    return nextValue;
  }
  if (typeof nextValue === 'boolean' || typeof nextValue === 'number') {
    return String(nextValue);
  }
  try {
    return JSON.stringify(nextValue);
  } catch {
    return String(nextValue);
  }
}

/**
 * Inicia a inspeção offline (RF-01..RF-03, RT-01..RT-04, EX-01, CA-01, CA-04):
 * - Valida atribuição ao técnico logado e estado elegível.
 * - Registra timestamp do dispositivo (`started_at`) e captura localização GPS pontual (sem travar se negada/indisponível).
 * - Atualiza estado local para `EM_ANDAMENTO`, grava coordenadas no SQLite e cria operação `START_INSPECTION` com UUID idempotente na Outbox.
 */
export async function startInspection(
  params: StartInspectionParams,
  dependencies: InspectionLifecycleDependencies = {}
): Promise<StartInspectionResult> {
  const nowFn = dependencies.now ?? (() => new Date());
  const db = await resolveDatabase(dependencies);
  await ensureInspectionLocationsTable(db);
  const { inspectionRepo, outboxRepo } = resolveRepositories(db, dependencies);

  const inspection =
    (await inspectionRepo.findById(params.inspectionId)) ??
    (await inspectionRepo.findByRemoteId(params.inspectionId));

  if (!inspection) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Inspeção não encontrada no armazenamento local.',
      inspection: null,
      startedAt: null,
      location: null,
      locationRecord: null,
      outboxOperation: null,
    };
  }

  // RF-01 / RN-033: Somente o técnico atribuído pode iniciar
  if (!hasExecutionPermission(inspection, params.technicianId, params.userRole)) {
    return {
      success: false,
      code: 'FORBIDDEN_TECHNICIAN',
      message: 'Permissão negada: somente o técnico atribuído pode iniciar esta inspeção.',
      inspection,
      startedAt: inspection.started_at ?? null,
      location: null,
      locationRecord: null,
      outboxOperation: null,
    };
  }

  const normalizedStatus = String(inspection.status ?? '').trim().toUpperCase();
  if (!STARTABLE_STATUSES.has(normalizedStatus) || isInspectionReadOnly(normalizedStatus)) {
    return {
      success: false,
      code: 'INVALID_STATUS',
      message: `Não é possível iniciar uma inspeção no estado ${inspection.status}.`,
      inspection,
      startedAt: inspection.started_at ?? null,
      location: null,
      locationRecord: null,
      outboxOperation: null,
    };
  }

  const wasAlreadyInProgress =
    normalizedStatus === 'EM_ANDAMENTO' || normalizedStatus === 'IN_PROGRESS';
  const existingLocations = await getInspectionLocations(inspection.id, {
    db,
    inspectionRepo,
    outboxRepo,
  });

  // Se já iniciou e já possui localização registrada, retorna idempotentemente
  const existingOutbox = await outboxRepo.findByEntity('INSPECTION', inspection.id);
  const existingStartOp =
    existingOutbox.find((op) => op.operation_type === 'START_INSPECTION') ?? null;

  if (wasAlreadyInProgress && existingLocations.startLocation && existingStartOp) {
    return {
      success: true,
      code: 'ALREADY_IN_PROGRESS',
      message: 'Inspeção já está em andamento neste dispositivo.',
      inspection,
      startedAt: inspection.started_at ?? existingLocations.startLocation.captured_at,
      location: null,
      locationRecord: existingLocations.startLocation,
      outboxOperation: existingStartOp,
    };
  }

  // RF-02: Registra timestamp do dispositivo e tenta captura pontual de GPS (EX-01: sem travar)
  const startedAt = inspection.started_at ?? nowFn().toISOString();
  const locationResult = await captureCurrentLocation({
    locationProvider: params.locationOptions?.locationProvider ?? dependencies.locationProvider,
    timeoutMs: params.locationOptions?.timeoutMs ?? dependencies.locationTimeoutMs,
    accuracy: params.locationOptions?.accuracy,
    now: params.locationOptions?.now ?? nowFn,
  });

  const { updatedInspection, locationRecord, outboxOperation } = await runInAtomicTransaction(
    db,
    async () => {
      await inspectionRepo.update(inspection.id, {
        status: 'EM_ANDAMENTO',
        started_at: startedAt,
        sync_status: 'PENDENTE',
      });

      const locRecord = await upsertInspectionLocation(
        db,
        inspection.id,
        'START',
        locationResult
      );

      const startPayload = JSON.stringify({
        inspectionId: inspection.id,
        remoteId: inspection.remote_id ?? null,
        startedAt,
        technicianId: params.technicianId ?? inspection.technician_id ?? null,
        equipmentVerification: params.equipmentVerification ?? null,
        locationStatus: locationResult.status,
        location: locationResult.captured
          ? {
              latitude: locationResult.latitude,
              longitude: locationResult.longitude,
              accuracy: locationResult.accuracy,
              timestamp: locationResult.timestamp,
            }
          : null,
      });

      let startOp = existingStartOp;
      if (!startOp) {
        const opId = generateUUID();
        await outboxRepo.create({
          id: opId,
          entity_type: 'INSPECTION',
          global_id: inspection.id,
          operation_type: 'START_INSPECTION',
          payload: startPayload,
          status: 'PENDING',
        });
        startOp = (await outboxRepo.findById(opId)) ?? {
          id: opId,
          entity_type: 'INSPECTION',
          global_id: inspection.id,
          operation_type: 'START_INSPECTION',
          payload: startPayload,
          dependencies: [],
          status: 'PENDING',
          retries: 0,
        };
      } else if (startOp.status === 'PENDING') {
        await outboxRepo.update(startOp.id, { payload: startPayload });
        startOp = (await outboxRepo.findById(startOp.id)) ?? { ...startOp, payload: startPayload };
      }

      const reloaded = (await inspectionRepo.findById(inspection.id)) ?? {
        ...inspection,
        status: 'EM_ANDAMENTO' as const,
        started_at: startedAt,
        sync_status: 'PENDENTE' as const,
      };

      return {
        updatedInspection: reloaded,
        locationRecord: locRecord,
        outboxOperation: startOp,
      };
    }
  );

  return {
    success: true,
    code: wasAlreadyInProgress ? 'ALREADY_IN_PROGRESS' : 'STARTED',
    message: locationResult.captured
      ? 'Inspeção iniciada com registro de data/hora e localização GPS.'
      : `Inspeção iniciada offline sem GPS (${locationResult.message})`,
    inspection: updatedInspection,
    startedAt,
    location: locationResult,
    locationRecord,
    outboxOperation,
  };
}

/**
 * Salva uma resposta do checklist atomicamente no SQLite local e enfileira SUBMIT_RESPONSE na Outbox (RT-03, RN-041, RN-043).
 * Bloqueia edições se a inspeção já tiver sido concluída/enviada (CA-03, EX-02).
 */
export async function saveChecklistResponse(
  params: SaveChecklistResponseParams,
  dependencies: InspectionLifecycleDependencies = {}
): Promise<SaveChecklistResponseResult> {
  const nowFn = dependencies.now ?? (() => new Date());
  const db = await resolveDatabase(dependencies);
  const { inspectionRepo, outboxRepo } = resolveRepositories(db, dependencies);

  const inspection =
    (await inspectionRepo.findById(params.inspectionId)) ??
    (await inspectionRepo.findByRemoteId(params.inspectionId));

  if (!inspection) {
    throw new InspectionLifecycleError(
      'NOT_FOUND',
      'Inspeção não encontrada no armazenamento local.'
    );
  }

  if (!hasExecutionPermission(inspection, params.technicianId, params.userRole)) {
    throw new InspectionLifecycleError(
      'FORBIDDEN_TECHNICIAN',
      'Permissão negada: somente o técnico atribuído pode alterar respostas desta inspeção.'
    );
  }

  if (isInspectionReadOnly(inspection.status)) {
    throw new InspectionLifecycleError(
      'READ_ONLY_INSPECTION',
      `Edição bloqueada: inspeção no estado ${inspection.status} está em modo somente leitura.`
    );
  }

  const serialized = serializeChecklistValue(params.value);
  const isNonConformity =
    params.item.response_type === 'CONFORMITY' &&
    (serialized === 'NON_CONFORMING' || serialized === 'NAO_CONFORME')
      ? 1
      : 0;
  const respondedAt = nowFn().toISOString();

  const existingRow = await db.getFirstAsync<ChecklistResponse>(
    'SELECT * FROM checklist_responses WHERE item_id = ?;',
    [params.item.id]
  );

  const responseId = existingRow?.id ?? generateUUID();
  const finalObservation =
    params.observation !== undefined ? params.observation : existingRow?.observation ?? null;
  const finalNcDescription =
    isNonConformity === 1
      ? params.nonConformityDescription !== undefined
        ? params.nonConformityDescription
        : existingRow?.non_conformity_description ?? null
      : null;

  const finalLat =
    params.latitude !== undefined ? params.latitude : existingRow?.latitude ?? null;
  const finalLng =
    params.longitude !== undefined ? params.longitude : existingRow?.longitude ?? null;
  const finalAcc =
    params.accuracy !== undefined ? params.accuracy : existingRow?.accuracy ?? null;

  const { updatedInspection, outboxOperation } = await runInAtomicTransaction(
    db,
    async () => {
      await db.runAsync(
        `INSERT INTO checklist_responses (
          id, item_id, inspection_id, value, observation, is_non_conformity,
          non_conformity_description, latitude, longitude, accuracy, responded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET
          value = excluded.value,
          observation = excluded.observation,
          is_non_conformity = excluded.is_non_conformity,
          non_conformity_description = excluded.non_conformity_description,
          latitude = COALESCE(excluded.latitude, checklist_responses.latitude),
          longitude = COALESCE(excluded.longitude, checklist_responses.longitude),
          accuracy = COALESCE(excluded.accuracy, checklist_responses.accuracy),
          responded_at = excluded.responded_at;`,
        [
          responseId,
          params.item.id,
          inspection.id,
          serialized,
          finalObservation,
          isNonConformity,
          finalNcDescription,
          finalLat,
          finalLng,
          finalAcc,
          respondedAt,
        ]
      );

      const nextStatus =
        inspection.status === 'ATRIBUÍDA' ||
        inspection.status === 'RASCUNHO' ||
        inspection.status === 'REPROVADA'
          ? 'EM_ANDAMENTO'
          : inspection.status;

      await inspectionRepo.update(inspection.id, {
        status: nextStatus,
        started_at: inspection.started_at ?? respondedAt,
        sync_status: 'PENDENTE',
      });

      const opId = generateUUID();
      const payload = JSON.stringify({
        id: responseId,
        inspectionId: inspection.id,
        itemId: params.item.id,
        value: serialized,
        observation: finalObservation,
        isNonConformity: isNonConformity === 1,
        nonConformityDescription: finalNcDescription,
        latitude: finalLat,
        longitude: finalLng,
        accuracy: finalAcc,
        respondedAt,
      });

      await outboxRepo.create({
        id: opId,
        entity_type: 'CHECKLIST_RESPONSE',
        global_id: responseId,
        operation_type: 'SUBMIT_RESPONSE',
        payload,
        status: 'PENDING',
      });

      const savedOp = (await outboxRepo.findById(opId)) ?? {
        id: opId,
        entity_type: 'CHECKLIST_RESPONSE',
        global_id: responseId,
        operation_type: 'SUBMIT_RESPONSE',
        payload,
        dependencies: [],
        status: 'PENDING',
        retries: 0,
      };

      const reloaded = (await inspectionRepo.findById(inspection.id)) ?? {
        ...inspection,
        status: nextStatus,
        started_at: inspection.started_at ?? respondedAt,
        sync_status: 'PENDENTE' as const,
      };

      return { updatedInspection: reloaded, outboxOperation: savedOp };
    }
  );

  return {
    response: {
      id: responseId,
      item_id: params.item.id,
      inspection_id: inspection.id,
      value: serialized,
      observation: finalObservation,
      is_non_conformity: isNonConformity,
      non_conformity_description: finalNcDescription,
      latitude: finalLat,
      longitude: finalLng,
      accuracy: finalAcc,
      responded_at: respondedAt,
    },
    inspection: updatedInspection,
    outboxOperation,
  };
}

/**
 * Conclui a inspeção após validação de todos os itens obrigatórios (RF-05..RF-07, RT-01..RT-04, EX-01, EX-02, CA-02..CA-04):
 * - Bloqueia a conclusão quando existir qualquer item com `required = true` sem resposta.
 * - Quando válida, captura GPS de conclusão (sem travar em caso de recusa/sinal indisponível),
 *   persiste `completed_at`, altera status local para `ENVIADA` e `sync_status` para `PENDENTE` ("Aguardando Sincronização"),
 *   grava coordenadas no SQLite e cria operação `COMPLETE_INSPECTION` com UUID idempotente e dependências na Outbox.
 */
export async function completeInspection(
  params: CompleteInspectionParams,
  dependencies: InspectionLifecycleDependencies = {}
): Promise<CompleteInspectionResult> {
  const nowFn = dependencies.now ?? (() => new Date());
  const db = await resolveDatabase(dependencies);
  await ensureInspectionLocationsTable(db);
  const { inspectionRepo, outboxRepo } = resolveRepositories(db, dependencies);

  const details: InspectionDetailsData | null = await inspectionRepo.findByIdWithDetails(
    params.inspectionId,
    nowFn()
  );

  if (!details) {
    return {
      success: false,
      blockedByPendingItems: false,
      code: 'NOT_FOUND',
      message: 'Inspeção não encontrada no armazenamento local.',
      pendingItems: [],
      progress: null,
      inspection: null,
      completedAt: null,
      location: null,
      locationRecord: null,
      outboxOperation: null,
      isReadOnly: false,
      syncDisplayLabel: null,
    };
  }

  const { inspection, items, responses, sections, evidences } = details;

  if (!hasExecutionPermission(inspection, params.technicianId, params.userRole)) {
    return {
      success: false,
      blockedByPendingItems: false,
      code: 'FORBIDDEN_TECHNICIAN',
      message: 'Permissão negada: somente o técnico atribuído pode concluir esta inspeção.',
      pendingItems: [],
      progress: null,
      inspection,
      completedAt: inspection.completed_at ?? null,
      location: null,
      locationRecord: null,
      outboxOperation: null,
      isReadOnly: isInspectionReadOnly(inspection.status),
      syncDisplayLabel: null,
    };
  }

  const progress = calculateInspectionProgress({
    items,
    responses,
    sections,
    evidences,
  });

  if (isInspectionReadOnly(inspection.status)) {
    return {
      success: false,
      blockedByPendingItems: false,
      code: 'ALREADY_COMPLETED',
      message: `Esta inspeção já foi encerrada (${inspection.status}) e encontra-se em modo somente leitura.`,
      pendingItems: [],
      progress,
      inspection,
      completedAt: inspection.completed_at ?? null,
      location: null,
      locationRecord: null,
      outboxOperation: null,
      isReadOnly: true,
      syncDisplayLabel:
        inspection.sync_status && inspection.sync_status !== 'SINCRONIZADO'
          ? AWAITING_SYNC_LABEL
          : null,
    };
  }

  // RF-05 & RF-06 & CA-02: Bloqueia se houver itens obrigatórios pendentes
  if (progress.pendingRequiredCount > 0) {
    return {
      success: false,
      blockedByPendingItems: true,
      code: 'PENDING_REQUIRED_ITEMS',
      message:
        progress.pendingRequiredCount === 1
          ? 'Existe 1 item obrigatório pendente de preenchimento antes de concluir.'
          : `Existem ${progress.pendingRequiredCount} itens obrigatórios pendentes antes de concluir.`,
      pendingItems: progress.pendingRequiredItems,
      progress,
      inspection,
      completedAt: null,
      location: null,
      locationRecord: null,
      outboxOperation: null,
      isReadOnly: false,
      syncDisplayLabel: null,
    };
  }

  // RF-07: Captura timestamp do dispositivo e GPS pontual de conclusão (EX-01: sem travar)
  const completedAt = nowFn().toISOString();
  const startedAt = inspection.started_at ?? completedAt;
  const locationResult = await captureCurrentLocation({
    locationProvider: params.locationOptions?.locationProvider ?? dependencies.locationProvider,
    timeoutMs: params.locationOptions?.timeoutMs ?? dependencies.locationTimeoutMs,
    accuracy: params.locationOptions?.accuracy,
    now: params.locationOptions?.now ?? nowFn,
  });

  // Coleta dependências pendentes anteriores na Outbox (SPEC-002)
  const pendingOutboxAll = await outboxRepo.findPendingOperations();
  const responseIds = new Set(responses.map((r) => r.id));
  const evidenceIds = new Set(evidences.map((e) => e.id));
  const dependencyIds = pendingOutboxAll
    .filter(
      (op) =>
        op.operation_type !== 'COMPLETE_INSPECTION' &&
        ((op.entity_type === 'INSPECTION' && op.global_id === inspection.id) ||
          (op.entity_type === 'CHECKLIST_RESPONSE' && responseIds.has(op.global_id)) ||
          (op.entity_type === 'EVIDENCE' && evidenceIds.has(op.global_id)))
    )
    .map((op) => op.id);

  const { updatedInspection, locationRecord, outboxOperation } = await runInAtomicTransaction(
    db,
    async () => {
      await inspectionRepo.update(inspection.id, {
        status: 'ENVIADA',
        started_at: startedAt,
        completed_at: completedAt,
        sync_status: 'PENDENTE',
      });

      const locRecord = await upsertInspectionLocation(
        db,
        inspection.id,
        'COMPLETE',
        locationResult
      );

      // RT-02: Também preenche coordenadas nas respostas da inspeção que ainda não possuam GPS
      if (locationResult.captured) {
        await db.runAsync(
          `UPDATE checklist_responses
           SET latitude = COALESCE(latitude, ?),
               longitude = COALESCE(longitude, ?),
               accuracy = COALESCE(accuracy, ?)
           WHERE inspection_id = ?;`,
          [
            locationResult.latitude,
            locationResult.longitude,
            locationResult.accuracy,
            inspection.id,
          ]
        );
      }

      const completePayload = JSON.stringify({
        inspectionId: inspection.id,
        remoteId: inspection.remote_id ?? null,
        startedAt,
        completedAt,
        technicianId: params.technicianId ?? inspection.technician_id ?? null,
        summary: {
          totalItems: progress.totalItems,
          applicableItems: progress.applicableItems,
          answeredItems: progress.answeredItems,
          requiredItems: progress.requiredItems,
          nonConformitiesCount: progress.nonConformitiesCount,
          evidencesCount: progress.evidencesCount,
        },
        locationStatus: locationResult.status,
        location: locationResult.captured
          ? {
              latitude: locationResult.latitude,
              longitude: locationResult.longitude,
              accuracy: locationResult.accuracy,
              timestamp: locationResult.timestamp,
            }
          : null,
      });

      const completeOpId = generateUUID();
      await outboxRepo.create({
        id: completeOpId,
        entity_type: 'INSPECTION',
        global_id: inspection.id,
        operation_type: 'COMPLETE_INSPECTION',
        payload: completePayload,
        dependencies: dependencyIds,
        status: 'PENDING',
      });

      const savedOp = (await outboxRepo.findById(completeOpId)) ?? {
        id: completeOpId,
        entity_type: 'INSPECTION',
        global_id: inspection.id,
        operation_type: 'COMPLETE_INSPECTION',
        payload: completePayload,
        dependencies: dependencyIds,
        status: 'PENDING',
        retries: 0,
      };

      const reloaded = (await inspectionRepo.findById(inspection.id)) ?? {
        ...inspection,
        status: 'ENVIADA' as const,
        started_at: startedAt,
        completed_at: completedAt,
        sync_status: 'PENDENTE' as const,
      };

      return {
        updatedInspection: reloaded,
        locationRecord: locRecord,
        outboxOperation: savedOp,
      };
    }
  );

  return {
    success: true,
    blockedByPendingItems: false,
    code: 'COMPLETED',
    message: locationResult.captured
      ? 'Inspeção concluída localmente! Envio enfileirado (Aguardando Sincronização).'
      : 'Inspeção concluída localmente sem GPS! Envio enfileirado (Aguardando Sincronização).',
    pendingItems: [],
    progress,
    inspection: updatedInspection,
    completedAt,
    location: locationResult,
    locationRecord,
    outboxOperation,
    isReadOnly: true,
    syncDisplayLabel: AWAITING_SYNC_LABEL,
  };
}

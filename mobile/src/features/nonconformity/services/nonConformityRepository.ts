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
import type { Inspection } from '@/infrastructure/database/types';
import { generateUUID } from '@/infrastructure/sync/uuid';
import { isInspectionReadOnly } from '@/features/inspections/services/inspectionLifecycleService';
import {
  NON_CONFORMITY_SEVERITIES,
  NON_CONFORMITY_SEVERITY_META,
  READ_ONLY_NON_CONFORMITY_MESSAGE,
  type CreateNonConformityInput,
  type DeleteNonConformityOptions,
  type DeleteNonConformityResult,
  type FindNonConformitiesOptions,
  type NonConformity,
  type NonConformityBusinessStatus,
  type NonConformityMutationResult,
  type NonConformitySeverity,
  type NonConformitySeverityGroup,
  type NonConformitySyncStatus,
  type UpdateNonConformityInput,
} from '../domain/types';
import { validateNonConformity } from '../schemas/nonConformitySchema';

export interface NonConformityRow {
  id: string;
  remote_id: string | null;
  inspection_id: string;
  item_id: string | null;
  item_title: string | null;
  title: string;
  description: string;
  severity: NonConformitySeverity;
  status: NonConformityBusinessStatus;
  evidence_uris_json: string;
  evidence_ids_json: string;
  sync_status: NonConformitySyncStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NonConformityRepositoryDependencies {
  db?: SQLiteDatabase;
  inspectionRepo?: InspectionRepository;
  outboxRepo?: OutboxRepository;
  uuidGenerator?: () => string;
  now?: () => Date;
}

export interface NonConformityCounts {
  total: number;
  open: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  pendingSync: number;
}

const SEVERITY_SORT_ORDER: readonly NonConformitySeverity[] = [
  'CRITICA',
  'ALTA',
  'MEDIA',
  'BAIXA',
];

function parseJsonStringArray(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function mapRowToNonConformity(row: NonConformityRow): NonConformity {
  return {
    id: row.id,
    remote_id: row.remote_id ?? null,
    inspection_id: row.inspection_id,
    item_id: row.item_id ?? null,
    item_title: row.item_title ?? null,
    title: row.title,
    description: row.description ?? '',
    severity: row.severity,
    status: row.status,
    evidence_uris: parseJsonStringArray(row.evidence_uris_json),
    evidence_ids: parseJsonStringArray(row.evidence_ids_json),
    sync_status: row.sync_status,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
 * Garante a criação idempotente da tabela `non_conformities` e seus índices no SQLite local (RT-02 / RF-06).
 */
export async function ensureNonConformitiesTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS non_conformities (
      id TEXT PRIMARY KEY,
      remote_id TEXT UNIQUE,
      inspection_id TEXT NOT NULL,
      item_id TEXT,
      item_title TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL CHECK(severity IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'RESOLVED', 'CANCELED')),
      evidence_uris_json TEXT NOT NULL DEFAULT '[]',
      evidence_ids_json TEXT NOT NULL DEFAULT '[]',
      sync_status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(sync_status IN ('SINCRONIZADO', 'PENDENTE', 'SINCRONIZANDO', 'ERRO', 'CONFLITO')),
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES checklist_items(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_non_conformities_inspection
      ON non_conformities(inspection_id, severity, created_at);
    CREATE INDEX IF NOT EXISTS idx_non_conformities_item
      ON non_conformities(item_id);
    CREATE INDEX IF NOT EXISTS idx_non_conformities_severity
      ON non_conformities(severity);
  `);
}

async function hasTable(db: SQLiteDatabase, tableName: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;",
    [tableName]
  );
  return Boolean(row?.name);
}

async function linkEvidenceFilesToNonConformity(
  db: SQLiteDatabase,
  nonConformityId: string,
  inspectionId: string,
  evidenceIds: string[]
): Promise<void> {
  if (evidenceIds.length === 0) {
    return;
  }
  if (!(await hasTable(db, 'evidence_files'))) {
    return;
  }
  const placeholders = evidenceIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE evidence_files
     SET non_conformity_id = ?
     WHERE inspection_id = ? AND id IN (${placeholders});`,
    [nonConformityId, inspectionId, ...evidenceIds]
  );
}

/**
 * Repositório SQLite Offline-First para Não Conformidades (TASK-017 / Passo 2).
 * Garante gravação atômica na tabela `non_conformities` e geração/atualização
 * de mutações na fila Outbox, respeitando bloqueio de inspeções concluídas/aprovadas (EX-02).
 */
export class NonConformityRepository {
  private db?: SQLiteDatabase;
  private inspectionRepo?: InspectionRepository;
  private outboxRepo?: OutboxRepository;
  private uuidGenerator: () => string;
  private nowFn: () => Date;

  constructor(deps: NonConformityRepositoryDependencies = {}) {
    this.db = deps.db;
    this.inspectionRepo = deps.inspectionRepo;
    this.outboxRepo = deps.outboxRepo;
    this.uuidGenerator = deps.uuidGenerator ?? generateUUID;
    this.nowFn = deps.now ?? (() => new Date());
  }

  private async resolveContext(
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<{
    db: SQLiteDatabase;
    inspectionRepo: InspectionRepository;
    outboxRepo: OutboxRepository;
    uuid: () => string;
    now: () => Date;
  }> {
    const db = overrideDeps.db ?? this.db ?? (await getDatabase());
    await ensureNonConformitiesTable(db);

    const inspectionRepo =
      overrideDeps.inspectionRepo ??
      this.inspectionRepo ??
      (overrideDeps.db || this.db ? new InspectionRepository(db) : defaultInspectionRepo);

    const outboxRepo =
      overrideDeps.outboxRepo ??
      this.outboxRepo ??
      (overrideDeps.db || this.db ? new OutboxRepository(db) : defaultOutboxRepo);

    return {
      db,
      inspectionRepo,
      outboxRepo,
      uuid: overrideDeps.uuidGenerator ?? this.uuidGenerator,
      now: overrideDeps.now ?? this.nowFn,
    };
  }

  private async resolveInspection(
    inspectionRepo: InspectionRepository,
    inspectionId: string
  ): Promise<Inspection | null> {
    if (!inspectionId) return null;
    return (
      (await inspectionRepo.findById(inspectionId)) ??
      (await inspectionRepo.findByRemoteId(inspectionId))
    );
  }

  /**
   * Registra uma nova não conformidade no SQLite local e enfileira CREATE_NON_CONFORMITY na Outbox (RT-02 / CA-01 / CA-03).
   */
  async create(
    input: CreateNonConformityInput,
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<NonConformityMutationResult> {
    if (!input.inspection_id || !String(input.inspection_id).trim()) {
      const preValidation = validateNonConformity(input);
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message:
          preValidation.errors[0] ??
          'A não conformidade deve pertencer a uma inspeção específica.',
        nonConformity: null,
        fieldErrors: preValidation.fieldErrors,
      };
    }

    const { db, inspectionRepo, outboxRepo, uuid, now } =
      await this.resolveContext(overrideDeps);

    const inspection = await this.resolveInspection(
      inspectionRepo,
      input.inspection_id.trim()
    );

    if (!inspection) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: 'Inspeção não encontrada no armazenamento local.',
        nonConformity: null,
      };
    }

    if (!hasExecutionPermission(inspection, input.technicianId, input.userRole)) {
      return {
        success: false,
        code: 'FORBIDDEN_TECHNICIAN',
        message:
          'Permissão negada: somente o técnico atribuído pode registrar não conformidades nesta inspeção.',
        nonConformity: null,
      };
    }

    if (isInspectionReadOnly(inspection.status)) {
      return {
        success: false,
        code: 'READ_ONLY_INSPECTION',
        message: READ_ONLY_NON_CONFORMITY_MESSAGE,
        nonConformity: null,
      };
    }

    const validation = validateNonConformity({
      ...input,
      inspection_id: inspection.id,
    });

    if (!validation.success || !validation.data) {
      const primaryMessage =
        validation.fieldErrors.evidence_uris ??
        validation.errors[0] ??
        'Dados inválidos para registro de não conformidade.';
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: primaryMessage,
        nonConformity: null,
        fieldErrors: validation.fieldErrors,
      };
    }

    const validated = validation.data;
    const ncId = validated.id && validated.id.length > 0 ? validated.id : uuid();
    const timestamp = now().toISOString();

    let resolvedItemTitle = validated.item_title ?? null;
    if (validated.item_id && !resolvedItemTitle) {
      const itemRow = await db.getFirstAsync<{ title: string }>(
        'SELECT title FROM checklist_items WHERE id = ?;',
        [validated.item_id]
      );
      resolvedItemTitle = itemRow?.title ?? null;
    }

    const evidenceUrisJson = JSON.stringify(validated.evidence_uris);
    const evidenceIdsJson = JSON.stringify(validated.evidence_ids);
    const outboxOpId = uuid();

    const outboxPayload = JSON.stringify({
      id: ncId,
      inspectionId: inspection.id,
      remoteInspectionId: inspection.remote_id ?? null,
      itemId: validated.item_id ?? null,
      itemTitle: resolvedItemTitle,
      title: validated.title,
      description: validated.description ?? '',
      severity: validated.severity,
      status: 'OPEN',
      evidenceUris: validated.evidence_uris,
      evidenceIds: validated.evidence_ids,
      createdBy: input.created_by ?? input.technicianId ?? inspection.technician_id ?? null,
      createdAtDevice: timestamp,
    });

    await runInAtomicTransaction(db, async () => {
      await db.runAsync(
        `INSERT INTO non_conformities (
          id, remote_id, inspection_id, item_id, item_title, title, description,
          severity, status, evidence_uris_json, evidence_ids_json, sync_status,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          ncId,
          null,
          inspection.id,
          validated.item_id ?? null,
          resolvedItemTitle,
          validated.title,
          validated.description ?? '',
          validated.severity,
          'OPEN',
          evidenceUrisJson,
          evidenceIdsJson,
          'PENDENTE',
          input.created_by ?? input.technicianId ?? inspection.technician_id ?? null,
          timestamp,
          timestamp,
        ]
      );

      await linkEvidenceFilesToNonConformity(
        db,
        ncId,
        inspection.id,
        validated.evidence_ids
      );

      await inspectionRepo.update(inspection.id, {
        sync_status: 'PENDENTE',
      });

      await outboxRepo.create({
        id: outboxOpId,
        entity_type: 'NON_CONFORMITY',
        global_id: ncId,
        operation_type: 'CREATE_NON_CONFORMITY',
        payload: outboxPayload,
        status: 'PENDING',
        created_at: timestamp,
        updated_at: timestamp,
      });
    });

    const created: NonConformity = {
      id: ncId,
      remote_id: null,
      inspection_id: inspection.id,
      item_id: validated.item_id ?? null,
      item_title: resolvedItemTitle,
      title: validated.title,
      description: validated.description ?? '',
      severity: validated.severity,
      status: 'OPEN',
      evidence_uris: validated.evidence_uris,
      evidence_ids: validated.evidence_ids,
      sync_status: 'PENDENTE',
      created_by: input.created_by ?? input.technicianId ?? inspection.technician_id ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    return {
      success: true,
      code: 'CREATED',
      message: 'Não conformidade registrada localmente e adicionada à fila de sincronização.',
      nonConformity: created,
      outboxOperationId: outboxOpId,
    };
  }

  /**
   * Atualiza uma não conformidade local com validação Zod e sincronização Outbox (EX-02 bloqueia inspeções concluídas/aprovadas).
   */
  async update(
    id: string,
    input: UpdateNonConformityInput,
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<NonConformityMutationResult> {
    const { db, inspectionRepo, outboxRepo, uuid, now } =
      await this.resolveContext(overrideDeps);

    const existingRow = await db.getFirstAsync<NonConformityRow>(
      'SELECT * FROM non_conformities WHERE id = ?;',
      [id]
    );
    if (!existingRow) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: 'Não conformidade não encontrada no armazenamento local.',
        nonConformity: null,
      };
    }

    const existing = mapRowToNonConformity(existingRow);
    const inspection = await this.resolveInspection(
      inspectionRepo,
      existing.inspection_id
    );

    if (!inspection) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: 'Inspeção associada não encontrada localmente.',
        nonConformity: null,
      };
    }

    if (!hasExecutionPermission(inspection, input.technicianId, input.userRole)) {
      return {
        success: false,
        code: 'FORBIDDEN_TECHNICIAN',
        message:
          'Permissão negada: somente o técnico atribuído pode editar esta não conformidade.',
        nonConformity: null,
      };
    }

    if (isInspectionReadOnly(inspection.status)) {
      return {
        success: false,
        code: 'READ_ONLY_INSPECTION',
        message: READ_ONLY_NON_CONFORMITY_MESSAGE,
        nonConformity: null,
      };
    }

    if (existing.status === 'CANCELED') {
      return {
        success: false,
        code: 'INVALID_STATUS',
        message: 'Não é possível editar uma não conformidade cancelada.',
        nonConformity: null,
      };
    }

    const mergedCandidate = {
      id: existing.id,
      inspection_id: existing.inspection_id,
      item_id: input.item_id !== undefined ? input.item_id : existing.item_id,
      item_title:
        input.item_title !== undefined ? input.item_title : existing.item_title,
      title: input.title !== undefined ? input.title : existing.title,
      description:
        input.description !== undefined ? input.description : existing.description,
      severity: input.severity !== undefined ? input.severity : existing.severity,
      evidence_uris:
        input.evidence_uris !== undefined
          ? input.evidence_uris
          : existing.evidence_uris,
      evidence_ids:
        input.evidence_ids !== undefined ? input.evidence_ids : existing.evidence_ids,
    };

    const validation = validateNonConformity(mergedCandidate);
    if (!validation.success || !validation.data) {
      const primaryMessage =
        validation.fieldErrors.evidence_uris ??
        validation.errors[0] ??
        'Dados inválidos para atualização da não conformidade.';
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: primaryMessage,
        nonConformity: null,
        fieldErrors: validation.fieldErrors,
      };
    }

    const validated = validation.data;
    const nextStatus = input.status ?? existing.status;
    const timestamp = now().toISOString();
    const evidenceUrisJson = JSON.stringify(validated.evidence_uris);
    const evidenceIdsJson = JSON.stringify(validated.evidence_ids);

    let outboxOpId: string | null = null;

    await runInAtomicTransaction(db, async () => {
      await db.runAsync(
        `UPDATE non_conformities
         SET item_id = ?,
             item_title = ?,
             title = ?,
             description = ?,
             severity = ?,
             status = ?,
             evidence_uris_json = ?,
             evidence_ids_json = ?,
             sync_status = ?,
             updated_at = ?
         WHERE id = ?;`,
        [
          validated.item_id ?? null,
          validated.item_title ?? null,
          validated.title,
          validated.description ?? '',
          validated.severity,
          nextStatus,
          evidenceUrisJson,
          evidenceIdsJson,
          'PENDENTE',
          timestamp,
          id,
        ]
      );

      await linkEvidenceFilesToNonConformity(
        db,
        id,
        inspection.id,
        validated.evidence_ids
      );

      await inspectionRepo.update(inspection.id, {
        sync_status: 'PENDENTE',
      });

      const existingOps = await outboxRepo.findByEntity('NON_CONFORMITY', id);
      const pendingCreateOp = existingOps.find(
        (op) => op.operation_type === 'CREATE_NON_CONFORMITY' && op.status === 'PENDING'
      );

      const updatedPayload = JSON.stringify({
        id,
        remoteId: existing.remote_id ?? null,
        inspectionId: inspection.id,
        remoteInspectionId: inspection.remote_id ?? null,
        itemId: validated.item_id ?? null,
        itemTitle: validated.item_title ?? null,
        title: validated.title,
        description: validated.description ?? '',
        severity: validated.severity,
        status: nextStatus,
        evidenceUris: validated.evidence_uris,
        evidenceIds: validated.evidence_ids,
        updatedAtDevice: timestamp,
      });

      if (pendingCreateOp) {
        await outboxRepo.update(pendingCreateOp.id, { payload: updatedPayload });
        outboxOpId = pendingCreateOp.id;
      } else {
        outboxOpId = uuid();
        await outboxRepo.create({
          id: outboxOpId,
          entity_type: 'NON_CONFORMITY',
          global_id: id,
          operation_type: 'UPDATE_NON_CONFORMITY',
          payload: updatedPayload,
          status: 'PENDING',
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
    });

    const updated: NonConformity = {
      ...existing,
      item_id: validated.item_id ?? null,
      item_title: validated.item_title ?? null,
      title: validated.title,
      description: validated.description ?? '',
      severity: validated.severity,
      status: nextStatus,
      evidence_uris: validated.evidence_uris,
      evidence_ids: validated.evidence_ids,
      sync_status: 'PENDENTE',
      updated_at: timestamp,
    };

    return {
      success: true,
      code: 'UPDATED',
      message: 'Não conformidade atualizada localmente.',
      nonConformity: updated,
      outboxOperationId: outboxOpId,
    };
  }

  /**
   * RT-03 / RN-056:
   * - Antes do envio ao servidor: permite exclusão física local e remove mutação pendente da Outbox.
   * - Após o envio ao servidor: converte em cancelamento lógico (`CANCELED`) e enfileira `CANCEL_NON_CONFORMITY` para auditoria no backend.
   * - Bloqueia se a inspeção já estiver concluída/aprovada (EX-02).
   */
  async deleteOrCancel(
    id: string,
    options: DeleteNonConformityOptions = {},
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<DeleteNonConformityResult> {
    const { db, inspectionRepo, outboxRepo, uuid, now } =
      await this.resolveContext(overrideDeps);

    const existingRow = await db.getFirstAsync<NonConformityRow>(
      'SELECT * FROM non_conformities WHERE id = ?;',
      [id]
    );
    if (!existingRow) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: 'Não conformidade não encontrada no armazenamento local.',
        deletedId: null,
        audited: false,
        nonConformity: null,
      };
    }

    const existing = mapRowToNonConformity(existingRow);
    const inspection = await this.resolveInspection(
      inspectionRepo,
      existing.inspection_id
    );

    if (!inspection) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: 'Inspeção associada não encontrada localmente.',
        deletedId: null,
        audited: false,
        nonConformity: null,
      };
    }

    if (!hasExecutionPermission(inspection, options.technicianId, options.userRole)) {
      return {
        success: false,
        code: 'FORBIDDEN_TECHNICIAN',
        message:
          'Permissão negada: somente o técnico atribuído pode excluir ou cancelar esta não conformidade.',
        deletedId: null,
        audited: false,
        nonConformity: null,
      };
    }

    if (isInspectionReadOnly(inspection.status)) {
      return {
        success: false,
        code: 'READ_ONLY_INSPECTION',
        message: READ_ONLY_NON_CONFORMITY_MESSAGE,
        deletedId: null,
        audited: false,
        nonConformity: null,
      };
    }

    const isAlreadySent =
      existing.sync_status === 'SINCRONIZADO' || Boolean(existing.remote_id);

    if (!isAlreadySent) {
      await runInAtomicTransaction(db, async () => {
        await db.runAsync('DELETE FROM non_conformities WHERE id = ?;', [id]);
        await db.runAsync(
          "DELETE FROM outbox_operations WHERE entity_type = 'NON_CONFORMITY' AND global_id = ?;",
          [id]
        );
        if (await hasTable(db, 'evidence_files')) {
          await db.runAsync(
            'UPDATE evidence_files SET non_conformity_id = NULL WHERE non_conformity_id = ?;',
            [id]
          );
        }
      });

      return {
        success: true,
        code: 'DELETED',
        message: 'Não conformidade removida localmente antes do envio.',
        deletedId: id,
        audited: false,
        nonConformity: null,
        outboxOperationId: null,
      };
    }

    const timestamp = now().toISOString();
    const outboxOpId = uuid();
    const cancelPayload = JSON.stringify({
      id,
      remoteId: existing.remote_id ?? null,
      inspectionId: inspection.id,
      remoteInspectionId: inspection.remote_id ?? null,
      previousStatus: existing.status,
      newStatus: 'CANCELED',
      reason:
        options.reason?.trim() ||
        'Cancelamento de não conformidade registrado pelo técnico para trilha de auditoria.',
      canceledBy: options.technicianId ?? null,
      canceledAtDevice: timestamp,
    });

    await runInAtomicTransaction(db, async () => {
      await db.runAsync(
        `UPDATE non_conformities
         SET status = 'CANCELED',
             sync_status = 'PENDENTE',
             updated_at = ?
         WHERE id = ?;`,
        [timestamp, id]
      );

      await inspectionRepo.update(inspection.id, {
        sync_status: 'PENDENTE',
      });

      await outboxRepo.create({
        id: outboxOpId,
        entity_type: 'NON_CONFORMITY',
        global_id: id,
        operation_type: 'CANCEL_NON_CONFORMITY',
        payload: cancelPayload,
        status: 'PENDING',
        created_at: timestamp,
        updated_at: timestamp,
      });
    });

    const canceledRecord: NonConformity = {
      ...existing,
      status: 'CANCELED',
      sync_status: 'PENDENTE',
      updated_at: timestamp,
    };

    return {
      success: true,
      code: 'CANCELED_AUDIT',
      message:
        'Não conformidade já sincronizada marcada como cancelada para auditoria no backend.',
      deletedId: id,
      audited: true,
      nonConformity: canceledRecord,
      outboxOperationId: outboxOpId,
    };
  }

  /**
   * Busca uma não conformidade pelo ID primário.
   */
  async findById(
    id: string,
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<NonConformity | null> {
    const { db } = await this.resolveContext(overrideDeps);
    const row = await db.getFirstAsync<NonConformityRow>(
      'SELECT * FROM non_conformities WHERE id = ?;',
      [id]
    );
    return row ? mapRowToNonConformity(row) : null;
  }

  /**
   * Lista todas as não conformidades de uma inspeção 100% offline, ordenadas por gravidade decrescente.
   */
  async findByInspectionId(
    inspectionId: string,
    options: FindNonConformitiesOptions = {},
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<NonConformity[]> {
    if (!inspectionId) return [];
    const { db, inspectionRepo } = await this.resolveContext(overrideDeps);
    const inspection = await this.resolveInspection(inspectionRepo, inspectionId);
    const resolvedId = inspection?.id ?? inspectionId;

    const whereClauses = ['inspection_id = ?'];
    const params: any[] = [resolvedId];

    if (!options.includeCanceled) {
      whereClauses.push("status != 'CANCELED'");
    }
    if (options.severity) {
      whereClauses.push('severity = ?');
      params.push(options.severity);
    }
    if (options.itemId) {
      whereClauses.push('item_id = ?');
      params.push(options.itemId);
    }

    const rows = await db.getAllAsync<NonConformityRow>(
      `SELECT * FROM non_conformities
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY
         CASE severity
           WHEN 'CRITICA' THEN 1
           WHEN 'ALTA' THEN 2
           WHEN 'MEDIA' THEN 3
           WHEN 'BAIXA' THEN 4
           ELSE 5
         END ASC,
         created_at DESC;`,
      params
    );

    return rows.map(mapRowToNonConformity);
  }

  /**
   * Busca não conformidades vinculadas a um item específico do checklist.
   */
  async findByItemId(
    inspectionId: string,
    itemId: string,
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<NonConformity[]> {
    return this.findByInspectionId(inspectionId, { itemId }, overrideDeps);
  }

  /**
   * Agrupa não conformidades por nível de gravidade (CRITICA -> ALTA -> MEDIA -> BAIXA).
   */
  async findGroupedBySeverity(
    inspectionId: string,
    options: FindNonConformitiesOptions = {},
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<NonConformitySeverityGroup[]> {
    const all = await this.findByInspectionId(inspectionId, options, overrideDeps);
    const grouped = new Map<NonConformitySeverity, NonConformity[]>();

    for (const sev of NON_CONFORMITY_SEVERITIES) {
      grouped.set(sev, []);
    }

    for (const nc of all) {
      const bucket = grouped.get(nc.severity) ?? [];
      bucket.push(nc);
      grouped.set(nc.severity, bucket);
    }

    return SEVERITY_SORT_ORDER.map((severity) => ({
      severity,
      meta: NON_CONFORMITY_SEVERITY_META[severity],
      items: grouped.get(severity) ?? [],
    })).filter((group) => group.items.length > 0);
  }

  /**
   * Calcula métricas resumidas das não conformidades de uma inspeção no SQLite.
   */
  async countByInspectionId(
    inspectionId: string,
    overrideDeps: NonConformityRepositoryDependencies = {}
  ): Promise<NonConformityCounts> {
    const list = await this.findByInspectionId(
      inspectionId,
      { includeCanceled: false },
      overrideDeps
    );

    const counts: NonConformityCounts = {
      total: list.length,
      open: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      pendingSync: 0,
    };

    for (const item of list) {
      if (item.status === 'OPEN') counts.open += 1;
      if (item.severity === 'CRITICA') counts.critical += 1;
      else if (item.severity === 'ALTA') counts.high += 1;
      else if (item.severity === 'MEDIA') counts.medium += 1;
      else if (item.severity === 'BAIXA') counts.low += 1;
      if (item.sync_status !== 'SINCRONIZADO') counts.pendingSync += 1;
    }

    return counts;
  }
}

export const nonConformityRepository = new NonConformityRepository();

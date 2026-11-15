import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db';
import { mapRowToOutboxOperation, type OutboxRow } from './outboxRepository';
import {
  type ChecklistItem,
  type ChecklistResponse,
  type ChecklistSection,
  type Inspection,
  type InspectionActionConfig,
  type InspectionBusinessStatus,
  type InspectionDetailsData,
  type InspectionEvidence,
  type InspectionFilterParams,
  type InspectionFilterTab,
  type InspectionPriority,
  type InspectionSummaryMetrics,
  type InspectionSyncStatus,
} from '../types';

export interface InspectionRow {
  id: string;
  remote_id: string | null;
  template_id: string;
  template_version: number;
  client_name: string;
  site_name: string;
  site_address: string | null;
  equipment_name: string;
  equipment_code: string | null;
  equipment_qr_code: string | null;
  status: string;
  priority: string | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  sync_status: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionExtraMetadata {
  technician_id?: string | null;
  technician_name?: string | null;
  title?: string | null;
  instructions?: string | null;
}

/**
 * Armazena metadados opcionais enriquecidos sem alterar o schema v1 do SQLite.
 */
const inspectionMetadataMap = new Map<string, InspectionExtraMetadata>();

const FINISHED_OR_CANCELED_STATUSES = new Set<string>([
  'ENVIADA',
  'EM_REVISÃO',
  'APROVADA',
  'CANCELADA',
  'SUBMITTED',
  'IN_REVIEW',
  'APPROVED',
  'CANCELLED',
]);

const PENDING_SYNC_STATUSES = new Set<string>([
  'PENDENTE',
  'SINCRONIZANDO',
  'ERRO',
  'CONFLITO',
]);

/**
 * Mapeia filtros de abas ou estados específicos para os valores persistidos no SQLite.
 */
export function resolveStatusesForFilter(
  filter?: InspectionFilterTab | InspectionBusinessStatus | string
): string[] | null {
  if (!filter) {
    return null;
  }

  const normalized = String(filter).trim().toUpperCase();
  if (!normalized || normalized === 'TODAS' || normalized === 'ALL') {
    return null;
  }

  switch (normalized) {
    case 'PENDENTES':
    case 'PENDENTE':
    case 'PENDING':
      return ['ATRIBUÍDA', 'RASCUNHO', 'REPROVADA', 'ASSIGNED', 'DRAFT', 'REJECTED'];
    case 'EM_ANDAMENTO':
    case 'IN_PROGRESS':
      return ['EM_ANDAMENTO', 'IN_PROGRESS'];
    case 'CONCLUÍDAS':
    case 'CONCLUIDAS':
    case 'CONCLUÍDA':
    case 'CONCLUIDA':
    case 'COMPLETED':
      return ['ENVIADA', 'EM_REVISÃO', 'APROVADA', 'SUBMITTED', 'IN_REVIEW', 'APPROVED'];
    default:
      return [filter];
  }
}

/**
 * Verifica se a inspeção está atrasada em relação à data de referência.
 * Inspeções já enviadas, em revisão, aprovadas ou canceladas não são consideradas atrasadas.
 */
export function isInspectionOverdue(
  inspection: Pick<Inspection, 'due_date' | 'status'>,
  referenceDate: Date = new Date()
): boolean {
  if (!inspection.due_date) {
    return false;
  }

  const normalizedStatus = String(inspection.status ?? '').trim().toUpperCase();
  if (FINISHED_OR_CANCELED_STATUSES.has(normalizedStatus)) {
    return false;
  }

  const dueTimestamp = new Date(inspection.due_date).getTime();
  if (Number.isNaN(dueTimestamp)) {
    return false;
  }

  return dueTimestamp < referenceDate.getTime();
}

/**
 * Verifica se a data prevista da inspeção coincide com o dia da data de referência (YYYY-MM-DD).
 */
export function isInspectionDueToday(
  inspection: Pick<Inspection, 'due_date'>,
  referenceDate: Date = new Date()
): boolean {
  if (!inspection.due_date) {
    return false;
  }

  const refIsoDate = referenceDate.toISOString().slice(0, 10);
  const rawDue = inspection.due_date.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(rawDue)) {
    return rawDue.slice(0, 10) === refIsoDate;
  }

  const parsedDue = new Date(rawDue);
  if (Number.isNaN(parsedDue.getTime())) {
    return false;
  }

  return parsedDue.toISOString().slice(0, 10) === refIsoDate;
}

/**
 * Indica se a inspeção possui alterações pendentes de envio/sincronização.
 */
export function isInspectionPendingSync(
  inspection: Pick<Inspection, 'id' | 'sync_status'>,
  pendingOutboxIds?: Set<string>
): boolean {
  const normalizedSync = String(inspection.sync_status ?? '').trim().toUpperCase();
  if (PENDING_SYNC_STATUSES.has(normalizedSync)) {
    return true;
  }

  return Boolean(pendingOutboxIds && pendingOutboxIds.has(inspection.id));
}

/**
 * Verifica se a inspeção pertence ao técnico autenticado (ou não possui restrição local explícita).
 */
export function isInspectionAssignedToTechnician(
  inspection: Pick<Inspection, 'technician_id'>,
  technicianId?: string | null
): boolean {
  if (!technicianId || !inspection.technician_id) {
    return true;
  }
  return inspection.technician_id === technicianId;
}

/**
 * Determina o botão de ação dinâmico para a tela de detalhes da inspeção (RF-05, CA-03).
 */
export function resolveInspectionAction(
  status: InspectionBusinessStatus | string
): InspectionActionConfig {
  const normalized = String(status ?? '').trim().toUpperCase();

  if (normalized === 'EM_ANDAMENTO' || normalized === 'IN_PROGRESS') {
    return {
      type: 'CONTINUE',
      label: 'Continuar Checklist',
      shortLabel: 'Continuar',
      icon: 'playlist-play',
      variant: 'primary',
      disabled: false,
      isReadOnly: false,
    };
  }

  if (
    normalized === 'ATRIBUÍDA' ||
    normalized === 'ATRIBUIDA' ||
    normalized === 'RASCUNHO' ||
    normalized === 'REPROVADA' ||
    normalized === 'ASSIGNED' ||
    normalized === 'DRAFT' ||
    normalized === 'REJECTED'
  ) {
    return {
      type: 'START',
      label: 'Iniciar Inspeção',
      shortLabel: 'Iniciar',
      icon: 'play-arrow',
      variant: 'primary',
      disabled: false,
      isReadOnly: false,
    };
  }

  return {
    type: 'VIEW',
    label: 'Consultar',
    shortLabel: 'Consultar',
    icon: 'visibility',
    variant: 'secondary',
    disabled: false,
    isReadOnly: true,
  };
}

export function mapRowToInspection(
  row: InspectionRow,
  metadataOverride?: InspectionExtraMetadata
): Inspection {
  const metadata = metadataOverride ?? inspectionMetadataMap.get(row.id);

  return {
    id: row.id,
    remote_id: row.remote_id,
    template_id: row.template_id,
    template_version: row.template_version,
    client_name: row.client_name,
    site_name: row.site_name,
    site_address: row.site_address,
    equipment_name: row.equipment_name,
    equipment_code: row.equipment_code,
    equipment_qr_code: row.equipment_qr_code,
    status: row.status as InspectionBusinessStatus,
    priority: (row.priority ?? 'MEDIA') as InspectionPriority,
    due_date: row.due_date,
    started_at: row.started_at,
    completed_at: row.completed_at,
    sync_status: (row.sync_status ?? 'SINCRONIZADO') as InspectionSyncStatus,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,

    technician_id: metadata?.technician_id ?? undefined,
    technician_name: metadata?.technician_name ?? undefined,
    title: metadata?.title ?? undefined,
    instructions: metadata?.instructions ?? undefined,

    // Aliases para retrocompatibilidade com UI legada
    client: row.client_name,
    site: row.site_name,
    equipment: row.equipment_name,
  };
}

function hasExtraMetadata(
  data: Partial<Inspection>
): data is Partial<Inspection> & InspectionExtraMetadata {
  return (
    data.technician_id !== undefined ||
    data.technician_name !== undefined ||
    data.title !== undefined ||
    data.instructions !== undefined
  );
}

/**
 * Repositório SQLite para a entidade Inspection (SPEC-001).
 * Implementa operações CRUD e consultas offline-first tipadas.
 */
export class InspectionRepository {
  private static dbMetadata = new WeakMap<SQLiteDatabase, Map<string, InspectionExtraMetadata>>();
  private db?: SQLiteDatabase;

  constructor(db?: SQLiteDatabase) {
    this.db = db;
  }

  private async getDb(): Promise<SQLiteDatabase> {
    return this.db ?? getDatabase();
  }

  private getMetadataStore(db: SQLiteDatabase): Map<string, InspectionExtraMetadata> {
    let storeMap = InspectionRepository.dbMetadata.get(db);
    if (!storeMap) {
      storeMap = new Map<string, InspectionExtraMetadata>();
      InspectionRepository.dbMetadata.set(db, storeMap);
    }
    return storeMap;
  }

  private saveMetadata(
    db: SQLiteDatabase,
    id: string,
    data: Partial<Inspection>,
    mergeExisting: boolean
  ): void {
    const dbStore = this.getMetadataStore(db);

    if (!mergeExisting) {
      if (!hasExtraMetadata(data)) {
        dbStore.delete(id);
        inspectionMetadataMap.delete(id);
        return;
      }

      const next: InspectionExtraMetadata = {
        technician_id: data.technician_id,
        technician_name: data.technician_name,
        title: data.title,
        instructions: data.instructions,
      };
      dbStore.set(id, next);
      inspectionMetadataMap.set(id, next);
      return;
    }

    if (!hasExtraMetadata(data)) {
      return;
    }

    const current = dbStore.get(id) ?? inspectionMetadataMap.get(id) ?? {};
    const merged: InspectionExtraMetadata = {
      technician_id: data.technician_id !== undefined ? data.technician_id : current.technician_id,
      technician_name: data.technician_name !== undefined ? data.technician_name : current.technician_name,
      title: data.title !== undefined ? data.title : current.title,
      instructions: data.instructions !== undefined ? data.instructions : current.instructions,
    };
    dbStore.set(id, merged);
    inspectionMetadataMap.set(id, merged);
  }

  private mapRow(db: SQLiteDatabase, row: InspectionRow): Inspection {
    const dbStore = this.getMetadataStore(db);
    const meta = dbStore.get(row.id);
    return mapRowToInspection(row, meta ?? {});
  }

  /**
   * Retorna todas as inspeções ordenadas pela data limite e data de criação.
   */
  async findAll(): Promise<Inspection[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<InspectionRow>(
      'SELECT * FROM inspections ORDER BY due_date ASC, created_at DESC;'
    );
    return rows.map((row) => this.mapRow(db, row));
  }

  /**
   * Consulta tipada com filtros combinados de estado, busca textual, prioridade,
   * sincronização, técnico atribuído e prazos, executada primariamente no SQLite.
   */
  async findWithFilters(
    filters: InspectionFilterParams = {},
    referenceDate: Date = new Date()
  ): Promise<Inspection[]> {
    const db = await this.getDb();
    const whereClauses: string[] = [];
    const params: any[] = [];

    const statuses = resolveStatusesForFilter(filters.status);
    if (statuses && statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(', ');
      whereClauses.push(`status IN (${placeholders})`);
      params.push(...statuses);
    }

    if (filters.priority && String(filters.priority).toUpperCase() !== 'TODAS') {
      whereClauses.push("UPPER(COALESCE(priority, 'MEDIA')) = ?");
      params.push(String(filters.priority).trim().toUpperCase());
    }

    if (filters.syncStatus) {
      whereClauses.push('sync_status = ?');
      params.push(filters.syncStatus);
    }

    const trimmedQuery = filters.searchQuery?.trim();
    if (trimmedQuery) {
      const term = `%${trimmedQuery.toLowerCase()}%`;
      whereClauses.push(
        `(
          LOWER(client_name) LIKE ?
          OR LOWER(site_name) LIKE ?
          OR LOWER(COALESCE(site_address, '')) LIKE ?
          OR LOWER(equipment_name) LIKE ?
          OR LOWER(COALESCE(equipment_code, '')) LIKE ?
          OR LOWER(COALESCE(equipment_qr_code, '')) LIKE ?
        )`
      );
      params.push(term, term, term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM inspections
      ${whereSql}
      ORDER BY
        CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END ASC,
        due_date ASC,
        created_at DESC;
    `;

    const rows = await db.getAllAsync<InspectionRow>(sql, params);
    let results = rows.map((row) => this.mapRow(db, row));

    if (filters.technicianId) {
      results = results.filter((insp) =>
        isInspectionAssignedToTechnician(insp, filters.technicianId)
      );
    }

    if (filters.onlyOverdue) {
      results = results.filter((insp) => isInspectionOverdue(insp, referenceDate));
    }

    if (filters.onlyDueToday) {
      results = results.filter((insp) => isInspectionDueToday(insp, referenceDate));
    }

    return results;
  }

  /**
   * Busca uma inspeção pelo ID primário.
   */
  async findById(id: string): Promise<Inspection | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<InspectionRow>(
      'SELECT * FROM inspections WHERE id = ?;',
      [id]
    );
    return row ? this.mapRow(db, row) : null;
  }

  /**
   * Busca uma inspeção pelo ID remoto retornado pelo backend.
   */
  async findByRemoteId(remoteId: string): Promise<Inspection | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<InspectionRow>(
      'SELECT * FROM inspections WHERE remote_id = ?;',
      [remoteId]
    );
    return row ? this.mapRow(db, row) : null;
  }

  /**
   * Busca detalhes completos de uma inspeção no SQLite, incluindo seções, itens,
   * respostas, evidências, fila Outbox, cálculo de progresso e ação dinâmica.
   */
  async findByIdWithDetails(
    id: string,
    referenceDate: Date = new Date()
  ): Promise<InspectionDetailsData | null> {
    const db = await this.getDb();
    const directRow = await db.getFirstAsync<InspectionRow>(
      'SELECT * FROM inspections WHERE id = ?;',
      [id]
    );
    const row =
      directRow ??
      (await db.getFirstAsync<InspectionRow>(
        'SELECT * FROM inspections WHERE remote_id = ?;',
        [id]
      ));

    if (!row) {
      return null;
    }

    const inspection = this.mapRow(db, row);
    const targetId = inspection.id;

    const [sections, items, responses, evidences, outboxRows] = await Promise.all([
      db.getAllAsync<ChecklistSection>(
        'SELECT * FROM checklist_sections WHERE inspection_id = ? ORDER BY order_index ASC;',
        [targetId]
      ),
      db.getAllAsync<ChecklistItem>(
        'SELECT * FROM checklist_items WHERE inspection_id = ? ORDER BY order_index ASC;',
        [targetId]
      ),
      db.getAllAsync<ChecklistResponse>(
        'SELECT * FROM checklist_responses WHERE inspection_id = ? ORDER BY responded_at ASC;',
        [targetId]
      ),
      db.getAllAsync<InspectionEvidence>(
        'SELECT * FROM inspection_evidences WHERE inspection_id = ? ORDER BY created_at ASC;',
        [targetId]
      ),
      db.getAllAsync<OutboxRow>(
        "SELECT * FROM outbox_operations WHERE entity_type = 'INSPECTION' AND global_id = ? ORDER BY created_at ASC;",
        [targetId]
      ),
    ]);

    const pendingOperations = outboxRows.map(mapRowToOutboxOperation);

    const answeredItemIds = new Set<string>();
    let nonConformitiesCount = 0;

    for (const resp of responses) {
      const hasValue =
        resp.value !== undefined &&
        resp.value !== null &&
        String(resp.value).trim() !== '';
      if (hasValue) {
        answeredItemIds.add(resp.item_id);
      }
      if (Boolean(resp.is_non_conformity)) {
        nonConformitiesCount += 1;
      }
    }

    const totalItems = items.length;
    const answeredItems = items.filter((item) => answeredItemIds.has(item.id)).length;
    const requiredList = items.filter((item) => Boolean(item.required));
    const requiredItems = requiredList.length;
    const pendingRequiredItems = requiredList.filter(
      (item) => !answeredItemIds.has(item.id)
    ).length;
    const percentage = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;

    const activeOutboxIds =
      pendingOperations.length > 0 ? new Set<string>([targetId]) : undefined;

    return {
      inspection,
      sections,
      items,
      responses,
      evidences,
      pendingOperations,
      progress: {
        totalItems,
        answeredItems,
        requiredItems,
        pendingRequiredItems,
        nonConformitiesCount,
        evidencesCount: evidences.length,
        percentage,
      },
      isOverdue: isInspectionOverdue(inspection, referenceDate),
      isPendingSync: isInspectionPendingSync(inspection, activeOutboxIds),
      action: resolveInspectionAction(inspection.status),
    };
  }

  /**
   * Calcula métricas resumidas diretamente a partir do SQLite local.
   */
  async getSummaryMetrics(
    technicianId?: string | null,
    referenceDate: Date = new Date()
  ): Promise<InspectionSummaryMetrics> {
    const db = await this.getDb();
    const [assignedInspections, outboxRows] = await Promise.all([
      this.findWithFilters({ technicianId }, referenceDate),
      db.getAllAsync<{ entity_type: string; global_id: string }>(
        "SELECT entity_type, global_id FROM outbox_operations WHERE status IN ('PENDING', 'ERROR', 'SYNCING');"
      ),
    ]);

    const pendingOutboxIds = new Set<string>(
      outboxRows
        .filter((op) => op.entity_type === 'INSPECTION' && Boolean(op.global_id))
        .map((op) => op.global_id)
    );

    const pendingStatuses = new Set(resolveStatusesForFilter('PENDENTES') ?? []);
    const inProgressStatuses = new Set(resolveStatusesForFilter('EM_ANDAMENTO') ?? []);
    const completedStatuses = new Set(resolveStatusesForFilter('CONCLUÍDAS') ?? []);

    let today = 0;
    let overdue = 0;
    let inProgress = 0;
    let pending = 0;
    let completed = 0;
    let pendingSync = 0;

    for (const insp of assignedInspections) {
      if (isInspectionDueToday(insp, referenceDate)) {
        today += 1;
      }
      if (isInspectionOverdue(insp, referenceDate)) {
        overdue += 1;
      }
      if (inProgressStatuses.has(insp.status)) {
        inProgress += 1;
      }
      if (pendingStatuses.has(insp.status)) {
        pending += 1;
      }
      if (completedStatuses.has(insp.status)) {
        completed += 1;
      }
      if (isInspectionPendingSync(insp, pendingOutboxIds)) {
        pendingSync += 1;
      }
    }

    return {
      total: assignedInspections.length,
      today,
      overdue,
      delayed: overdue,
      inProgress,
      pending,
      completed,
      pendingSync,
    };
  }

  /**
   * Busca inspeções filtradas pelo status de negócio (ex: 'ATRIBUÍDA', 'EM_ANDAMENTO').
   */
  async findByStatus(status: string): Promise<Inspection[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<InspectionRow>(
      'SELECT * FROM inspections WHERE status = ? ORDER BY due_date ASC;',
      [status]
    );
    return rows.map((row) => this.mapRow(db, row));
  }

  /**
   * Busca inspeções filtradas pelo status de sincronização (ex: 'PENDENTE', 'ERRO').
   */
  async findBySyncStatus(syncStatus: InspectionSyncStatus): Promise<Inspection[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<InspectionRow>(
      'SELECT * FROM inspections WHERE sync_status = ? ORDER BY due_date ASC;',
      [syncStatus]
    );
    return rows.map((row) => this.mapRow(db, row));
  }

  /**
   * Busca textual por cliente, local, equipamento ou código.
   */
  async search(query: string): Promise<Inspection[]> {
    const db = await this.getDb();
    const term = `%${query.trim().toLowerCase()}%`;
    const rows = await db.getAllAsync<InspectionRow>(
      `SELECT * FROM inspections 
       WHERE LOWER(client_name) LIKE ? 
          OR LOWER(site_name) LIKE ? 
          OR LOWER(equipment_name) LIKE ? 
          OR LOWER(COALESCE(equipment_code, '')) LIKE ?
       ORDER BY due_date ASC;`,
      [term, term, term, term]
    );
    return rows.map((row) => this.mapRow(db, row));
  }

  /**
   * Insere uma nova inspeção no banco de dados SQLite nativo.
   */
  async create(
    data: Omit<Inspection, 'created_at' | 'updated_at'> & {
      created_at?: string;
      updated_at?: string;
    }
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const createdAt = data.created_at ?? now;
    const updatedAt = data.updated_at ?? createdAt;

    const clientName = data.client_name ?? data.client ?? '';
    const siteName = data.site_name ?? data.site ?? '';
    const equipmentName = data.equipment_name ?? data.equipment ?? '';
    const templateVersion = data.template_version ?? 1;
    const priority = data.priority ?? 'MEDIA';
    const syncStatus = data.sync_status ?? 'SINCRONIZADO';

    await db.runAsync(
      `INSERT INTO inspections (
        id, remote_id, template_id, template_version, client_name, site_name, site_address,
        equipment_name, equipment_code, equipment_qr_code, status, priority, due_date,
        started_at, completed_at, sync_status, rejection_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        data.id,
        data.remote_id ?? null,
        data.template_id,
        templateVersion,
        clientName,
        siteName,
        data.site_address ?? null,
        equipmentName,
        data.equipment_code ?? null,
        data.equipment_qr_code ?? null,
        data.status,
        priority,
        data.due_date ?? null,
        data.started_at ?? null,
        data.completed_at ?? null,
        syncStatus,
        data.rejection_reason ?? null,
        createdAt,
        updatedAt,
      ]
    );

    this.saveMetadata(db, data.id, data, false);
  }

  /**
   * Insere ou atualiza (upsert) uma inspeção baseando-se no ID primário.
   */
  async upsert(data: Inspection): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const createdAt = data.created_at ?? now;
    const updatedAt = data.updated_at ?? now;

    const clientName = data.client_name ?? data.client ?? '';
    const siteName = data.site_name ?? data.site ?? '';
    const equipmentName = data.equipment_name ?? data.equipment ?? '';
    const templateVersion = data.template_version ?? 1;
    const priority = data.priority ?? 'MEDIA';
    const syncStatus = data.sync_status ?? 'SINCRONIZADO';

    await db.runAsync(
      `INSERT INTO inspections (
        id, remote_id, template_id, template_version, client_name, site_name, site_address,
        equipment_name, equipment_code, equipment_qr_code, status, priority, due_date,
        started_at, completed_at, sync_status, rejection_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        remote_id = excluded.remote_id,
        template_id = excluded.template_id,
        template_version = excluded.template_version,
        client_name = excluded.client_name,
        site_name = excluded.site_name,
        site_address = excluded.site_address,
        equipment_name = excluded.equipment_name,
        equipment_code = excluded.equipment_code,
        equipment_qr_code = excluded.equipment_qr_code,
        status = excluded.status,
        priority = excluded.priority,
        due_date = excluded.due_date,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        sync_status = excluded.sync_status,
        rejection_reason = excluded.rejection_reason,
        updated_at = excluded.updated_at;`,
      [
        data.id,
        data.remote_id ?? null,
        data.template_id,
        templateVersion,
        clientName,
        siteName,
        data.site_address ?? null,
        equipmentName,
        data.equipment_code ?? null,
        data.equipment_qr_code ?? null,
        data.status,
        priority,
        data.due_date ?? null,
        data.started_at ?? null,
        data.completed_at ?? null,
        syncStatus,
        data.rejection_reason ?? null,
        createdAt,
        updatedAt,
      ]
    );

    this.saveMetadata(db, data.id, data, false);
  }

  /**
   * Realiza upsert em lote preservando registros com alterações locais pendentes de sincronização (RT-03).
   */
  async upsertMany(inspections: Inspection[]): Promise<void> {
    if (!inspections.length) {
      return;
    }

    const db = await this.getDb();
    const pendingOutboxRows = await db.getAllAsync<{ global_id: string }>(
      "SELECT DISTINCT global_id FROM outbox_operations WHERE entity_type = 'INSPECTION' AND status IN ('PENDING', 'ERROR', 'SYNCING', 'CONFLICT');"
    );
    const pendingOutboxIds = new Set(pendingOutboxRows.map((row) => row.global_id));

    for (const incoming of inspections) {
      const existingById = await this.findById(incoming.id);
      const existing =
        existingById ??
        (incoming.remote_id ? await this.findByRemoteId(incoming.remote_id) : null);

      if (existing) {
        const hasPendingOutbox = pendingOutboxIds.has(existing.id);
        const hasPendingSyncStatus =
          existing.sync_status !== undefined && existing.sync_status !== 'SINCRONIZADO';
        const hasLocalProgressWithOutbox =
          (existing.status === 'EM_ANDAMENTO' || existing.status === 'ENVIADA') &&
          hasPendingOutbox;

        if (hasPendingSyncStatus || hasPendingOutbox || hasLocalProgressWithOutbox) {
          // Preserva o registro local intacto, enriquecendo apenas metadados opcionais ausentes
          if (hasExtraMetadata(incoming)) {
            this.saveMetadata(
              db,
              existing.id,
              {
                technician_id: existing.technician_id ?? incoming.technician_id,
                technician_name: existing.technician_name ?? incoming.technician_name,
                title: existing.title ?? incoming.title,
                instructions: existing.instructions ?? incoming.instructions,
              },
              true
            );
          }
          continue;
        }
      }

      await this.upsert({
        ...incoming,
        id: existing?.id ?? incoming.id,
      });
    }
  }

  /**
   * Persiste ou atualiza no SQLite as seções e itens do snapshot recebidos da API (RT-03).
   * Preserva respostas locais existentes usando ON CONFLICT(id) DO UPDATE e normaliza
   * response_type para respeitar a constraint CHECK do schema v1 sem alterar migrations.ts.
   */
  async syncRemoteSnapshots(inspectionId: string, remoteItems?: any[]): Promise<void> {
    if (!inspectionId || !Array.isArray(remoteItems) || remoteItems.length === 0) {
      return;
    }

    const db = await this.getDb();
    const existingInspection =
      (await this.findById(inspectionId)) ?? (await this.findByRemoteId(inspectionId));
    if (!existingInspection) {
      return;
    }
    const resolvedInspectionId = existingInspection.id;

    const existingItemsCountRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM checklist_items WHERE inspection_id = ?;',
      [resolvedInspectionId]
    );
    const hasExistingItems = (existingItemsCountRow?.count ?? 0) > 0;
    const hasPendingSync =
      existingInspection.sync_status !== undefined &&
      existingInspection.sync_status !== 'SINCRONIZADO';

    if (hasExistingItems && hasPendingSync) {
      return;
    }

    const ALLOWED_RESPONSE_TYPES = new Set([
      'TEXT_SHORT',
      'TEXT_LONG',
      'NUMBER',
      'BOOLEAN',
      'CONFORMITY',
      'SINGLE_CHOICE',
      'DATE',
    ]);

    const sectionMap = new Map<
      string,
      { id: string; title: string; orderIndex: number }
    >();

    for (let index = 0; index < remoteItems.length; index++) {
      const raw = remoteItems[index];
      if (!raw) {
        continue;
      }

      const sectionTitle = String(raw.sectionTitle ?? raw.section_title ?? 'Checklist').trim() || 'Checklist';
      const sectionOrder = Number(raw.sectionOrder ?? raw.section_order ?? 0) || 0;
      const sectionKey = `${sectionOrder}::${sectionTitle}`;

      let sectionEntry = sectionMap.get(sectionKey);
      if (!sectionEntry) {
        const slug = sectionTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 32) || 'geral';
        const sectionId = `sec_${resolvedInspectionId}_${sectionOrder}_${slug}`;
        sectionEntry = { id: sectionId, title: sectionTitle, orderIndex: sectionOrder };
        sectionMap.set(sectionKey, sectionEntry);

        await db.runAsync(
          `INSERT INTO checklist_sections (id, inspection_id, title, order_index)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             order_index = excluded.order_index;`,
          [sectionEntry.id, resolvedInspectionId, sectionEntry.title, sectionEntry.orderIndex]
        );
      }

      const itemId = String(raw.id ?? `item_${resolvedInspectionId}_${index}`).trim();
      if (!itemId) {
        continue;
      }

      const itemTitle = String(raw.itemTitle ?? raw.title ?? `Item ${index + 1}`).trim();
      const itemDescription = raw.itemDescription ?? raw.description ?? null;
      const rawResponseType = String(raw.responseType ?? raw.response_type ?? 'TEXT_SHORT')
        .trim()
        .toUpperCase();
      const responseType = ALLOWED_RESPONSE_TYPES.has(rawResponseType)
        ? rawResponseType
        : 'TEXT_SHORT';

      let optionsJson: string | null = null;
      if (typeof raw.optionsJson === 'string' && raw.optionsJson.trim().length > 0) {
        optionsJson = raw.optionsJson;
      } else if (typeof raw.options_json === 'string' && raw.options_json.trim().length > 0) {
        optionsJson = raw.options_json;
      } else if (Array.isArray(raw.options) && raw.options.length > 0) {
        optionsJson = JSON.stringify(raw.options);
      }

      const requiredVal = raw.required === false || raw.required === 0 ? 0 : 1;
      const orderIndex = Number(raw.itemOrder ?? raw.order_index ?? index) || 0;

      await db.runAsync(
        `INSERT INTO checklist_items (
          id, section_id, inspection_id, title, description, response_type, options_json, required, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          section_id = excluded.section_id,
          title = excluded.title,
          description = excluded.description,
          response_type = excluded.response_type,
          options_json = excluded.options_json,
          required = excluded.required,
          order_index = excluded.order_index;`,
        [
          itemId,
          sectionEntry.id,
          resolvedInspectionId,
          itemTitle,
          itemDescription,
          responseType,
          optionsJson,
          requiredVal,
          orderIndex,
        ]
      );
    }
  }

  /**
   * Atualiza campos de uma inspeção existente.
   */
  async update(
    id: string,
    data: Partial<Omit<Inspection, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<void> {
    const db = await this.getDb();
    const fields: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, any> = {
      remote_id: data.remote_id,
      template_id: data.template_id,
      template_version: data.template_version,
      client_name: data.client_name ?? data.client,
      site_name: data.site_name ?? data.site,
      site_address: data.site_address,
      equipment_name: data.equipment_name ?? data.equipment,
      equipment_code: data.equipment_code,
      equipment_qr_code: data.equipment_qr_code,
      status: data.status,
      priority: data.priority,
      due_date: data.due_date,
      started_at: data.started_at,
      completed_at: data.completed_at,
      sync_status: data.sync_status,
      rejection_reason: data.rejection_reason,
    };

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      const sql = `UPDATE inspections SET ${fields.join(', ')} WHERE id = ?;`;
      await db.runAsync(sql, values);
    }

    this.saveMetadata(db, id, data, true);
  }

  /**
   * Atualiza o status e opcionalmente o sync_status de uma inspeção.
   */
  async updateStatus(
    id: string,
    status: InspectionBusinessStatus,
    syncStatus?: InspectionSyncStatus
  ): Promise<void> {
    const updatePayload: Partial<Inspection> = { status };
    if (syncStatus) {
      updatePayload.sync_status = syncStatus;
    }
    await this.update(id, updatePayload);
  }

  /**
   * Remove uma inspeção pelo ID primário.
   */
  async delete(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM inspections WHERE id = ?;', [id]);
    this.getMetadataStore(db).delete(id);
    inspectionMetadataMap.delete(id);
  }

  /**
   * Remove todas as inspeções da tabela.
   */
  async deleteAll(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM inspections;');
    this.getMetadataStore(db).clear();
    inspectionMetadataMap.clear();
  }

  /**
   * Retorna a contagem total de inspeções registradas.
   */
  async count(): Promise<number> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM inspections;'
    );
    return result?.count ?? 0;
  }
}

export const inspectionRepository = new InspectionRepository();

import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db';
import {
  type Inspection,
  type InspectionBusinessStatus,
  type InspectionSyncStatus,
  type InspectionPriority,
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

export function mapRowToInspection(row: InspectionRow): Inspection {
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

    // Aliases para retrocompatibilidade com UI legada
    client: row.client_name,
    site: row.site_name,
    equipment: row.equipment_name,
  };
}

/**
 * Repositório SQLite para a entidade Inspection (SPEC-001).
 * Implementa operações CRUD e consultas offline-first tipadas.
 */
export class InspectionRepository {
  private db?: SQLiteDatabase;

  constructor(db?: SQLiteDatabase) {
    this.db = db;
  }

  private async getDb(): Promise<SQLiteDatabase> {
    return this.db ?? getDatabase();
  }

  /**
   * Retorna todas as inspeções ordenadas pela data limite e data de criação.
   */
  async findAll(): Promise<Inspection[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<InspectionRow>(
      'SELECT * FROM inspections ORDER BY due_date ASC, created_at DESC;'
    );
    return rows.map(mapRowToInspection);
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
    return row ? mapRowToInspection(row) : null;
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
    return row ? mapRowToInspection(row) : null;
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
    return rows.map(mapRowToInspection);
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
    return rows.map(mapRowToInspection);
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
    return rows.map(mapRowToInspection);
  }

  /**
   * Insere uma nova inspeção no banco de dados SQLite nativo.
   */
  async create(data: Omit<Inspection, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): Promise<void> {
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
  }

  /**
   * Atualiza campos de uma inspeção existente.
   */
  async update(id: string, data: Partial<Omit<Inspection, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
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

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const sql = `UPDATE inspections SET ${fields.join(', ')} WHERE id = ?;`;
    await db.runAsync(sql, values);
  }

  /**
   * Atualiza o status e opcionalmente o sync_status de uma inspeção.
   */
  async updateStatus(id: string, status: InspectionBusinessStatus, syncStatus?: InspectionSyncStatus): Promise<void> {
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
  }

  /**
   * Remove todas as inspeções da tabela.
   */
  async deleteAll(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM inspections;');
  }

  /**
   * Retorna a contagem total de inspeções registradas.
   */
  async count(): Promise<number> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM inspections;');
    return result?.count ?? 0;
  }
}

export const inspectionRepository = new InspectionRepository();

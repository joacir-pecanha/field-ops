import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db';
import {
  type OutboxOperation,
  type OutboxStatus,
  type OutboxEntityType,
  type OutboxOperationType,
} from '../types';

export interface OutboxRow {
  id: string;
  entity_type: string;
  global_id: string;
  operation_type: string;
  payload: string;
  dependencies: string | null;
  status: OutboxStatus;
  retries: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function mapRowToOutboxOperation(row: OutboxRow): OutboxOperation {
  let dependencies: string[] = [];
  if (row.dependencies) {
    try {
      const parsed = JSON.parse(row.dependencies);
      dependencies = Array.isArray(parsed) ? parsed : [];
    } catch {
      dependencies = [];
    }
  }

  return {
    id: row.id,
    entity_type: row.entity_type as OutboxEntityType,
    global_id: row.global_id,
    operation_type: row.operation_type as OutboxOperationType,
    payload: row.payload,
    dependencies,
    status: row.status,
    retries: row.retries ?? 0,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Repositório SQLite para a fila transacional Outbox (SPEC-001 e SPEC-002).
 * Garante idempotência e persistência durável de mutações offline.
 */
export class OutboxRepository {
  private db?: SQLiteDatabase;

  constructor(db?: SQLiteDatabase) {
    this.db = db;
  }

  private async getDb(): Promise<SQLiteDatabase> {
    return this.db ?? getDatabase();
  }

  /**
   * Retorna todas as operações outbox ordenadas cronologicamente (FIFO).
   */
  async findAll(): Promise<OutboxOperation[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox_operations ORDER BY created_at ASC;'
    );
    return rows.map(mapRowToOutboxOperation);
  }

  /**
   * Busca uma operação pelo ID idempotente (UUID v4).
   */
  async findById(id: string): Promise<OutboxOperation | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<OutboxRow>(
      'SELECT * FROM outbox_operations WHERE id = ?;',
      [id]
    );
    return row ? mapRowToOutboxOperation(row) : null;
  }

  /**
   * Retorna operações pendentes ou em erro prontas para envio, ordenadas por created_at ASC.
   * Utiliza índice idx_outbox_status_created para alta performance.
   */
  async findPendingOperations(): Promise<OutboxOperation[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<OutboxRow>(
      "SELECT * FROM outbox_operations WHERE status IN ('PENDING', 'ERROR') ORDER BY created_at ASC;"
    );
    return rows.map(mapRowToOutboxOperation);
  }

  /**
   * Busca operações associadas a uma entidade e ID global específico.
   */
  async findByEntity(entityType: string, globalId: string): Promise<OutboxOperation[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox_operations WHERE entity_type = ? AND global_id = ? ORDER BY created_at ASC;',
      [entityType, globalId]
    );
    return rows.map(mapRowToOutboxOperation);
  }

  /**
   * Busca operações por status exato.
   */
  async findByStatus(status: OutboxStatus): Promise<OutboxOperation[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox_operations WHERE status = ? ORDER BY created_at ASC;',
      [status]
    );
    return rows.map(mapRowToOutboxOperation);
  }

  /**
   * Enfileira uma nova operação na outbox.
   */
  async create(data: Omit<OutboxOperation, 'created_at' | 'updated_at' | 'retries'> & { retries?: number; created_at?: string; updated_at?: string }): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const createdAt = data.created_at ?? now;
    const updatedAt = data.updated_at ?? createdAt;
    const retries = data.retries ?? 0;
    const status = data.status ?? 'PENDING';

    let depsJson: string | null = null;
    if (data.dependencies) {
      if (typeof data.dependencies === 'string') {
        depsJson = data.dependencies;
      } else if (Array.isArray(data.dependencies)) {
        depsJson = JSON.stringify(data.dependencies);
      }
    }

    await db.runAsync(
      `INSERT INTO outbox_operations (
        id, entity_type, global_id, operation_type, payload, dependencies,
        status, retries, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        data.id,
        data.entity_type,
        data.global_id,
        data.operation_type,
        data.payload,
        depsJson,
        status,
        retries,
        data.error_message ?? null,
        createdAt,
        updatedAt,
      ]
    );
  }

  /**
   * Atualiza o status e a mensagem de erro de uma operação outbox.
   */
  async updateStatus(id: string, status: OutboxStatus, errorMessage?: string | null): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE outbox_operations SET status = ?, error_message = ?, updated_at = ? WHERE id = ?;',
      [status, errorMessage ?? null, now, id]
    );
  }

  /**
   * Incrementa o contador de retries e atualiza a mensagem de erro.
   */
  async incrementRetries(id: string, errorMessage?: string | null): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE outbox_operations
       SET retries = retries + 1,
           error_message = COALESCE(?, error_message),
           updated_at = ?
       WHERE id = ?;`,
      [errorMessage ?? null, now, id]
    );
  }

  /**
   * Atualiza campos arbitrários de uma operação outbox.
   */
  async update(id: string, data: Partial<Omit<OutboxOperation, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const db = await this.getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (data.entity_type !== undefined) {
      fields.push('entity_type = ?');
      values.push(data.entity_type);
    }
    if (data.global_id !== undefined) {
      fields.push('global_id = ?');
      values.push(data.global_id);
    }
    if (data.operation_type !== undefined) {
      fields.push('operation_type = ?');
      values.push(data.operation_type);
    }
    if (data.payload !== undefined) {
      fields.push('payload = ?');
      values.push(data.payload);
    }
    if (data.dependencies !== undefined) {
      fields.push('dependencies = ?');
      const depsJson = typeof data.dependencies === 'string'
        ? data.dependencies
        : Array.isArray(data.dependencies)
        ? JSON.stringify(data.dependencies)
        : null;
      values.push(depsJson);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.retries !== undefined) {
      fields.push('retries = ?');
      values.push(data.retries);
    }
    if (data.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(data.error_message);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const sql = `UPDATE outbox_operations SET ${fields.join(', ')} WHERE id = ?;`;
    await db.runAsync(sql, values);
  }

  /**
   * Remove uma operação pelo ID.
   */
  async delete(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM outbox_operations WHERE id = ?;', [id]);
  }

  /**
   * Remove operações concluídas com sucesso.
   */
  async deleteCompleted(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync("DELETE FROM outbox_operations WHERE status = 'SYNCED';");
  }

  /**
   * Remove todas as operações da tabela outbox.
   */
  async deleteAll(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM outbox_operations;');
  }

  /**
   * Retorna a contagem de operações pendentes na fila.
   */
  async countPending(): Promise<number> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM outbox_operations WHERE status IN ('PENDING', 'ERROR');"
    );
    return result?.count ?? 0;
  }
}

export const outboxRepository = new OutboxRepository();

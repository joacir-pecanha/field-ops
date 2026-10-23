import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations, getCurrentDbVersion, SCHEMA_V1_DDL } from '../../src/infrastructure/database/migrations';
import { InspectionRepository } from '../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../src/infrastructure/database/repositories/outboxRepository';

/**
 * Cria uma instância de SQLiteDatabase em memória para testes nativos.
 * Utiliza o motor C SQLite real via node:sqlite.
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

describe('Migrações SQLite (Expo 57 / SPEC-001)', () => {
  let db: SQLiteDatabase;

  beforeEach(() => {
    db = createTestSqliteDb();
  });

  test('Deve iniciar com user_version = 0 e migrar com sucesso para a versão 1', async () => {
    const initialVersion = await getCurrentDbVersion(db);
    assert.equal(initialVersion, 0, 'Versão inicial deve ser 0');

    await runMigrations(db);

    const migratedVersion = await getCurrentDbVersion(db);
    assert.equal(migratedVersion, 1, 'Versão deve ser atualizada para 1');
  });

  test('Execução repetida de migrações deve ser idempotente', async () => {
    await runMigrations(db);
    assert.equal(await getCurrentDbVersion(db), 1);

    // Segunda execução
    await runMigrations(db);
    assert.equal(await getCurrentDbVersion(db), 1);
  });

  test('Deve criar todas as 7 tabelas do SPEC-001', async () => {
    await runMigrations(db);

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';"
    );
    const tableNames = tables.map((t) => t.name);

    assert.ok(tableNames.includes('users'), 'Tabela users deve existir');
    assert.ok(tableNames.includes('inspections'), 'Tabela inspections deve existir');
    assert.ok(tableNames.includes('checklist_sections'), 'Tabela checklist_sections deve existir');
    assert.ok(tableNames.includes('checklist_items'), 'Tabela checklist_items deve existir');
    assert.ok(tableNames.includes('checklist_responses'), 'Tabela checklist_responses deve existir');
    assert.ok(tableNames.includes('inspection_evidences'), 'Tabela inspection_evidences deve existir');
    assert.ok(tableNames.includes('outbox_operations'), 'Tabela outbox_operations deve existir');
  });

  test('Deve garantir integridade referencial com PRAGMA foreign_keys = ON e CASCADE delete', async () => {
    await runMigrations(db);

    // Inserção de inspeção base
    await db.runAsync(
      `INSERT INTO inspections (id, template_id, client_name, site_name, equipment_name, status)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['insp-test', 'tmpl-1', 'Cliente Alpha', 'Site Alpha', 'Motor A', 'ATRIBUÍDA']
    );

    // Inserção de seção com chave estrangeira válida
    await db.runAsync(
      `INSERT INTO checklist_sections (id, inspection_id, title, order_index)
       VALUES (?, ?, ?, ?);`,
      ['sec-test', 'insp-test', 'Seção Elétrica', 0]
    );

    const section = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM checklist_sections WHERE id = ?;',
      ['sec-test']
    );
    assert.ok(section, 'Seção deve ter sido inserida com sucesso');

    // Ao deletar a inspeção, a seção deve ser deletada em cascata (ON DELETE CASCADE)
    await db.runAsync('DELETE FROM inspections WHERE id = ?;', ['insp-test']);
    const deletedSection = await db.getFirstAsync(
      'SELECT id FROM checklist_sections WHERE id = ?;',
      ['sec-test']
    );
    assert.equal(deletedSection, null, 'Seção filha deve ser deletada em cascata');
  });
});

describe('InspectionRepository (SQLite Real)', () => {
  let db: SQLiteDatabase;
  let repo: InspectionRepository;

  beforeEach(async () => {
    db = createTestSqliteDb();
    await runMigrations(db);
    repo = new InspectionRepository(db);
  });

  test('Deve criar e buscar inspeção por ID', async () => {
    await repo.create({
      id: 'insp-101',
      template_id: 'tmpl-substation',
      client_name: 'Energia Total',
      site_name: 'Subestação Norte',
      equipment_name: 'Transformador T1',
      status: 'ATRIBUÍDA',
      priority: 'ALTA',
      due_date: '2026-10-30T10:00:00.000Z',
      sync_status: 'SINCRONIZADO',
    });

    const inspection = await repo.findById('insp-101');
    assert.ok(inspection, 'Inspeção não deve ser nula');
    assert.equal(inspection?.id, 'insp-101');
    assert.equal(inspection?.client_name, 'Energia Total');
    assert.equal(inspection?.client, 'Energia Total', 'Alias client deve funcionar');
    assert.equal(inspection?.status, 'ATRIBUÍDA');
    assert.equal(inspection?.priority, 'ALTA');
  });

  test('Deve filtrar inspeções por status e status de sincronização', async () => {
    await repo.create({
      id: 'insp-a',
      template_id: 'tmpl-1',
      client_name: 'Cliente A',
      site_name: 'Site A',
      equipment_name: 'Eq A',
      status: 'EM_ANDAMENTO',
      sync_status: 'PENDENTE',
    });
    await repo.create({
      id: 'insp-b',
      template_id: 'tmpl-1',
      client_name: 'Cliente B',
      site_name: 'Site B',
      equipment_name: 'Eq B',
      status: 'ATRIBUÍDA',
      sync_status: 'SINCRONIZADO',
    });

    const inProgress = await repo.findByStatus('EM_ANDAMENTO');
    assert.equal(inProgress.length, 1);
    assert.equal(inProgress[0].id, 'insp-a');

    const pendingSync = await repo.findBySyncStatus('PENDENTE');
    assert.equal(pendingSync.length, 1);
    assert.equal(pendingSync[0].id, 'insp-a');
  });

  test('Deve buscar inspeções textualmente', async () => {
    await repo.create({
      id: 'insp-c',
      template_id: 'tmpl-1',
      client_name: 'Petroquímica do Vale',
      site_name: 'Refinaria Sul',
      equipment_name: 'Válvula de Alívio V4',
      status: 'RASCUNHO',
    });

    const results = await repo.search('Vale');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'insp-c');

    const byEquipment = await repo.search('Válvula');
    assert.equal(byEquipment.length, 1);
    assert.equal(byEquipment[0].id, 'insp-c');
  });

  test('Deve atualizar e realizar upsert de inspeções', async () => {
    await repo.create({
      id: 'insp-d',
      template_id: 'tmpl-1',
      client_name: 'Cliente D',
      site_name: 'Site D',
      equipment_name: 'Eq D',
      status: 'ATRIBUÍDA',
    });

    await repo.update('insp-d', { status: 'EM_ANDAMENTO' });
    let updated = await repo.findById('insp-d');
    assert.equal(updated?.status, 'EM_ANDAMENTO');

    // Upsert alterando cliente e status
    await repo.upsert({
      id: 'insp-d',
      template_id: 'tmpl-1',
      client_name: 'Cliente D Modificado',
      site_name: 'Site D',
      equipment_name: 'Eq D',
      status: 'ENVIADA',
    });

    updated = await repo.findById('insp-d');
    assert.equal(updated?.client_name, 'Cliente D Modificado');
    assert.equal(updated?.status, 'ENVIADA');
  });

  test('Deve deletar inspeção por ID', async () => {
    await repo.create({
      id: 'insp-del',
      template_id: 'tmpl-1',
      client_name: 'Del Corp',
      site_name: 'Site',
      equipment_name: 'Eq',
      status: 'RASCUNHO',
    });

    assert.equal(await repo.count(), 1);
    await repo.delete('insp-del');
    assert.equal(await repo.count(), 0);
  });
});

describe('OutboxRepository (SQLite Real)', () => {
  let db: SQLiteDatabase;
  let repo: OutboxRepository;

  beforeEach(async () => {
    db = createTestSqliteDb();
    await runMigrations(db);
    repo = new OutboxRepository(db);
  });

  test('Deve enfileirar e recuperar operação outbox com dependências serializadas', async () => {
    await repo.create({
      id: 'op-101',
      entity_type: 'CHECKLIST_RESPONSE',
      global_id: 'resp-1',
      operation_type: 'SUBMIT_RESPONSE',
      payload: JSON.stringify({ value: 'CONFORME' }),
      dependencies: ['op-100'],
      status: 'PENDING',
      retries: 0,
    });

    const op = await repo.findById('op-101');
    assert.ok(op, 'Operação outbox deve existir');
    assert.equal(op?.id, 'op-101');
    assert.equal(op?.status, 'PENDING');
    assert.deepEqual(op?.dependencies, ['op-100']);
  });

  test('Deve recuperar operações pendentes em ordem FIFO estrita', async () => {
    await repo.create({
      id: 'op-older',
      entity_type: 'INSPECTION',
      global_id: 'insp-1',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
      created_at: '2026-10-23T10:00:00.000Z',
    });

    await repo.create({
      id: 'op-newer',
      entity_type: 'INSPECTION',
      global_id: 'insp-1',
      operation_type: 'COMPLETE_INSPECTION',
      payload: '{}',
      status: 'PENDING',
      created_at: '2026-10-23T10:05:00.000Z',
    });

    await repo.create({
      id: 'op-conflict',
      entity_type: 'INSPECTION',
      global_id: 'insp-2',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'CONFLICT', // Não deve ser listado como pendente
      created_at: '2026-10-23T10:02:00.000Z',
    });

    const pending = await repo.findPendingOperations();
    assert.equal(pending.length, 2, 'Apenas operações PENDING ou ERROR devem ser listadas');
    assert.equal(pending[0].id, 'op-older', 'Primeira operação deve ser a mais antiga');
    assert.equal(pending[1].id, 'op-newer');
  });

  test('Deve atualizar status e incrementar contador de retries', async () => {
    await repo.create({
      id: 'op-retry',
      entity_type: 'EVIDENCE',
      global_id: 'ev-1',
      operation_type: 'UPLOAD_EVIDENCE',
      payload: '{}',
      status: 'PENDING',
      retries: 0,
    });

    await repo.incrementRetries('op-retry', 'Timeout de rede');
    let op = await repo.findById('op-retry');
    assert.equal(op?.retries, 1);
    assert.equal(op?.error_message, 'Timeout de rede');

    await repo.updateStatus('op-retry', 'SYNCING');
    op = await repo.findById('op-retry');
    assert.equal(op?.status, 'SYNCING');
  });

  test('Deve remover operações da fila', async () => {
    await repo.create({
      id: 'op-del',
      entity_type: 'INSPECTION',
      global_id: 'insp-x',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
    });

    assert.equal(await repo.countPending(), 1);
    await repo.delete('op-del');
    assert.equal(await repo.countPending(), 0);
  });
});

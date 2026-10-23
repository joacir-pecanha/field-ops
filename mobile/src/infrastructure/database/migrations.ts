import { type SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './db';

/**
 * DDL completo do Schema Inicial (v1) conforme SPEC-001.
 * Define tabelas para usuários, inspeções, seções, itens, respostas, evidências e fila outbox.
 */
export const SCHEMA_V1_DDL = `
-- 1. Usuário / Sessão Local
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Inspeções Atribuídas
CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    remote_id TEXT UNIQUE,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    client_name TEXT NOT NULL,
    site_name TEXT NOT NULL,
    site_address TEXT,
    equipment_name TEXT NOT NULL,
    equipment_code TEXT,
    equipment_qr_code TEXT,
    status TEXT NOT NULL CHECK(status IN ('RASCUNHO', 'ATRIBUÍDA', 'EM_ANDAMENTO', 'ENVIADA', 'EM_REVISÃO', 'APROVADA', 'REPROVADA', 'CANCELADA')),
    priority TEXT DEFAULT 'MEDIA',
    due_date TEXT,
    started_at TEXT,
    completed_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'SINCRONIZADO' CHECK(sync_status IN ('SINCRONIZADO', 'PENDENTE', 'SINCRONIZANDO', 'ERRO', 'CONFLITO')),
    rejection_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_sync ON inspections(sync_status);

-- 3. Seções do Checklist
CREATE TABLE IF NOT EXISTS checklist_sections (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- 4. Itens do Checklist
CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    inspection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    response_type TEXT NOT NULL CHECK(response_type IN ('TEXT_SHORT', 'TEXT_LONG', 'NUMBER', 'BOOLEAN', 'CONFORMITY', 'SINGLE_CHOICE', 'DATE')),
    options_json TEXT,
    required INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(section_id) REFERENCES checklist_sections(id) ON DELETE CASCADE,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- 5. Respostas do Checklist
CREATE TABLE IF NOT EXISTS checklist_responses (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL UNIQUE,
    inspection_id TEXT NOT NULL,
    value TEXT,
    observation TEXT,
    is_non_conformity INTEGER NOT NULL DEFAULT 0,
    non_conformity_description TEXT,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    responded_at TEXT,
    FOREIGN KEY(item_id) REFERENCES checklist_items(id) ON DELETE CASCADE,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- 6. Evidências Fotográficas
CREATE TABLE IF NOT EXISTS inspection_evidences (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    item_id TEXT,
    local_uri TEXT NOT NULL,
    remote_key TEXT,
    remote_url TEXT,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'image/jpeg',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED')),
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES checklist_items(id) ON DELETE SET NULL
);

-- 7. Fila de Operações Outbox
CREATE TABLE IF NOT EXISTS outbox_operations (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    global_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    dependencies TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCING', 'ERROR', 'CONFLICT')),
    retries INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_operations(status, created_at);
`;

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
  down?: (db: SQLiteDatabase) => Promise<void>;
}

/**
 * Lista sequencial de migrações gerenciadas pelo sistema.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    up: async (db: SQLiteDatabase) => {
      await db.execAsync(SCHEMA_V1_DDL);
    },
  },
];

/**
 * Recupera a versão atual do banco de dados utilizando PRAGMA user_version.
 */
export const getCurrentDbVersion = async (db: SQLiteDatabase): Promise<number> => {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return result?.user_version ?? 0;
};

/**
 * Executa as migrações pendentes em ordem sequencial e atualiza o user_version dentro de transação atômica.
 */
export const runMigrations = async (db: SQLiteDatabase): Promise<void> => {
  // RT-03: Garante que chaves estrangeiras estejam ativadas na sessão
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const currentVersion = await getCurrentDbVersion(db);

  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  if (pendingMigrations.length === 0) {
    return;
  }

  for (const migration of pendingMigrations) {
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
};

/**
 * Inicializa a conexão do banco de dados e executa automaticamente as migrações sequenciais.
 */
export const initDatabase = async (): Promise<SQLiteDatabase> => {
  const db = await getDatabase();
  await runMigrations(db);
  return db;
};

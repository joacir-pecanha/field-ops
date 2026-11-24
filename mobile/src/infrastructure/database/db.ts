import type { SQLiteDatabase } from 'expo-sqlite';
import { store } from './memoryStore';

export const DATABASE_NAME = 'fieldops.db';

let dbInstance: SQLiteDatabase | null = null;
let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Obtém a conexão ativa com o banco SQLite do FieldOps.
 * Utiliza o padrão singleton e garante as pragmas foreign_keys = ON e journal_mode = WAL
 * conforme RT-01 e RT-03 da especificação SPEC-001.
 */
export const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const { openDatabaseAsync } = await import('expo-sqlite');
        const db = await openDatabaseAsync(DATABASE_NAME);

        // RT-03: Chaves estrangeiras ativadas obrigatoriamente
        await db.execAsync('PRAGMA foreign_keys = ON;');

        // WAL mode é ativado para concorrência em plataformas nativas (Android/iOS).
        // Em ambientes Web (wa-sqlite), é ignorado caso a VFS não suporte WAL.
        try {
          await db.execAsync('PRAGMA journal_mode = WAL;');
        } catch {
          // Ignorado com segurança no Web
        }

        dbInstance = db;
        return db;
      } catch (error) {
        dbPromise = null;
        throw error;
      }
    })();
  }

  return dbPromise;
};

/**
 * Fecha a conexão ativa com o banco SQLite e redefine o singleton.
 */
export const closeDatabase = async (): Promise<void> => {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    dbPromise = null;
  } else if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
    dbInstance = null;
    dbPromise = null;
  }
};

/**
 * Permite injetar ou redefinir a instância de conexão ativa (útil para testes unitários e mocks).
 */
export const setDatabaseInstance = (db: SQLiteDatabase | null): void => {
  dbInstance = db;
  dbPromise = db ? Promise.resolve(db) : null;
};

/**
 * Remove todos os dados operacionais locais do SQLite (e da memória) em ordem compatível
 * com PRAGMA foreign_keys = ON, mantendo a sessão de usuário intacta.
 */
export const clearLocalDatabaseData = async (dbOverride?: SQLiteDatabase): Promise<void> => {
  const db = dbOverride ?? (await getDatabase());
  const tablesToClear = [
    'outbox_operations',
    'inspection_evidences',
    'checklist_responses',
    'checklist_items',
    'checklist_sections',
    'inspections',
  ];

  await db.execAsync('PRAGMA foreign_keys = ON;');
  try {
    await db.runAsync('DELETE FROM evidence_files;');
  } catch {
    // Tabela evidence_files pode ainda não ter sido criada
  }
  for (const table of tablesToClear) {
    await db.runAsync(`DELETE FROM ${table};`);
  }
  store.clear();
};

import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Adapter de SQLite em memória (node:sqlite) compatível com a interface expo-sqlite usada nos repositórios.
 */
export function createTestSqliteDb(): SQLiteDatabase {
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
    async closeAsync() {
      rawDb.close();
    },
  };

  return adapter as SQLiteDatabase;
}

import "server-only";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DEFAULT_REL = path.join("data", "cafe-master.sqlite");

let db: Database.Database | null = null;

export function getSqlitePath(): string {
  const fromEnv = process.env.LOCAL_SQLITE_PATH?.trim();
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv);
  return path.join(process.cwd(), DEFAULT_REL);
}

export function getLocalSqliteDb(): Database.Database {
  if (db) return db;
  const filePath = getSqlitePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_rows (
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (table_name, row_id)
    );
    CREATE INDEX IF NOT EXISTS idx_app_rows_table ON app_rows(table_name);
  `);
  return db;
}

export function readTableRows(tableName: string): unknown[] {
  const database = getLocalSqliteDb();
  const rows = database
    .prepare(`SELECT data FROM app_rows WHERE table_name = ? ORDER BY updated_at ASC`)
    .all(tableName) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function writeTableRows(tableName: string, items: unknown[]): void {
  const database = getLocalSqliteDb();
  const del = database.prepare(`DELETE FROM app_rows WHERE table_name = ?`);
  const ins = database.prepare(
    `INSERT INTO app_rows (table_name, row_id, data, updated_at) VALUES (?, ?, ?, ?)`
  );
  const tx = database.transaction(() => {
    del.run(tableName);
    const now = new Date().toISOString();
    for (const item of items) {
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
      ins.run(tableName, id, JSON.stringify({ ...row, id }), now);
    }
  });
  tx();
}

export function tableIsEmpty(tableName: string): boolean {
  const database = getLocalSqliteDb();
  const row = database
    .prepare(`SELECT COUNT(*) as c FROM app_rows WHERE table_name = ?`)
    .get(tableName) as { c: number };
  return row.c === 0;
}

import type { SQLiteDatabase } from 'expo-sqlite';

/** Row shape for lists — note the absence of `text` (§17.9). */
export type ReadingRow = {
  id: number;
  title: string;
  cover_path: string | null;
  progress_offset: number;
  char_count: number;
  word_count: number;
  snippet: string;
  created_at: number;
  last_opened_at: number | null;
  finished_at: number | null;
  /** Set for a book from the bundled library; null for anything imported. */
  catalog_id: string | null;
};


const DATABASE_VERSION = 2;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        cover_path TEXT,
        progress_offset INTEGER NOT NULL DEFAULT 0,
        char_count INTEGER NOT NULL DEFAULT 0,
        word_count INTEGER NOT NULL DEFAULT 0,
        snippet TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        last_opened_at INTEGER,
        finished_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS readings_last_opened ON readings (last_opened_at DESC);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    version = 1;
  }

  if (version < 2) {
    // A bundled book becomes a row only when it is first opened, so this links
    // the row back to its catalogue entry. SQLite lets a UNIQUE index hold any
    // number of NULLs, which is exactly what imported readings need.
    await db.execAsync(`
      ALTER TABLE readings ADD COLUMN catalog_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS readings_catalog ON readings (catalog_id);
    `);
    version = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

const LIST_COLUMNS = `id, title, cover_path, progress_offset, char_count,
  word_count, snippet, created_at, last_opened_at, finished_at, catalog_id`;

export function listReadings(db: SQLiteDatabase) {
  return db.getAllAsync<ReadingRow>(
    `SELECT ${LIST_COLUMNS} FROM readings
     ORDER BY COALESCE(last_opened_at, created_at) DESC`
  );
}










export function putSetting(db: SQLiteDatabase, key: string, value: string) {
  return db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

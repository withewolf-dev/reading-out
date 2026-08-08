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
};

export type NewReading = {
  title: string;
  text: string;
  coverPath?: string | null;
};

const DATABASE_VERSION = 1;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

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
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

const LIST_COLUMNS = `id, title, cover_path, progress_offset, char_count,
  word_count, snippet, created_at, last_opened_at, finished_at`;

export function listReadings(db: SQLiteDatabase) {
  return db.getAllAsync<ReadingRow>(
    `SELECT ${LIST_COLUMNS} FROM readings
     ORDER BY COALESCE(last_opened_at, created_at) DESC`
  );
}

export function getReading(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ReadingRow>(`SELECT ${LIST_COLUMNS} FROM readings WHERE id = ?`, id);
}

/** The only query allowed to pull `text`. */
export async function getReadingText(db: SQLiteDatabase, id: number): Promise<string> {
  const row = await db.getFirstAsync<{ text: string }>('SELECT text FROM readings WHERE id = ?', id);
  return row?.text ?? '';
}

export async function insertReading(
  db: SQLiteDatabase,
  reading: NewReading,
  derived: { charCount: number; wordCount: number; snippet: string }
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO readings (title, text, cover_path, char_count, word_count, snippet, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    reading.title,
    reading.text,
    reading.coverPath ?? null,
    derived.charCount,
    derived.wordCount,
    derived.snippet,
    Date.now()
  );
  return result.lastInsertRowId;
}

export function saveProgress(db: SQLiteDatabase, id: number, offset: number) {
  return db.runAsync('UPDATE readings SET progress_offset = ? WHERE id = ?', Math.max(0, offset), id);
}

export function touchOpened(db: SQLiteDatabase, id: number) {
  return db.runAsync('UPDATE readings SET last_opened_at = ? WHERE id = ?', Date.now(), id);
}

export function setFinished(db: SQLiteDatabase, id: number, finished: boolean) {
  return finished
    ? db.runAsync(
        'UPDATE readings SET finished_at = ?, progress_offset = char_count WHERE id = ?',
        Date.now(),
        id
      )
    : db.runAsync('UPDATE readings SET finished_at = NULL, progress_offset = 0 WHERE id = ?', id);
}

export function deleteReading(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM readings WHERE id = ?', id);
}

export async function getSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function putSetting(db: SQLiteDatabase, key: string, value: string) {
  return db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

export function progressFraction(row: Pick<ReadingRow, 'progress_offset' | 'char_count'>): number {
  if (row.char_count <= 0) return 0;
  return Math.min(1, Math.max(0, row.progress_offset / row.char_count));
}

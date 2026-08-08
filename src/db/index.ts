import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * A reading is a bookmark, not a copy of the book.
 *
 * Books live where they already are — bundled ones as Metro assets, imported
 * ones as files under Documents/imports — and a row only records which book it
 * is and how far through it you got. An earlier schema kept the whole text in a
 * column, which doubled what sat on disk and made a first open pay for an
 * insert of the entire book.
 */
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
  /** Set for a book from the bundled catalogue; null for anything imported. */
  catalog_id: string | null;
  /** file:// path to an imported book's text; null for bundled ones. */
  text_uri: string | null;
};

const DATABASE_VERSION = 3;

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
    await db.execAsync(`
      ALTER TABLE readings ADD COLUMN catalog_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS readings_catalog ON readings (catalog_id);
    `);
    version = 2;
  }

  if (version < 3) {
    // Drops `text` and adds `text_uri`. Rebuilt rather than altered: `text` is
    // NOT NULL, and the twelve-step rebuild is the portable way to lose a
    // column. Any imported reading that still carries its text is dropped —
    // there is nowhere to put it now, and its file was never written.
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      BEGIN;
      CREATE TABLE readings_v3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        cover_path TEXT,
        progress_offset INTEGER NOT NULL DEFAULT 0,
        char_count INTEGER NOT NULL DEFAULT 0,
        word_count INTEGER NOT NULL DEFAULT 0,
        snippet TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        last_opened_at INTEGER,
        finished_at INTEGER,
        catalog_id TEXT,
        text_uri TEXT
      );
      INSERT INTO readings_v3
        (id, title, cover_path, progress_offset, char_count, word_count,
         snippet, created_at, last_opened_at, finished_at, catalog_id, text_uri)
        SELECT id, title, cover_path, progress_offset, char_count, word_count,
               snippet, created_at, last_opened_at, finished_at, catalog_id, NULL
        FROM readings
        WHERE catalog_id IS NOT NULL;
      DROP TABLE readings;
      ALTER TABLE readings_v3 RENAME TO readings;
      CREATE INDEX IF NOT EXISTS readings_last_opened ON readings (last_opened_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS readings_catalog ON readings (catalog_id);
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

const COLUMNS = `id, title, cover_path, progress_offset, char_count, word_count,
  snippet, created_at, last_opened_at, finished_at, catalog_id, text_uri`;

/** Newest-opened first — the Continue card takes the head of this list. */
export function listReadings(db: SQLiteDatabase) {
  return db.getAllAsync<ReadingRow>(
    `SELECT ${COLUMNS} FROM readings
     ORDER BY COALESCE(last_opened_at, created_at) DESC`
  );
}

export function getReading(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ReadingRow>(`SELECT ${COLUMNS} FROM readings WHERE id = ?`, id);
}

/**
 * The row for a bundled book, created on first open. Cheap now that a row is
 * only a bookmark — no text crosses the bridge.
 */
export async function openBundled(
  db: SQLiteDatabase,
  book: { id: string; title: string; charCount: number; wordCount: number; snippet: string }
): Promise<ReadingRow> {
  await db.runAsync(
    `INSERT INTO readings (title, catalog_id, char_count, word_count, snippet, created_at, last_opened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(catalog_id) DO UPDATE SET last_opened_at = excluded.last_opened_at`,
    book.title,
    book.id,
    book.charCount,
    book.wordCount,
    book.snippet,
    Date.now(),
    Date.now()
  );
  const row = await db.getFirstAsync<ReadingRow>(
    `SELECT ${COLUMNS} FROM readings WHERE catalog_id = ?`,
    book.id
  );
  if (!row) throw new Error('could not open that book');
  return row;
}

/** A freshly imported book. Re-importing the same file replaces its row. */
export async function insertImport(
  db: SQLiteDatabase,
  book: { title: string; textUri: string; coverPath: string | null; charCount: number }
): Promise<number> {
  await db.runAsync('DELETE FROM readings WHERE text_uri = ?', book.textUri);
  const result = await db.runAsync(
    `INSERT INTO readings (title, text_uri, cover_path, char_count, word_count, created_at, last_opened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    book.title,
    book.textUri,
    book.coverPath,
    book.charCount,
    Math.round(book.charCount / 5.5),
    Date.now(),
    Date.now()
  );
  return result.lastInsertRowId;
}

export function saveProgress(db: SQLiteDatabase, id: number, offset: number) {
  return db.runAsync(
    'UPDATE readings SET progress_offset = ? WHERE id = ?',
    Math.max(0, offset),
    id
  );
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

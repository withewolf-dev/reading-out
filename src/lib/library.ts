import { Asset } from 'expo-asset';

import { CATALOG, catalogBook, SHELVES, type CatalogBook, type Shelf } from '@/lib/catalog';
import { type ReadingRow } from '@/db';

/**
 * The bundled library, and how it meets what is already in the database.
 *
 * The 50 books ship as Metro assets rather than as rows: seeding 22 MB of text
 * into SQLite on first launch would cost several seconds before anyone sees a
 * shelf. A book becomes a `readings` row the moment it is first opened, and
 * from then on it is an ordinary reading — same progress, same resume, same
 * player. Everything on this screen before that point comes from the catalogue.
 */

/** One book on a shelf, whether or not it has ever been opened. */
export type LibraryEntry = {
  key: string;
  title: string;
  author: string | null;
  /** A Metro asset handle for bundled books, a file URI for imported ones. */
  cover: number | string | null;
  wordCount: number;
  charCount: number;
  progressOffset: number;
  finished: boolean;
  book: CatalogBook | null;
  row: ReadingRow | null;
};

export type LibraryShelf = Shelf & { items: LibraryEntry[] };

export type Library = {
  /** The most recently opened unfinished reading — the "Continue" card. */
  continuing: LibraryEntry | null;
  shelves: LibraryShelf[];
};

function fromCatalog(book: CatalogBook, row: ReadingRow | null): LibraryEntry {
  return {
    key: book.id,
    title: book.title,
    author: book.author,
    cover: book.cover,
    wordCount: book.wordCount,
    charCount: book.charCount,
    progressOffset: row?.progress_offset ?? 0,
    finished: row?.finished_at != null,
    book,
    row,
  };
}

function fromImport(row: ReadingRow): LibraryEntry {
  return {
    key: `import:${row.id}`,
    title: row.title,
    author: null,
    cover: row.cover_path,
    wordCount: row.word_count,
    charCount: row.char_count,
    progressOffset: row.progress_offset,
    finished: row.finished_at != null,
    book: null,
    row,
  };
}

export function buildLibrary(rows: ReadingRow[]): Library {
  const byCatalogId = new Map<string, ReadingRow>();
  const imported: ReadingRow[] = [];
  for (const row of rows) {
    if (row.catalog_id) byCatalogId.set(row.catalog_id, row);
    else imported.push(row);
  }

  const byShelf = new Map(SHELVES.map((shelf) => [shelf.id, [] as LibraryEntry[]]));
  for (const book of CATALOG) {
    const entry = fromCatalog(book, byCatalogId.get(book.id) ?? null);
    for (const shelf of book.shelves) byShelf.get(shelf)?.push(entry);
  }

  const shelves: LibraryShelf[] = SHELVES.map((shelf) => ({
    ...shelf,
    items: byShelf.get(shelf.id) ?? [],
    // A single card is not a shelf — it reads as a mistake next to a row that
    // scrolls. Every book on a shelf this thin also sits on a fuller one, so
    // nothing is lost by dropping it.
  })).filter((shelf) => shelf.items.length > 1);

  // Imports come first: they are the only thing here the reader chose.
  if (imported.length > 0) {
    shelves.unshift({
      id: 'imports',
      title: 'Your files',
      items: imported.map(fromImport),
    });
  }

  // `rows` arrives newest-opened first (see listReadings).
  const current = rows.find((row) => row.finished_at == null && row.last_opened_at != null);
  const book = current ? catalogBook(current.catalog_id) : null;
  // A row whose catalogue entry has since been dropped still has its own title
  // and text, so fall back to showing it as an imported reading.
  const continuing = current ? (book ? fromCatalog(book, current) : fromImport(current)) : null;

  return { continuing, shelves };
}

/**
 * Reads a bundled book off disk. In development the asset lives on the Metro
 * server until `downloadAsync` caches it; in a release build it is already in
 * the app bundle and `localUri` is set from the start.
 */

/** A file:// path to a bundled cover — what the native reader needs to tint the page. */
export async function loadCoverUri(book: CatalogBook): Promise<string | null> {
  if (book.cover == null) return null;
  try {
    const asset = Asset.fromModule(book.cover);
    if (!asset.localUri) await asset.downloadAsync();
    return asset.localUri ?? null;
  } catch {
    return null;
  }
}

/**
 * The row id and text for a bundled book, creating the row on first open. This
 * is the only place a catalogue entry turns into a reading.
 */

export function progressFraction(entry: LibraryEntry): number {
  if (entry.charCount <= 0) return 0;
  return Math.min(1, Math.max(0, entry.progressOffset / entry.charCount));
}

/**
 * Where play should start. A book that has never been played starts at its
 * first chapter rather than at its title page and contents list; once there is
 * real progress, that is the only thing that matters.
 */
export function startOffset(entry: LibraryEntry): number {
  if (entry.finished) return entry.book?.bodyOffset ?? 0;
  if (entry.progressOffset > 0) return entry.progressOffset;
  return entry.book?.bodyOffset ?? 0;
}

/** "1h 20m" — the length of a book, before anyone has started it. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

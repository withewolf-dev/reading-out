import { CATALOG, catalogBook, SHELVES, type CatalogBook, type Shelf } from '@/lib/catalog';
import { type ReadingRow } from '@/db';

/**
 * The shelves: the bundled catalogue, plus whatever the reader imported.
 *
 * Books ship as Metro assets and are read straight off the bundle, so nothing
 * here is backed by a database row. Imports arrive as synthetic rows so they
 * can be shelved beside the bundled books without a second code path.
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

  // The reader's own books come first: they are the only thing here they chose.
  if (imported.length > 0) {
    shelves.unshift({
      id: 'imports',
      title: 'Your collection',
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

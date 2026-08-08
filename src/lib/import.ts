import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import PdfTextExtractor from '../../modules/pdf-text-extractor/src/PdfTextExtractorModule';

export type ImportStage = 'picking' | 'reading' | 'saving';

export type ImportedBook = {
  /** `import-<name>` — the id the reader is routed to. */
  id: string;
  title: string;
  charCount: number;
  /** file:// path to the saved text, for opening it again later. */
  textUri: string;
  coverPath: string | null;
  importedAt: number;
};

/**
 * Imported books, held in memory from the moment they are extracted.
 *
 * The extractor already returns the whole text, so writing it out and reading
 * it straight back would be the same wasted round trip that made opening a
 * bundled book slow. The reader takes it from here on the first open and off
 * disk on every open after that.
 */
const staged = new Map<string, string>();

/** Take-once: the reader claims the text, and later opens read the file. */
export function takeStagedText(id: string): string | null {
  const text = staged.get(id) ?? null;
  staged.delete(id);
  return text;
}

/**
 * The imported books, as a small JSON file beside the texts themselves.
 *
 * A manifest rather than a SQLite table: the books already live on disk as
 * files, and a row per book would mean carrying the whole storage layer back
 * just to remember thirty bytes of metadata.
 */
function manifestFile(): File {
  return new File(importsDirectory(), 'index.json');
}

export async function listImports(): Promise<ImportedBook[]> {
  const file = manifestFile();
  if (!file.exists) return [];
  try {
    const parsed = JSON.parse(await file.text()) as ImportedBook[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function remember(book: ImportedBook): Promise<void> {
  // Re-importing the same file replaces its entry rather than doubling it.
  const rest = (await listImports()).filter((b) => b.id !== book.id);
  const file = manifestFile();
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify([book, ...rest]));
}

/** Forget an imported book, and delete the text it was reading from. */
export async function removeImport(id: string): Promise<void> {
  const rest = (await listImports()).filter((b) => b.id !== id);
  const file = manifestFile();
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(rest));

  const text = new File(importsDirectory(), `${id}.txt`);
  if (text.exists) text.delete();
}

function importsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'imports');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** A stable, filesystem-safe id for a picked file. */
function idFor(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return `import-${stem.replace(/^-|-$/g, '') || 'book'}`;
}

/**
 * Pick a PDF or text file and turn it into something the reader can open.
 *
 * `onStage` fires as each step begins so the caller can say what is happening.
 * There is no percentage to report: extraction happens inside one native call
 * that does not publish progress, and inventing a bar that fills on a timer
 * would be a lie about work that has not happened.
 *
 * Returns null if the picker was dismissed.
 */
export async function importBook(
  onStage: (stage: ImportStage) => void
): Promise<ImportedBook | null> {
  onStage('picking');
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'text/plain'],
    // The picker hands back a security-scoped URL that expires; the copy is
    // what the native extractor can actually open.
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const asset = picked.assets[0];

  // The extractor is an AsyncFunction, so a 600-page PDF is parsed on a
  // background thread and the UI keeps animating while it runs.
  onStage('reading');
  const imported = await PdfTextExtractor.importFile(asset.uri);
  const text = imported.text ?? '';
  if (text.trim().length === 0) {
    throw new Error('There is no readable text in that file. Scans need OCR first.');
  }

  const id = idFor(imported.title || asset.name || 'book');
  staged.set(id, text);

  // Written after the text is staged, so the reader can open immediately and
  // the file is only needed the next time round.
  onStage('saving');
  const file = new File(importsDirectory(), `${id}.txt`);
  if (file.exists) file.delete();
  file.create();
  file.write(text);

  const book: ImportedBook = {
    id,
    title: imported.title || asset.name || 'Untitled',
    charCount: text.length,
    textUri: file.uri,
    coverPath: imported.coverPath ?? null,
    importedAt: Date.now(),
  };

  await remember(book);
  return book;
}

import * as DocumentPicker from 'expo-document-picker';

import PdfTextExtractor from '../../modules/pdf-text-extractor/src/PdfTextExtractorModule';
import { inferTitle } from './text';

export type ImportedDoc = { title: string; text: string; coverPath?: string | null };
export type ImportFailure = { name: string; reason: string };
export type ImportResult = { imported: ImportedDoc[]; failed: ImportFailure[] };

const PICKER_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'public.plain-text'];

/** `onReadingStart` fires after the picker closes — that is when the busy state belongs. */
export async function pickAndReadDocuments(
  onReadingStart?: () => void
): Promise<ImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: PICKER_TYPES,
    multiple: true,
    // The importer takes a security-scoped URL and handles it natively, but the
    // cached copy is what survives the picker being dismissed mid-read.
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  onReadingStart?.();

  const imported: ImportedDoc[] = [];
  const failed: ImportFailure[] = [];

  // A bad file in a batch must not sink the good ones (acceptance test 7).
  for (const asset of result.assets) {
    const name = asset.name ?? 'Document';
    try {
      const file = await PdfTextExtractor.importFile(asset.uri);
      const text = normalize(file.text);
      if (text.trim().length === 0) throw new Error('There is no text in this file.');
      imported.push({
        title: file.title?.trim() || inferTitle(text, stripExtension(name)),
        text,
        coverPath: file.coverPath,
      });
    } catch (error) {
      // The native importer's message is the useful one: "this is a scan, it
      // needs OCR" rather than a stack trace (§17.13).
      failed.push({ name, reason: (error as Error).message });
    }
  }
  return { imported, failed };
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim();
}

/** Normalize line endings so paragraph offsets are stable, and NBSP so speech doesn't stumble. */
export function normalize(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
}

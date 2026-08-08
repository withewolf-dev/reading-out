import { NativeModule, requireNativeModule } from 'expo';

import type { ImportedFile } from './PdfTextExtractor.types';

declare class PdfTextExtractorModule extends NativeModule<{}> {
  /**
   * Reads a PDF or text file off the main thread. Rejects with a human-readable
   * reason: scans need OCR, empty files have no text, odd encodings still import.
   */
  importFile(uri: string): Promise<ImportedFile>;
}

export default requireNativeModule<PdfTextExtractorModule>('PdfTextExtractor');

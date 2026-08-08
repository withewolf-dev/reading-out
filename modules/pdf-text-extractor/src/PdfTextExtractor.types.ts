export type ImportedFile = {
  /** The PDF's metadata title, or the filename for text files. */
  title: string;
  /** Reflowed text: hard wraps rejoined, running heads and page numbers stripped. */
  text: string;
  /** file:// path to a PNG of the first page, or null. */
  coverPath: string | null;
};

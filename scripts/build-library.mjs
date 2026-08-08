#!/usr/bin/env node
/**
 * Builds the bundled library from Project Gutenberg.
 *
 * For every entry in `curation.mjs` this script
 *   1. asks Gutendex for the canonical record and refuses anything Gutendex
 *      reports as still in copyright,
 *   2. downloads the UTF-8 plain text and the cover image,
 *   3. checks the download is not an HTML error page and that the title and
 *      author in Gutenberg's own header match what we claim,
 *   4. strips the Project Gutenberg licence header and footer and reflows the
 *      hard-wrapped source into real paragraphs — ReadingLoud treats every line
 *      as a paragraph, so a 70-column source would read as free verse,
 *   5. writes content/books/<slug>/{book.txt,cover.jpg,metadata.json},
 *   6. writes content/books.json and generates src/lib/catalog.ts.
 *
 * Everything is idempotent: re-running only re-downloads what is missing unless
 * --force is passed. Nothing here runs on device — this is a build-time step and
 * its output is committed.
 *
 *   node scripts/build-library.mjs [--force] [--only=slug,slug]
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOOKS, SHELVES } from './curation.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const BOOKS_DIR = join(CONTENT, 'books');

const FORCE = process.argv.includes('--force');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

/** Silent reading is faster than listening; both are shown in the manifest. */
const READING_WPM = 250;
const LISTENING_WPM = 180;

const LICENSE =
  'Public domain in the United States. Sourced from Project Gutenberg, which ' +
  'places no restrictions on public-domain works once the Project Gutenberg ' +
  'header, footer and trademark references are removed (PG Licence §1.E.1–1.E.7).';

// ─── HTTP ────────────────────────────────────────────────────────────────────

async function get(url, { binary = false } = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'ReadingLoud-library-build/1.0 (+local demo content)' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return binary
        ? Buffer.from(await response.arrayBuffer())
        : await response.text();
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
}

// ─── Verification ────────────────────────────────────────────────────────────

class Rejected extends Error {}

function assertNotHtml(text, what) {
  const head = text.slice(0, 2000).toLowerCase();
  if (head.includes('<!doctype html') || head.includes('<html')) {
    throw new Rejected(`${what} came back as an HTML page, not a document`);
  }
}

function assertJpeg(buffer, what) {
  // SOI marker, and an EOI at the tail: a truncated download fails the second.
  if (buffer.length < 2048) throw new Rejected(`${what} is only ${buffer.length} bytes`);
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Rejected(`${what} is not a JPEG`);
  if (buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
    throw new Rejected(`${what} is a truncated JPEG`);
  }
}

/** Loose comparison — "Brontë, Charlotte" must match "Charlotte Brontë". */
function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

function surname(author) {
  const parts = normalizeName(author).split(' ');
  return parts[parts.length - 1];
}

/**
 * Gutenberg catalogues people the way a library does — "Dostoyevsky, Fyodor",
 * "Sunzi, active 6th century B.C." — so a book may declare the spellings it
 * also answers to. Anything not declared is still a hard failure.
 */
function matchesAuthor(candidate, book) {
  const normalized = normalizeName(candidate);
  return [book.author, ...(book.aka?.author ?? [])].some((name) =>
    normalized.includes(surname(name))
  );
}

/**
 * Gutenberg's own header carries `Title:` and `Author:` fields. Checking our
 * metadata against those — not against the filename — is what makes the claim
 * "the title and author match" mean something.
 */
function assertHeaderMatches(raw, book) {
  const header = raw.slice(0, 4000);
  const titleField = /^Title:\s*(.+)$/m.exec(header)?.[1]?.trim();
  const authorField = /^Author:\s*(.+)$/m.exec(header)?.[1]?.trim();
  if (!titleField) throw new Rejected('no "Title:" field in the Gutenberg header');

  const actual = normalizeName(titleField);
  const titles = [book.title, ...(book.aka?.title ?? [])];
  const matchesTitle = titles.some((candidate) => {
    const significant = normalizeName(candidate).split(' ').filter((w) => w.length > 3);
    return significant.length === 0 || significant.some((word) => actual.includes(word));
  });
  if (!matchesTitle) {
    throw new Rejected(`header title "${titleField}" does not match "${book.title}"`);
  }
  // Translated and anonymous works legitimately have no Author: field.
  if (authorField && !matchesAuthor(authorField, book)) {
    throw new Rejected(`header author "${authorField}" does not match "${book.author}"`);
  }
  return { headerTitle: titleField, headerAuthor: authorField ?? null };
}

// ─── Cleaning ────────────────────────────────────────────────────────────────

const LEADING_APPARATUS =
  /^(?:Note:|Notes?:|Transcriber'?s? note|Transcribed from|Produced by|E-?text prepared by|Credits:|Updated editions will replace|Project Gutenberg|\[?Illustration)/i;

const START = /^\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*$/m;
const END = /^\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*$/m;

function stripBoilerplate(raw, slug) {
  let text = raw.replace(/\r\n?/g, '\n').replace(/﻿/g, '');

  const start = START.exec(text);
  if (!start) throw new Rejected('no Project Gutenberg START marker — refusing to guess');
  text = text.slice(start.index + start[0].length);

  const end = END.exec(text);
  if (!end) throw new Rejected('no Project Gutenberg END marker — the file may be truncated');
  text = text.slice(0, end.index);

  // Producer credits, transcriber's notes and "we also have an HTML version"
  // pointers sit between the marker and the book, sometimes several in a row.
  // Peel them off one block at a time, and only near the top.
  for (;;) {
    const match = /^\s*([\s\S]*?)(?:\n\s*\n|$)/.exec(text);
    if (!match) break;
    const block = match[1].trim();
    if (!block || match[0].length > 1500 || !LEADING_APPARATUS.test(block)) break;
    text = text.slice(match[0].length);
  }

  return text;
}

/**
 * Plate captions and page-number furniture read aloud as noise. `[Illustration:
 * …]` can wrap across several lines, hence the non-greedy multi-line form.
 */
function stripFurniture(text) {
  return text
    .replace(/\[Illustration[^\]]*\]/g, '')
    .replace(/\[Frontispiece[^\]]*\]/g, '')
    .replace(/^\s*\[?(?:Pg|Page)\s*[ivxlcdm\d]+\.?\]?\s*$/gim, '')
    // What is left behind by `[Illustration: cover]` and its cousins.
    .replace(/^\s*(?:cover|titlepage|title page|frontispiece)\s*$/gim, '')
    .replace(/\{\d+\}/g, '')
    .replace(/\[\d+\]/g, '') // footnote anchors
    .replace(/\^\{([^}]{1,12})\}/g, '$1') // "M^{rs}" — a transcriber's superscript
    .replace(/(\w)\^(\w)/g, '$1$2')
    .replace(/ /g, ' ');
}

/**
 * Gutenberg wraps at ~70 columns. ReadingLoud splits paragraphs on `\n`
 * (src/lib/text.ts), so every wrapped line would become its own paragraph.
 * Rejoin them — except where the short lines *are* the point: verse, cast
 * lists, tables of contents.
 */
function reflow(text) {
  const out = [];
  for (const block of text.split(/\n[ \t]*\n/)) {
    const lines = block.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    if (lines.length === 0) continue;
    if (lines.length === 1) {
      out.push(lines[0].trim());
      continue;
    }

    // A block whose lines are mostly short is structural, not prose.
    const shortLines = lines.filter((l) => l.trim().length < 48).length;
    if (shortLines / lines.length > 0.65) {
      out.push(lines.map((l) => l.trim()).join('\n'));
      continue;
    }

    let paragraph = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!paragraph) paragraph = trimmed;
      else if (paragraph.endsWith('-') && !paragraph.endsWith('--'))
        paragraph = paragraph.slice(0, -1) + trimmed;
      else paragraph += ' ' + trimmed;
    }
    out.push(paragraph);
  }
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function clean(raw, slug) {
  // Gutenberg marks italics with paired underscores that routinely wrap across
  // several source lines, so they can only be removed once reflow has put each
  // paragraph back on one line. No book here uses `_` for anything else.
  const body = reflow(stripFurniture(stripBoilerplate(raw, slug))).replace(/_/g, '');
  if (body.length < 4000) throw new Rejected(`only ${body.length} characters survived cleaning`);
  const letters = (body.match(/[A-Za-z]/g) ?? []).length;
  if (letters / body.length < 0.5) throw new Rejected('cleaned text does not look like prose');
  return body;
}

// ─── Derived metadata ────────────────────────────────────────────────────────

const countWords = (text) => (text.match(/\S+/g) ?? []).length;

/**
 * Length shelves are derived from the word count, never hand-assigned — a shelf
 * called "Under an hour" that holds a four-hour book is worse than no shelf.
 */
function lengthShelf(minutes) {
  if (minutes <= 75) return 'short';
  if (minutes <= 250) return 'sitting';
  if (minutes >= 600) return 'long';
  return null;
}

function makeSnippet(text, max = 140) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1).trimEnd() + '…';
}

const HEADING = /^(chapter|act|part|book|letter|scene)\s+([ivxlcdm]+|\d+|one|first)\b/i;
/** The body starts at chapter *one*. Landing on chapter two is a bug, not a near miss. */
const FIRST_HEADING = /^(chapter|act|part|book|letter|scene)\s+(i|1|one|first)\b/i;
const FRONT_MATTER =
  /^(contents|preface|introduction|foreword|prologue|dedication|illustrations|appendix|note|notes|editor'?s note|translator'?s note|transcriber'?s note)\b/i;
const APPARATUS =
  /project gutenberg|transcriber|redactor|editor's note|this (e-?book|electronic)|produced by|copyright,? \d{4}|illustrations? (in|of) this|dedicated to|millennium fulcrum/i;

/**
 * Where the work itself starts.
 *
 * Gutenberg texts open with a title page, a contents list, a dedication, a
 * copyright notice and sometimes a scholarly preface. Read aloud, that is
 * several minutes of "CHAPTER I CHAPTER II CHAPTER III" before the first
 * sentence. The whole text stays in the app — you can scroll up to it and tap
 * any paragraph — but this is where play starts, and where the library takes
 * the preview line from.
 *
 * Paragraphs are split exactly the way src/lib/text.ts splits them, so the
 * offset this returns is the same UTF-16 offset the reader and the engine use.
 */
function titleCaseRatio(line) {
  const words = line.split(/\s+/).slice(1).filter((w) => /[a-z]/i.test(w));
  if (words.length < 6) return 0;
  return words.filter((w) => /^[A-Z]/.test(w)).length / words.length;
}

function bodyOffset(text) {
  const paragraphs = [];
  let cursor = 0;
  for (const line of text.split('\n')) {
    if (line.trim()) paragraphs.push({ start: cursor, text: line.trim() });
    cursor += line.length + 1;
  }

  const isProse = (p, min) =>
    p.text.length >= min &&
    p.text !== p.text.toUpperCase() &&
    !APPARATUS.test(p.text) &&
    !/^(by|edited by|translated by|illustrated by|with)\b/i.test(p.text) &&
    // A contents entry is a heading with a long descriptive tail. Prose almost
    // never opens with the word "Chapter".
    !/^(chapter|section|part|book|letter|act|scene|volume)\b/i.test(p.text) &&
    // A contents list that reflow happened to join into one long line still
    // names its own structure over and over; prose does not.
    (p.text.match(/\b(chapter|section|part|book|letter|canto|act)\b/gi) ?? []).length < 3 &&
    // Contents entries are Title Case throughout. Even name-heavy prose sits
    // well under half.
    titleCaseRatio(p.text) < 0.45;

  // A real chapter heading is short and is followed by prose within a few
  // paragraphs — an epigraph or a verse quotation often sits in between. In a
  // table of contents the next heading always arrives first, which is what
  // separates the heading at the top of chapter one from its own contents entry.
  // Between a chapter heading and its first sentence there may be a running
  // title, an epigraph, a date line. Between a *contents entry* and the next
  // one there is only more contents — or the front-matter section that follows
  // the list. Either ends the search for this candidate.
  const blocks = (p) => HEADING.test(p.text) || FRONT_MATTER.test(p.text);

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (p.start > text.length * 0.15) break;
    if (!FIRST_HEADING.test(p.text) || p.text.length > 120) continue;
    // A generous window: Austen opens chapter one with two pages of dialogue
    // before a paragraph long enough to be unmistakably prose.
    for (const next of paragraphs.slice(i + 1, i + 20)) {
      if (blocks(next)) break;
      if (isProse(next, 100)) return p.start;
      // Something substantial that is not the book — a transcriber's note.
      if (next.text.length >= 60) break;
    }
  }

  // No chapters — an essay, a treatise, a book of numbered entries. Start at the
  // first line that reads like the author talking rather than like a title page.
  for (const p of paragraphs) {
    if (p.start > text.length * 0.25) break;
    if (isProse(p, 80)) return p.start;
  }
  return 0;
}

/** The first real sentence, for a preview that isn't a contents list. */
function openingLine(text, offset) {
  for (const line of text.slice(offset).split('\n')) {
    const flat = line.replace(/\s+/g, ' ').trim();
    if (flat.length < 60 || flat === flat.toUpperCase() || APPARATUS.test(flat)) continue;
    return makeSnippet(flat);
  }
  return makeSnippet(text.slice(offset));
}

// ─── Per-book pipeline ───────────────────────────────────────────────────────

async function build(book) {
  const dir = join(BOOKS_DIR, book.slug);
  const textPath = join(dir, 'book.txt');
  const rawPath = join(dir, 'source.txt');
  const coverPath = join(dir, 'cover.jpg');
  await mkdir(dir, { recursive: true });

  // 1. Canonical record, and the licence check. Cached on disk so a rerun does
  // not hammer Gutendex — `--force` re-fetches and re-checks everything.
  const recordPath = join(dir, 'gutendex.json');
  let record;
  if (!FORCE && existsSync(recordPath)) {
    record = JSON.parse(await readFile(recordPath, 'utf8'));
  } else {
    record = JSON.parse(await get(`https://gutendex.com/books/${book.pg}`));
    await writeFile(recordPath, JSON.stringify(record, null, 2) + '\n');
  }
  if (record.copyright !== false) {
    throw new Rejected(`Gutendex reports copyright=${record.copyright}`);
  }
  const gutenbergAuthor = record.authors.map((a) => a.name).join(', ');
  if (!matchesAuthor(gutenbergAuthor, book)) {
    throw new Rejected(`Gutendex author "${gutenbergAuthor}" does not match "${book.author}"`);
  }

  const textUrl =
    record.formats['text/plain; charset=utf-8'] ??
    record.formats['text/plain; charset=us-ascii'] ??
    `https://www.gutenberg.org/cache/epub/${book.pg}/pg${book.pg}.txt`;
  const coverUrl =
    record.formats['image/jpeg'] ??
    `https://www.gutenberg.org/cache/epub/${book.pg}/pg${book.pg}.cover.medium.jpg`;

  // 2. Download (cached on disk between runs).
  let raw;
  if (!FORCE && existsSync(rawPath)) {
    raw = await readFile(rawPath, 'utf8');
  } else {
    raw = await get(textUrl);
    assertNotHtml(raw, 'the book text');
    await writeFile(rawPath, raw);
  }

  // Some Gutenberg "covers" are a generated placeholder with their wordmark on
  // it. Those are marked in curation and ship with no cover at all — the app
  // draws its own artwork from the title, which is both nicer and unencumbered.
  if (book.noCover) {
    await rm(coverPath, { force: true });
  } else {
    if (FORCE || !existsSync(coverPath)) {
      const cover = await get(coverUrl, { binary: true });
      assertJpeg(cover, 'the cover');
      await writeFile(coverPath, cover);
    }
    assertJpeg(await readFile(coverPath), 'the cover on disk');
  }

  // 3. Verify against Gutenberg's own header, then clean.
  const { headerTitle, headerAuthor } = assertHeaderMatches(raw, book);
  const text = clean(raw, book.slug);
  await writeFile(textPath, text);

  const wordCount = countWords(text);
  const listeningMinutes = Math.round(wordCount / LISTENING_WPM);
  const readingMinutes = Math.round(wordCount / READING_WPM);
  const start = bodyOffset(text);

  const entry = {
    id: book.slug,
    title: book.title,
    author: book.author,
    category: book.category,
    year: book.year,
    description: book.description,
    shelves: [...book.shelves, lengthShelf(listeningMinutes)].filter(Boolean),
    featured: Boolean(book.featured),
    file: relative(CONTENT, textPath),
    cover: book.noCover ? null : relative(CONTENT, coverPath),
    wordCount,
    charCount: text.length,
    estimatedReadingTime: readingMinutes,
    estimatedListeningTime: listeningMinutes,
    /** Where the work starts, past the contents list and the front matter. */
    bodyOffset: start,
    snippet: openingLine(text, start),
    source: {
      name: 'Project Gutenberg',
      url: `https://www.gutenberg.org/ebooks/${book.pg}`,
      downloadUrl: textUrl,
      coverUrl,
      gutenbergId: book.pg,
      gutenbergTitle: headerTitle,
      gutenbergAuthor: headerAuthor ?? gutenbergAuthor,
      license: 'Public Domain (United States)',
      licenseNote: LICENSE,
      retrieved: new Date().toISOString().slice(0, 10),
      sha256: createHash('sha256').update(text).digest('hex').slice(0, 16),
    },
  };

  await writeFile(join(dir, 'metadata.json'), JSON.stringify(entry, null, 2) + '\n');
  return entry;
}

// ─── Generated catalog ───────────────────────────────────────────────────────

function generateCatalog(entries) {
  const body = entries
    .map(
      (b) => `  {
    id: ${JSON.stringify(b.id)},
    title: ${JSON.stringify(b.title)},
    author: ${JSON.stringify(b.author)},
    year: ${b.year},
    category: ${JSON.stringify(b.category)},
    description: ${JSON.stringify(b.description)},
    snippet: ${JSON.stringify(b.snippet)},
    shelves: ${JSON.stringify(b.shelves)},
    featured: ${b.featured},
    wordCount: ${b.wordCount},
    charCount: ${b.charCount},
    minutes: ${b.estimatedListeningTime},
    bodyOffset: ${b.bodyOffset},
    source: { name: 'Project Gutenberg', url: ${JSON.stringify(b.source.url)}, license: ${JSON.stringify(b.source.license)} },
    text: require('../../content/${b.file}'),
    cover: ${b.cover ? `require('../../content/${b.cover}')` : 'null'},
  },`
    )
    .join('\n');

  return `/**
 * GENERATED by scripts/build-library.mjs — do not edit.
 *
 * ${entries.length} public-domain books from Project Gutenberg. \`text\` and \`cover\` are
 * Metro asset handles into content/books/, resolved to files on device by
 * src/lib/library.ts. Full provenance for every entry lives in
 * content/books.json and content/books/<id>/metadata.json.
 */

/** Metro resolves \`require\` of an asset to an opaque module handle. */
declare const require: (path: string) => number;

export type CatalogBook = {
  id: string;
  title: string;
  author: string;
  year: number;
  category: string;
  description: string;
  /** The opening line, derived at build time — never recomputed on device. */
  snippet: string;
  shelves: string[];
  featured: boolean;
  wordCount: number;
  charCount: number;
  /** Listening time in minutes at 180 wpm. */
  minutes: number;
  /**
   * Offset of the first chapter, past the contents list and front matter. The
   * front matter is still in the text — this is only where play starts.
   */
  bodyOffset: number;
  source: { name: string; url: string; license: string };
  text: number;
  /** Null where Gutenberg has no real cover — the app draws its own artwork. */
  cover: number | null;
};

export type Shelf = { id: string; title: string; subtitle?: string };

export const SHELVES: Shelf[] = ${JSON.stringify(SHELVES, null, 2).replace(/\n/g, '\n')};

export const CATALOG: CatalogBook[] = [
${body}
];

const BY_ID = new Map(CATALOG.map((book) => [book.id, book]));

export function catalogBook(id: string | null | undefined): CatalogBook | null {
  return id ? BY_ID.get(id) ?? null : null;
}
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const wanted = ONLY ? BOOKS.filter((b) => ONLY.includes(b.slug)) : BOOKS;
const entries = [];
const failures = [];

console.log(`Building ${wanted.length} books…\n`);

for (const book of wanted) {
  process.stdout.write(`  ${book.slug.padEnd(44)}`);
  try {
    const entry = await build(book);
    entries.push(entry);
    console.log(
      `ok  ${String(entry.wordCount).padStart(7)} words  ${String(entry.estimatedListeningTime).padStart(4)} min`
    );
  } catch (error) {
    failures.push({ slug: book.slug, reason: error.message });
    console.log(`FAILED — ${error.message}`);
  }
}

if (!ONLY) {
  entries.sort((a, b) => BOOKS.findIndex((x) => x.slug === a.id) - BOOKS.findIndex((x) => x.slug === b.id));
  await writeFile(
    join(CONTENT, 'books.json'),
    JSON.stringify({ generated: new Date().toISOString().slice(0, 10), shelves: SHELVES, books: entries }, null, 2) + '\n'
  );
  await writeFile(join(ROOT, 'src/lib/catalog.ts'), generateCatalog(entries));
}

// A shelf nobody can fill is a shelf that renders as an empty heading.
for (const shelf of SHELVES) {
  const count = entries.filter((e) => e.shelves.includes(shelf.id)).length;
  if (count < 3) console.log(`  ! shelf "${shelf.id}" holds only ${count} book(s)`);
}

const words = entries.reduce((sum, e) => sum + e.wordCount, 0);
const chars = entries.reduce((sum, e) => sum + e.charCount, 0);
console.log(
  `\n${entries.length} books · ${words.toLocaleString('en-US')} words · ` +
    `${(chars / 1e6).toFixed(1)} MB of text · ${failures.length} failed`
);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ${f.slug}: ${f.reason}`);
  process.exitCode = 1;
}

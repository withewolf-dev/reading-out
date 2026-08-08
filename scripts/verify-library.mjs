#!/usr/bin/env node
/**
 * Checks the library that is actually committed, with no network access.
 *
 * The build script verifies what it downloads; this verifies what shipped. Run
 * it in CI, or after any hand-edit of content/. Every failure here is a book a
 * user would open to find nothing, or a licence claim we could not back up.
 *
 *   node scripts/verify-library.mjs
 */

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');

const manifest = JSON.parse(await readFile(join(CONTENT, 'books.json'), 'utf8'));
const catalog = await readFile(join(ROOT, 'src/lib/catalog.ts'), 'utf8');

const problems = [];
const fail = (id, message) => problems.push(`${id}: ${message}`);

let totalBytes = 0;

for (const book of manifest.books) {
  const textPath = join(CONTENT, book.file);
  const coverPath = book.cover ? join(CONTENT, book.cover) : null;
  const metaPath = join(CONTENT, 'books', book.id, 'metadata.json');

  // 1. The files exist. A null cover is a deliberate choice, not a gap: those
  //    books fall back to the app's own title-derived artwork.
  for (const [label, path] of [['text', textPath], ['metadata', metaPath]]) {
    if (!existsSync(path)) fail(book.id, `${label} file is missing (${path})`);
  }
  if (coverPath && !existsSync(coverPath)) fail(book.id, `cover file is missing (${coverPath})`);
  if (!existsSync(textPath)) continue;

  // 2. The text opens, is real text, and is the text we measured.
  const text = await readFile(textPath, 'utf8');
  totalBytes += Buffer.byteLength(text);
  if (coverPath && existsSync(coverPath)) totalBytes += (await stat(coverPath)).size;

  if (text.includes('�')) fail(book.id, 'text contains replacement characters — bad encoding');
  if (/<!doctype html|<html[\s>]/i.test(text.slice(0, 2000))) fail(book.id, 'text is an HTML page');
  if (text.length !== book.charCount) {
    fail(book.id, `charCount says ${book.charCount}, file has ${text.length}`);
  }
  const words = (text.match(/\S+/g) ?? []).length;
  if (words !== book.wordCount) fail(book.id, `wordCount says ${book.wordCount}, file has ${words}`);
  if ((text.match(/[A-Za-z]/g) ?? []).length / text.length < 0.5) {
    fail(book.id, 'text does not look like prose');
  }

  const digest = createHash('sha256').update(text).digest('hex').slice(0, 16);
  if (digest !== book.source.sha256) fail(book.id, 'text has changed since it was recorded');

  // 3. No Project Gutenberg licence furniture survived into the packaged text.
  if (/PROJECT GUTENBERG EBOOK|gutenberg\.org|START OF (THE|THIS) PROJECT/i.test(text)) {
    fail(book.id, 'Project Gutenberg boilerplate is still in the packaged text');
  }

  // 4. Play starts somewhere real.
  if (book.bodyOffset < 0 || book.bodyOffset >= text.length) {
    fail(book.id, `bodyOffset ${book.bodyOffset} is outside the text`);
  } else if (!text.slice(book.bodyOffset, book.bodyOffset + 200).trim()) {
    fail(book.id, 'bodyOffset lands on blank space');
  } else if (book.bodyOffset > text.length * 0.25) {
    fail(book.id, `bodyOffset skips ${Math.round((100 * book.bodyOffset) / text.length)}% of the book`);
  }

  // 5. The cover, where there is one, is a whole JPEG.
  if (coverPath && existsSync(coverPath)) {
    const cover = await readFile(coverPath);
    if (cover.length < 2048) fail(book.id, `cover is only ${cover.length} bytes`);
    if (cover[0] !== 0xff || cover[1] !== 0xd8) fail(book.id, 'cover is not a JPEG');
    if (cover[cover.length - 2] !== 0xff || cover[cover.length - 1] !== 0xd9) {
      fail(book.id, 'cover JPEG is truncated');
    }
  }

  // 6. Provenance is recorded, for every single book.
  const meta = JSON.parse(await readFile(metaPath, 'utf8'));
  if (meta.source?.name !== 'Project Gutenberg') fail(book.id, 'metadata has no source name');
  if (!/^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/.test(meta.source?.url ?? '')) {
    fail(book.id, 'metadata has no canonical source URL');
  }
  if (!meta.source?.license?.includes('Public Domain')) fail(book.id, 'metadata has no licence');
  if (meta.title !== book.title || meta.author !== book.author) {
    fail(book.id, 'metadata disagrees with books.json about title or author');
  }

  // 7. The generated catalog points at these exact files.
  if (!catalog.includes(`require('../../content/${book.file}')`)) {
    fail(book.id, 'catalog.ts does not require this text file');
  }
  if (book.cover && !catalog.includes(`require('../../content/${book.cover}')`)) {
    fail(book.id, 'catalog.ts does not require this cover');
  }
}

// 8. Shelves resolve, and none of them is a heading with nothing under it.
const shelfIds = new Set(manifest.shelves.map((s) => s.id));
for (const book of manifest.books) {
  for (const shelf of book.shelves) {
    if (!shelfIds.has(shelf)) fail(book.id, `is on unknown shelf "${shelf}"`);
  }
}
for (const shelf of manifest.shelves) {
  const count = manifest.books.filter((b) => b.shelves.includes(shelf.id)).length;
  if (count < 3) problems.push(`shelf "${shelf.id}" holds only ${count} book(s)`);
}

const featured = manifest.books.filter((b) => b.featured);
if (featured.length < 8 || featured.length > 10) {
  problems.push(`${featured.length} books are featured; the demo set should be 8–10`);
}

const ids = manifest.books.map((b) => b.id);
if (new Set(ids).size !== ids.length) problems.push('duplicate book ids');

console.log(
  `${manifest.books.length} books · ${featured.length} featured · ` +
    `${(totalBytes / 1e6).toFixed(1)} MB bundled`
);
if (problems.length === 0) {
  console.log('All checks passed.');
} else {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exitCode = 1;
}

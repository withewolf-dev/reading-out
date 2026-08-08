/**
 * Acceptance tests 1 & 2 from PRODUCT.md §21 — offset round-trip and chunk
 * reassembly. Run with `npm run check:text` (compiles src/lib/text.ts first).
 *
 * Fixture deliberately includes accents, an emoji (a surrogate pair, §17.2) and
 * enough length to cross several chunk seams.
 */
import { nextChunkEnd, paragraphIndexAt, splitParagraphs } from '../.cache/checks/text.js';

let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const PARAGRAPH =
  'A café in the naïve part of town — it opened at dawn. 🌅 The owner said nothing at all, ' +
  'and the coffee cost less than the newspaper. Everyone agreed that this was, on balance, correct.';

const DOC = Array.from({ length: 60 }, (_, i) => `${i + 1}. ${PARAGRAPH}`).join('\n\n');

console.log('offset round-trip');
const paragraphs = splitParagraphs(DOC);
check('finds every non-empty paragraph', paragraphs.length === 60, `got ${paragraphs.length}`);
check(
  'every paragraph slice matches its own text',
  paragraphs.every((p) => DOC.slice(p.start, p.end) === p.text)
);
check(
  'offsets are strictly increasing',
  paragraphs.every((p, i) => i === 0 || p.start > paragraphs[i - 1].end)
);

console.log('paragraph lookup');
check(
  'binary search lands in the right paragraph',
  paragraphs.every((p, i) => paragraphIndexAt(paragraphs, p.start) === i)
);
check(
  'an offset inside a paragraph resolves to that paragraph',
  paragraphs.every((p, i) => paragraphIndexAt(paragraphs, p.start + 5) === i)
);
check('an offset past the end resolves to nothing', paragraphIndexAt(paragraphs, DOC.length + 10) === -1);

console.log('chunk reassembly');
const chunks = [];
let cursor = 0;
let guard = 0;
while (cursor < DOC.length) {
  const end = nextChunkEnd(DOC, cursor);
  if (end <= cursor) {
    failures++;
    console.log(`  FAIL chunking did not advance at ${cursor}`);
    break;
  }
  chunks.push(DOC.slice(cursor, end));
  cursor = end;
  if (++guard > 10000) throw new Error('runaway chunk loop');
}
check('chunks reproduce the document exactly', chunks.join('') === DOC);
check('more than one chunk was produced', chunks.length > 1, `got ${chunks.length}`);
check(
  'no chunk is wildly over the budget',
  chunks.every((c) => c.length <= 4000),
  `longest ${Math.max(...chunks.map((c) => c.length))}`
);

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

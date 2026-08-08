/**
 * Text math. Every offset in this app is a UTF-16 index into the *full document*
 * (§17.1) — never utterance-relative, never byte-based.
 */

export type Paragraph = { start: number; end: number; text: string };

/**
 * Split into displayable paragraphs, keeping true document offsets.
 * Invariant (acceptance test 1): fullText.slice(p.start, p.end) === p.text.
 */
export function splitParagraphs(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  let cursor = 0;
  for (const segment of text.split('\n')) {
    const start = cursor;
    cursor += segment.length + 1; // +1 for the '\n' we split on
    if (segment.trim().length === 0) continue;
    out.push({ start, end: start + segment.length, text: segment });
  }
  return out;
}

/** Index of the paragraph containing `offset`, or the next one after it. -1 if none. */
export function paragraphIndexAt(paragraphs: Paragraph[], offset: number): number {
  let lo = 0;
  let hi = paragraphs.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (paragraphs[mid].end <= offset) {
      lo = mid + 1;
    } else {
      best = mid;
      hi = mid - 1;
    }
  }
  return best;
}

const SENTENCE_END = /[.!?…。！？]["'”’)\]]?\s/;

/**
 * End offset of the next speech chunk. Cuts at a sentence boundary past `target`,
 * falls back to a word boundary after `overshoot` (§17.3). Always advances.
 */
export function nextChunkEnd(text: string, start: number, target = 3000, overshoot = 1000): number {
  if (start >= text.length) return text.length;
  const soft = Math.min(start + target, text.length);
  if (soft >= text.length) return text.length;

  const hard = Math.min(start + target + overshoot, text.length);
  const window = text.slice(soft, hard);
  const match = window.search(SENTENCE_END);
  if (match !== -1) {
    // land just past the punctuation + its trailing space
    const rel = match + window.slice(match).search(/\s/) + 1;
    return Math.max(start + 1, soft + rel);
  }
  const lastSpace = text.lastIndexOf(' ', hard);
  return lastSpace > start ? lastSpace + 1 : hard;
}

/** Nudge an offset outward to the start of a sentence — forward skips never land mid-sentence (§19.1). */
export function snapToSentenceStart(text: string, offset: number, direction: 1 | -1): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  if (direction > 0) {
    const rel = text.slice(clamped).search(SENTENCE_END);
    if (rel === -1) return clamped;
    const tail = text.slice(clamped + rel);
    return Math.min(text.length, clamped + rel + tail.search(/\s/) + 1);
  }
  const head = text.slice(0, clamped);
  for (let i = head.length - 2; i > 0; i--) {
    if (SENTENCE_END.test(head.slice(i, i + 3))) return i + 2;
  }
  return 0;
}

/** ~180 wpm ≈ 18 UTF-16 units/sec. */
export const UNITS_PER_SECOND = 18;
export const SKIP_UNITS = 15 * UNITS_PER_SECOND;

/**
 * Thousands separators, done by hand. `toLocaleString('en-US')` ignores its
 * locale argument on Hermes and follows the device instead, which renders
 * 227,652 as "2,27,652" on an en-IN device — it reads as a typo.
 */
export function groupThousands(value: number): string {
  return String(Math.max(0, Math.round(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

/** Derived once at import — never recomputed per row render (§17.9). */
export function makeSnippet(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1).trimEnd() + '…';
}

export function inferTitle(text: string, fallback = 'Untitled'): string {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length < 2) continue;
    const clean = line.replace(/[.,;:—–-]+$/, '').trim();
    return clean.length > 80 ? clean.slice(0, 79).trimEnd() + '…' : clean;
  }
  return fallback;
}

/** "3h 43m left" — the one progress metric that maps to a real goal (§5). */
export function remainingLabel(wordCount: number, fraction: number, wordsPerMinute: number): string {
  const minutes = Math.max(0, Math.round((wordCount * (1 - fraction)) / wordsPerMinute));
  if (minutes < 1) return 'less than a minute left';
  if (minutes < 60) return `${minutes}m left`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
}

/** "0% read" reads as broken — show the number only from 0.5% (§17.21). */
export function percentLabel(fraction: number): string | null {
  const pct = fraction * 100;
  if (pct < 0.5) return null;
  if (pct >= 99.5 && fraction < 1) return '99% complete';
  return `${Math.round(pct)}% complete`;
}

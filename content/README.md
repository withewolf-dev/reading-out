# The bundled library

Fifty public-domain books that ship inside the app, so that a first launch shows
real shelves rather than an empty state.

```
content/
  books.json              the whole catalogue: metadata, shelves, provenance
  books/<id>/
    book.txt              what the app reads aloud (cleaned, reflowed)
    cover.jpg             the cover shown on the shelf
    metadata.json         this book's entry from books.json, standalone
    source.txt            the raw Gutenberg download (git-ignored build cache)
```

## Where it comes from

Every book is from **Project Gutenberg** and is in the **public domain in the
United States**. Nothing here was taken from an unauthorised source, and nothing
was included on a guess: `scripts/build-library.mjs` asks the Gutendex API for
each book's catalogue record and refuses to package anything Gutendex reports as
still in copyright. Two candidates were dropped by that check rather than by
hand — see the build log and `scripts/curation.mjs` for what and why.

Each book records its Gutenberg ebook number, canonical URL, download URL, cover
URL, the title and author as Gutenberg states them, the retrieval date, and a
SHA-256 prefix of the exact text that shipped.

## Why the text is not byte-identical to Gutenberg's

Two changes, both made by the build script and both reversible from `source.txt`:

1. **The Project Gutenberg header, footer and trademark references are removed.**
   The PG licence permits redistributing a public-domain work without them, and
   read aloud they are ninety seconds of licence boilerplate before the book.
   Attribution lives in `metadata.json` and `books.json` instead.

2. **The hard wrapping is reflowed into real paragraphs.** Gutenberg wraps at
   about seventy columns; ReadingLoud treats every newline as a paragraph
   boundary, so the raw file would render — and highlight — as free verse.
   Blocks whose short lines are the point (verse, cast lists, contents) are left
   alone.

Illustration markers, page-number furniture and the underscores Gutenberg uses
for italics are also stripped.

## Rebuilding and checking

```sh
npm run library:build     # re-fetch, re-verify, regenerate src/lib/catalog.ts
npm run library:verify    # check the committed files, no network
npm run check:library     # run all 50 books through the app's own text engine
```

`src/lib/catalog.ts` is generated — edit `scripts/curation.mjs` instead.

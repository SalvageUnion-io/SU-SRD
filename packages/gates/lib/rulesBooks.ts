/**
 * The rules books' text extract, as the rules tools read it: which file is
 * which book, the latest edition of each, and a file split into its pages.
 *
 * `bun run rules:extract` writes one `.txt` per PDF with a `<!-- page N -->`
 * marker before each page (`tools/extract-rules.ts`, which also finds the
 * extract: `findExtractDir`). `check-rules-fidelity.ts` verifies the dataset's
 * prose against these pages; `rules-find.ts` searches them for a reader.
 *
 * Books are matched by FILENAME PATTERN, so a new edition dropped into
 * `rules/` is picked up without a code change (the latest by version wins).
 */
import { readdirSync, readFileSync } from 'node:fs'

export type BookSpec = {
  /** Label used in output and in the lock's `editions`. */
  id: string
  /** The extract, matched by filename so a new edition needs no code change. */
  file: RegExp
  /**
   * The data anchors this book answers for. Empty: a fallback-only text.
   * `partial`: the anchor also covers material with no local text, so a miss
   * there is `unverified-source`, not drift.
   */
  answers: { source: string; booklet?: string; partial?: boolean }[]
  /** Load every matching file (a series of one-off PDFs), not only the latest edition. */
  series?: boolean
  /**
   * For a series whose files each cover one thing: the entity a file covers,
   * from its name. A record of that series is verifiable only when a file
   * covers it (or what owns it); the series' other files are still searched.
   */
  scopeOf?: (file: string) => string | undefined
}

const STARTER = 'Salvage Union Starter Set'
export const BOOK_SPECS: BookSpec[] = [
  {
    id: 'Core Book',
    // Anchored: the expansions share the "Digital Edition" suffix.
    file: /^salvage union digital edition/i,
    answers: [{ source: 'Salvage Union Workshop Manual' }],
  },
  { id: 'False Flag', file: /^false flag/i, answers: [{ source: 'False Flag' }] },
  { id: 'Rainmaker', file: /^rainmaker/i, answers: [{ source: 'Rainmaker' }] },
  {
    id: 'We Were Here First!',
    file: /^we were here first/i,
    answers: [{ source: 'We Were Here First!' }],
  },
  {
    id: 'Reclamation of the Wastes',
    file: /^reclamation of the wastes/i,
    answers: [{ source: 'Reclamation of the Wastes' }],
  },
  // The Starter Set is five booklets, each paginated from 1, so `booklet` picks
  // the text. Its Asset Pack ("AP") holds the three adventure booklets, each
  // also sold on its own, and a deck of item cards that has no local text.
  {
    id: 'Mech Monday',
    file: /^mech monday/i,
    // One file per chassis ("Mech Monday Mule Patterns", "… Goliath Template"),
    // plus the transcribed blog posts. A chassis with no file of its own (the
    // Scrapper patterns survive only as an image) stays unverified-source.
    answers: [{ source: 'Mech Monday' }],
    series: true,
    scopeOf: (file) =>
      file.match(/^mech monday (.+?) (?:patterns|template)\b/i)?.[1]?.toLowerCase(),
  },
  {
    id: 'SUSS Core Rulebook',
    file: /^suss core rulebook/i,
    answers: [{ source: STARTER, booklet: 'CR' }],
  },
  {
    id: 'SUSS Pilots Handbook',
    file: /^suss pilots handbook/i,
    answers: [{ source: STARTER, booklet: 'PH' }],
  },
  {
    id: 'SUSS Parts Catalogue',
    file: /^suss parts catalogue/i,
    answers: [{ source: STARTER, booklet: 'PC' }],
  },
  {
    id: 'SUSS Rules Reference',
    file: /^suss rules reference/i,
    answers: [{ source: STARTER, booklet: 'RR' }],
  },
  {
    id: 'Relics of a Time Gone By',
    file: /^relics of a time gone by/i,
    answers: [
      { source: 'Relics of a Time Gone By' },
      { source: STARTER, booklet: 'AP', partial: true },
    ],
  },
  {
    id: "Thatcher's Mech Base",
    file: /^thatcher'?s mech base/i,
    answers: [
      { source: "Thatcher's Mech Base" },
      { source: STARTER, booklet: 'AP', partial: true },
    ],
  },
  {
    id: 'The Hive',
    file: /^the hive/i,
    answers: [{ source: 'The Hive' }, { source: STARTER, booklet: 'AP', partial: true }],
  },
  // Reprint core text; searched only as a fallback, never cited.
  { id: 'Quick Ref Sheets', file: /^su_quick ref sheets digital/i, answers: [] },
  { id: 'Quickstart', file: /^salvage union quickstart/i, answers: [] },
]

/**
 * The extract(s) for each book present in `dir`: the latest edition (names
 * compared with numeric collation), or for a series every file.
 */
export function pickFiles(dir: string): Map<BookSpec, string[]> {
  return pickLatest(readdirSync(dir).filter((f) => f.endsWith('.txt')))
}

/** `pickFiles` over a list of extract file names. */
export function pickLatest(files: string[]): Map<BookSpec, string[]> {
  const out = new Map<BookSpec, string[]>()
  for (const spec of BOOK_SPECS) {
    const found = files
      .filter((f) => spec.file.test(f))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    if (found.length) out.set(spec, spec.series ? found.reverse() : found.slice(0, 1))
  }
  return out
}

/**
 * Lines that are only a page number, a slot/tech digit, a rotated stamp letter
 * or two, or a "T2" tech tag: layout glyphs, not prose.
 */
const GLYPH_LINE = /^\s*(\d{1,3}|(?![AI]$)[A-Z]{1,3}|T\d|[×x] _)\s*$/

/**
 * A book's extract split at its `<!-- page N -->` markers: page number to
 * text. `dropGlyphs` removes layout-glyph lines, a PDF-side clean-up for
 * reading prose; a stat block's digits are such lines, so keep them to read
 * one.
 */
export function readPages(path: string, { dropGlyphs = false } = {}): Map<number, string> {
  const parts = readFileSync(path, 'utf8').split(/<!-- page (\d+) -->/)
  const pages = new Map<number, string>()
  for (let i = 1; i < parts.length; i += 2) {
    const text = parts[i + 1] ?? ''
    pages.set(
      Number(parts[i]),
      dropGlyphs
        ? text
            .split('\n')
            .filter((l) => !GLYPH_LINE.test(l))
            .join('\n')
        : text
    )
  }
  return pages
}

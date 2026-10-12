/**
 * Rules lookup — `bun run rules:find <term>`. Searches the rules extract and
 * prints one line per hit, `Book p.N: …snippet…`, the page taken from the
 * extract's `<!-- page N -->` markers.
 *
 * It replaces grepping the extract by hand: `grep -C3 'Heat Cap'` returns
 * 40 KB, a line wrap hides a hit ("Heat\nCapacity": 11–19% of hits in an
 * audit), and every hit needs a second grep for its page marker. Each page is
 * read through `gates/lib/rulesBooks.ts`, the page loader
 * `check-rules-fidelity.ts` uses, with typography folded and wraps joined, so
 * a term matches across a line break and a hyphenated line end.
 *
 *   bun run rules:find heat cap           the 2.0a books (Core Book, expansions)
 *   bun run rules:find heat cap --all     every extracted text, every edition
 *   bun run rules:find heat cap --raw     the content-stream layer, for a
 *                                         snippet that reads scrambled: the
 *                                         default layer interleaves columns
 *   bun run rules:find heat cap --limit=0 every hit (default: the first 40)
 *
 * Matching is case-insensitive and by prefix ("Heat Cap" finds "Heat
 * Capacity"). Where the extract lives: `findExtractDir` in `extract-rules.ts`.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fold } from 'gates/lib/proseFidelity'
import { BOOK_SPECS, pickLatest, readPages } from 'gates/lib/rulesBooks'
import { findExtractDir, LAYER_DIR } from './extract-rules'

/** Characters of context either side of a hit. */
const CONTEXT = 110
const DEFAULT_LIMIT = 40

/** A page's text on one line: typography folded, line-end hyphens and wraps joined. */
export function joinWraps(text: string): string {
  return (
    fold(text)
      // a word split at a line end ("compen-\nsate"); a compound keeps its
      // hyphen ("Mech-\nTech")
      .replace(/([a-z])-[ \t]*\n\s*([a-z])/g, '$1$2')
      .replace(/-[ \t]*\n\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * The term as a pattern: case-insensitive, anchored at a word start (so "eat"
 * misses "Heat"), any run of space in it matching any run of space.
 */
export function termPattern(term: string): RegExp {
  const words = joinWraps(term)
    .split(' ')
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const start = /^\w/.test(words[0] ?? '') ? '\\b' : ''
  return new RegExp(start + words.join('\\s+'), 'gi')
}

/**
 * One snippet per cluster of hits on a page (hits whose context overlaps
 * share one), widened to whole words, with `…` where cut.
 */
export function snippets(text: string, pattern: RegExp, context = CONTEXT): string[] {
  const spans: [number, number][] = []
  for (const m of text.matchAll(pattern)) {
    const lo = Math.max(0, m.index - context)
    const hi = Math.min(text.length, m.index + m[0].length + context)
    const last = spans.at(-1)
    if (last && lo <= last[1]) last[1] = hi
    else spans.push([lo, hi])
  }
  return spans.map(([lo, hi]) => {
    // widen to whole words, so a cut never splits one (or the hit)
    const a = lo > 0 ? text.lastIndexOf(' ', lo - 1) + 1 : 0
    const end = text.indexOf(' ', hi)
    const b = end < 0 ? text.length : end
    return `${a > 0 ? '…' : ''}${text.slice(a, b).trim()}${b < text.length ? '…' : ''}`
  })
}

export type Source = { label: string; file: string }

/**
 * The extract files to search, each with the label its hits cite. Default:
 * each book whose latest edition is 2.0a, labelled by book. `all`: every
 * extracted text, labelled by file name.
 */
export function sources(files: string[], all: boolean): Source[] {
  if (all) return files.map((f) => ({ label: f.replace(/\.txt$/, ''), file: f }))
  const picked = pickLatest(files)
  return BOOK_SPECS.flatMap((spec) =>
    (picked.get(spec) ?? [])
      .filter((f) => /\b2\.0a\b/.test(f))
      .map((file) => ({ label: spec.id, file }))
  )
}

/** Every hit in `searched`, as `Book p.N: …snippet…` lines in book and page order. */
export function findHits(
  dir: string,
  searched: Source[],
  term: string,
  layer: 'flow' | 'raw' = 'flow'
): string[] {
  const pattern = termPattern(term)
  const lines: string[] = []
  for (const { label, file } of searched) {
    // a text with no PDF behind it (a transcribed blog post) has no raw layer
    const layered = join(dir, LAYER_DIR[layer], file)
    const path = existsSync(layered) ? layered : join(dir, file)
    for (const [page, text] of readPages(path))
      for (const s of snippets(joinWraps(text), pattern)) lines.push(`${label} p.${page}: ${s}`)
  }
  return lines
}

function main(): void {
  const args = process.argv.slice(2)
  const flags = args.filter((a) => a.startsWith('--'))
  const term = args.filter((a) => !a.startsWith('--')).join(' ')
  const all = flags.includes('--all')
  const layer = flags.includes('--raw') ? 'raw' : 'flow'
  const limitFlag = flags.find((f) => f.startsWith('--limit='))
  const limit = limitFlag ? Number(limitFlag.slice('--limit='.length)) : DEFAULT_LIMIT
  const unknown = flags.filter((f) => !['--all', '--raw'].includes(f) && !f.startsWith('--limit='))
  if (!term.trim() || unknown.length || !Number.isInteger(limit) || limit < 0) {
    console.error('Usage: bun run rules:find <term> [--all] [--raw] [--limit=N]')
    process.exitCode = 1
    return
  }

  const dir = findExtractDir()
  if (!dir) {
    console.error(
      'No rules extract. Locally: `bun run rules:extract` (needs the PDFs in rules/). Cloud: attach su-rules as a second repo.'
    )
    process.exitCode = 1
    return
  }
  const searched = sources(
    readdirSync(dir).filter((f) => f.endsWith('.txt')),
    all
  )
  const lines = findHits(dir, searched, term, layer)
  const shown = limit === 0 ? lines : lines.slice(0, limit)
  for (const l of shown) console.log(l)
  const legend = all
    ? `${searched.length} texts`
    : searched.map((s) => `${s.label} = ${s.file.replace(/\.txt$/, '')}`).join('; ')
  console.log(
    `\n${lines.length} hit${lines.length === 1 ? '' : 's'} for "${term}" in ${legend} (${layer} layer, ${dir}).` +
      (shown.length < lines.length ? ` Showing ${shown.length}: --limit=0 prints all.` : '') +
      (all ? '' : ' --all searches every edition.')
  )
}

if (import.meta.main) main()

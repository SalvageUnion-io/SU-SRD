/**
 * Pure logic for intra-record content duplication in Salvage Union data.
 *
 * A record duplicates its own content when one `content[]` paragraph repeats
 * another paragraph of the SAME record — either verbatim, or by swallowing it
 * whole (an un-split "blob" paragraph sitting alongside the split version of
 * the same prose). Both shapes render the text twice on the entity card.
 *
 * This is exactly how "Can't Stop, Won't Stop" and "Mech-Gyver" regressed: the
 * `Break out Actions (#66)` migration, which lifted action prose out of
 * abilities.json into actions.json, emitted BOTH its un-split source blob and
 * its paragraph-split output for those two records. Nine validators existed at
 * the time and not one looked *inside* a single record's own content array, so
 * it sat undetected. This check closes that gap.
 *
 * Deliberately scoped to a single record: repetition ACROSS records is normal
 * and heavily used in this corpus (the Tech 2–6 Pilot Bay tiers, the
 * Crawler/Pilot/Mech movement rates on the map guides, Minor/Major injury
 * healing). Only self-duplication is a defect.
 */

/** How a paragraph duplicates another within the same record. */
export type DupeKind =
  /** Two paragraphs normalize to exactly the same text. */
  | 'exact'
  /** One paragraph fully contains another (the un-split "blob" shape). */
  | 'contains'

export type ContentDupe = {
  file: string
  /** `name` of the owning record, for a human-readable breadcrumb. */
  record: string
  kind: DupeKind
  /** 1-based index of the paragraph that repeats/swallows the other. */
  paragraph: number
  /** 1-based index of the paragraph being repeated/swallowed. */
  duplicateOf: number
  /** Leading text of the duplicated prose, for the diagnostic message. */
  excerpt: string
}

/**
 * Paragraphs shorter than this (in words) are ignored.
 *
 * Short stock phrases legitimately recur inside one record — a stat line, a
 * bare "Roll to hit as normal.", a repeated table caption. The duplication this
 * check exists to catch is always a substantial block of rules prose, so a
 * floor buys immunity to that noise at no cost to detection: both known
 * regressions duplicate 20+ word sentences.
 */
export const MIN_WORDS = 8

/**
 * Normalize a paragraph for comparison.
 *
 * Strips `[[Trait]]` link markers, collapses whitespace, and lowercases. The
 * marker-stripping is load-bearing rather than cosmetic: in the "Can't Stop,
 * Won't Stop" regression the blob kept its `[[Vulnerable]]` links while the
 * split copies had degraded to plain `Vulnerable`, so a marker-sensitive
 * comparison would have missed the duplication entirely.
 */
export function normalizeParagraph(value: string): string {
  return value
    .replace(/\[\[|\]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const wordCount = (normalized: string): number =>
  normalized.length === 0 ? 0 : normalized.split(' ').length

/** Extract the comparable paragraph strings from one `content[]` array. */
function paragraphValues(content: unknown[]): (string | null)[] {
  return content.map((block) => {
    if (block === null || typeof block !== 'object') return null
    const value = (block as Record<string, unknown>).value
    return typeof value === 'string' ? value : null
  })
}

const excerpt = (normalized: string): string =>
  normalized.length <= 80 ? normalized : `${normalized.slice(0, 80)}…`

/**
 * Find self-duplicating paragraphs within a single `content[]` array.
 *
 * Reports each duplicated pair once. For an `exact` pair only the later
 * paragraph is reported (the earlier one is treated as the original); for a
 * `contains` pair the containing paragraph is reported against the one it
 * swallows.
 */
export function findDupesInContent(content: unknown[]): Omit<ContentDupe, 'file' | 'record'>[] {
  const raw = paragraphValues(content)
  const normalized = raw.map((v) => (v === null ? null : normalizeParagraph(v)))
  const eligible = normalized.map((n) => n !== null && wordCount(n) >= MIN_WORDS)

  const dupes: Omit<ContentDupe, 'file' | 'record'>[] = []

  for (let i = 0; i < normalized.length; i++) {
    if (!eligible[i]) continue
    const a = normalized[i] as string

    for (let j = 0; j < normalized.length; j++) {
      if (i === j || !eligible[j]) continue
      const b = normalized[j] as string

      if (a === b) {
        // Exact pair: report only the later occurrence, so one pair yields one
        // diagnostic rather than two mirror-image ones.
        if (j < i) {
          dupes.push({ kind: 'exact', paragraph: i + 1, duplicateOf: j + 1, excerpt: excerpt(b) })
        }
        continue
      }

      if (a.includes(b)) {
        dupes.push({ kind: 'contains', paragraph: i + 1, duplicateOf: j + 1, excerpt: excerpt(b) })
      }
    }
  }

  return dupes
}

/**
 * Walk an arbitrary data node, reporting self-duplication in every `content[]`
 * array found. Recurses into nested structures (chassis patterns, choice
 * blocks, etc.) so nested records are covered too, carrying the nearest
 * enclosing `name` as the breadcrumb.
 */
function walk(node: unknown, file: string, recordName: string, out: ContentDupe[]): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, file, recordName, out)
    return
  }
  if (node === null || typeof node !== 'object') return

  const record = node as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name : recordName

  if (Array.isArray(record.content)) {
    for (const dupe of findDupesInContent(record.content)) {
      out.push({ file, record: name, ...dupe })
    }
  }

  for (const value of Object.values(record)) walk(value, file, name, out)
}

/**
 * Orchestration entry point: given the full data bag (filename -> parsed
 * array), return every intra-record content duplication. Both the standalone
 * CLI (tools/validateContentDupes.ts) and the unified runner
 * (tools/validate.ts) call this so the two can never diverge.
 */
export function runContentDupeCheck(
  filesByName: Record<string, Record<string, unknown>[]>
): ContentDupe[] {
  const dupes: ContentDupe[] = []
  for (const [file, records] of Object.entries(filesByName)) {
    walk(records, file, '(unnamed)', dupes)
  }
  return dupes
}

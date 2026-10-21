/**
 * The one prose segmenter: a run of rules text cut into what it prints as
 * words and what it prints as references. Every surface that draws prose with
 * Mentions reads it through this, so a card (`useProseRefs`) and a page
 * resolved at build time (`refText`) link the same sentence the same way.
 *
 * Pure: it returns typed segments, and the caller draws them (React nodes, or
 * the serialisable `RefText` an island carries).
 */

import type { EntityRef } from 'salvageunion-reference'
import { parseTraitReferences } from 'salvageunion-reference'
import type { NameRefIndex } from '../components/entity/nameRefs'
import { findNameRefs } from '../components/entity/nameRefs'
import type { PageRefIndex } from '../components/entity/pageRefs'
import { findPageRefs, resolvePageRef } from '../components/entity/pageRefs'

/** What one run of prose prints. */
type Run =
  /** Words with no reference in them. */
  | { kind: 'text'; text: string }
  /** A `\n\n` paragraph break. */
  | { kind: 'break' }
  /** A `[[Trait]]` or `[[[Trait] (X)]]`: the name it resolves, the words it prints. */
  | { kind: 'trait'; name: string; param: string | undefined; text: string }
  /** A "p. 235" (`pageRefs`) or an entry named in plain words (`nameRefs`) that resolves. */
  | { kind: 'page' | 'name'; text: string; ref: EntityRef }

/** One run of prose, and where it starts in the source text. */
export type ProseSegment = Run & { start: number }

/** What a surface resolves beyond the trait markup; each absent, that kind stays text. */
export type ProseRefs = {
  /** The entries prose names in plain words (`findNameRefs`). */
  nameRefs?: NameRefIndex | undefined
  /** The Workshop Manual pages prose cites (`resolvePageRef`). */
  pageRefs?: PageRefIndex | undefined
  /** The entity whose prose this is: its own name links nothing (`ProseOwnerContext`). */
  owner?: string | undefined
}

type Span = { start: number; end: number; run: Run }

/**
 * `text` cut into segments, in order. The trait grammar is the package's
 * (`parseTraitReferences`, which also builds the search index), so a trait
 * never links here that search cannot find. A name inside trait markup is the
 * trait's; a reference that overlaps an earlier one is dropped, so no prose
 * prints twice.
 */
export function segmentProse(
  text: string,
  { nameRefs, pageRefs, owner }: ProseRefs = {}
): ProseSegment[] {
  const traits = parseTraitReferences(text).map((match) => ({
    start: match.startIndex,
    end: match.startIndex + match.fullMatch.length,
    name: match.traitName,
    param: match.parameter,
  }))
  const spans: Span[] = traits.map(({ start, end, name, param }) => ({
    start,
    end,
    run: { kind: 'trait', name, param, text: param === undefined ? name : `${name} (${param})` },
  }))
  for (const match of text.matchAll(/\n\n/g)) {
    spans.push({ start: match.index, end: match.index + 2, run: { kind: 'break' } })
  }
  // A page reference is resolved from the prose before it, read with any
  // trait markup in place: a `[[Name]]` still contains the name.
  if (pageRefs) {
    for (const match of findPageRefs(text)) {
      const ref = resolvePageRef(pageRefs, match.page, text.slice(0, match.start))
      if (!ref) continue
      const words = text.slice(match.start, match.end)
      spans.push({ start: match.start, end: match.end, run: { kind: 'page', text: words, ref } })
    }
  }
  if (nameRefs) {
    for (const match of findNameRefs(text, nameRefs, traits, owner)) {
      const words = text.slice(match.start, match.end)
      spans.push({
        start: match.start,
        end: match.end,
        run: { kind: 'name', text: words, ref: match.ref },
      })
    }
  }

  const segments: ProseSegment[] = []
  let at = 0
  for (const span of spans.sort((a, b) => a.start - b.start)) {
    if (span.start < at) continue
    if (span.start > at)
      segments.push({ start: at, kind: 'text', text: text.slice(at, span.start) })
    segments.push({ ...span.run, start: span.start })
    at = span.end
  }
  if (at < text.length) segments.push({ start: at, kind: 'text', text: text.slice(at) })
  return segments
}

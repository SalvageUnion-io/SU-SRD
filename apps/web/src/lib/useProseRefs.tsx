import type { CSSProperties, ReactNode } from 'react'
import { useContext, useId, useMemo } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { mentionRef } from '../components/entity'
import { useEntitySurface } from '../components/entity/entitySurfaceContext'
import { Mention } from '../components/entity/forms/Mention'
import { ProseOwnerContext } from '../components/entity/nameRefs'
import { useInsidePeek } from '../components/entity/peekContext'
import { space } from '../design/tokens'
import { emphasisRuns, inside, splitEmphasis } from './proseEmphasis'
import { ProseSectionContext } from './proseSection'
import { segmentProse } from './segmentProse'

/** The blank line a `\n\n` paragraph break renders as. */
const PARAGRAPH_BREAK = { display: 'block', height: space[12] } satisfies CSSProperties

/**
 * Hook to parse text content for trait references and replace them with
 * Mentions (each a link or opener where its entry resolves, with its Peek)
 *
 * Supports two bracket notation patterns:
 * 1. Simple traits: [[trait-name]] -> a Mention reading "trait-name"
 * 2. Traits with parameters: [[[Trait Name] (parameter)]] -> a Mention reading "Trait Name (parameter)"
 *
 * Each in-prose trait reference is a MENTION (entity display language E4):
 * the name resolves against the traits glossary, then the keywords
 * (`mentionRef`); the Mention links to its page, opens it, or (unresolved)
 * renders inert, and Peeks wherever it resolves. It is never raw
 * `[[markup]]`, a chip or a Stat.
 *
 * And the book's page references: where the surface supplies `pageRefs` (the
 * SRD), a "p. 235" that resolves (`resolvePageRef`) is a Mention of the entity
 * covering that page, reading "p. 235". One that does not, and every one
 * inside a Peek (terminal, E16), stays text.
 *
 * And the entries it names in plain words: where the surface supplies
 * `nameRefs` (the SRD), "the Dependable Trait" or "within Close Range" is a
 * Mention of that entry (`findNameRefs`), each entry once per text. Inside a
 * Peek they stay text, as page references do.
 *
 * The prose is cut by `segmentProse`, the segmenter a page resolved at build
 * time reads too (`refText`), so the two link a sentence alike; this draws the
 * segments, a `\n\n` as a paragraph break.
 *
 * Returns the text as-is when it holds nothing to draw (the common case).
 *
 * @param text - The text content to parse
 * @returns Original text string if no matches, or array of React nodes (strings and Mentions) if matches found
 */
export function useParseTraitReferences(text: string | undefined): ReactNode {
  const { pageRefs: pageIndex, nameRefs: nameIndex } = useEntitySurface()
  const insidePeek = useInsidePeek()
  const pageRefs = insidePeek ? undefined : pageIndex
  const nameRefs = insidePeek ? undefined : nameIndex
  const owner = useContext(ProseOwnerContext)
  const section = useContext(ProseSectionContext)
  const run = useId()
  return useMemo(() => {
    if (!text) return null
    const segments = segmentProse(text, { nameRefs, pageRefs, owner })
    const [only] = segments
    // The book's `*italics*` print in italics, their asterisks dropped (`proseEmphasis`).
    const italics = emphasisRuns(text)
    if (segments.length === 1 && only?.kind === 'text' && italics.length === 0) return text
    const em = (key: string, at: number, node: ReactNode) =>
      inside(at, italics) ? <em key={`em-${key}`}>{node}</em> : node
    // In a section a term links at its first mention alone (`ProseSection`),
    // and is plain words after.
    const linked = new Set<string>()
    const again = (ref: EntityRef | undefined) => {
      if (!section || !ref) return false
      const term = `${ref.schemaName}:${ref.id}`
      if (linked.has(term) || !section.claim(term, run)) return true
      linked.add(term)
      return false
    }
    // Within a paragraph a term's first link is the keyboard's stop; a later
    // one is still a link, never a second stop.
    let stops = new Set<string>()
    return segments.flatMap((segment) => {
      const key = `${segment.kind}-${segment.start}`
      if (segment.kind === 'text') {
        if (italics.length === 0) return segment.text
        return splitEmphasis(segment.text, segment.start, italics).map((piece) =>
          piece.italic ? <em key={`em-${piece.start}`}>{piece.text}</em> : piece.text
        )
      }
      if (segment.kind === 'break') {
        stops = new Set()
        return <span key={key} style={PARAGRAPH_BREAK} />
      }
      const ref = segment.kind === 'trait' ? mentionRef(segment.name) : segment.ref
      // A book's page reference cites: it links every time.
      if (segment.kind !== 'page' && again(ref)) return em(key, segment.start, segment.text)
      const term = ref ? `${ref.schemaName}:${ref.id}` : ''
      const repeat = term !== '' && stops.has(term)
      stops.add(term)
      return em(
        key,
        segment.start,
        <Mention key={key} entityRef={ref} repeat={repeat}>
          {segment.text}
        </Mention>
      )
    })
  }, [text, pageRefs, nameRefs, owner, section, run])
}

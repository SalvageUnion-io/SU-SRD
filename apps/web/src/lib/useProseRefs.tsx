import type { CSSProperties, ReactNode } from 'react'
import { useContext, useMemo } from 'react'
import { mentionRef } from '../components/entity'
import { useEntitySurface } from '../components/entity/entitySurfaceContext'
import { Mention } from '../components/entity/forms/Mention'
import { ProseOwnerContext } from '../components/entity/nameRefs'
import { useInsidePeek } from '../components/entity/peekContext'
import { space } from '../design/tokens'
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
  return useMemo(() => {
    if (!text) return null
    const segments = segmentProse(text, { nameRefs, pageRefs, owner })
    const [only] = segments
    if (segments.length === 1 && only?.kind === 'text') return text
    return segments.map((segment) => {
      const key = `${segment.kind}-${segment.start}`
      switch (segment.kind) {
        case 'text':
          return segment.text
        case 'break':
          return <span key={key} style={PARAGRAPH_BREAK} />
        case 'trait':
          return (
            <Mention key={key} entityRef={mentionRef(segment.name)}>
              {segment.text}
            </Mention>
          )
        default:
          return (
            <Mention key={key} entityRef={segment.ref}>
              {segment.text}
            </Mention>
          )
      }
    })
  }, [text, pageRefs, nameRefs, owner])
}

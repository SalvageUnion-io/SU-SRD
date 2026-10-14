import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import { parseTraitReferences as parseTraitRefs } from 'salvageunion-reference'
import { space } from '../design/tokens'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import { Mention } from '../entity/forms/Mention'
import { findPageRefs, resolvePageRef } from '../entity/pageRefs'
import { mentionRef } from '../entity/parts/tagItems'
import { useInsidePeek } from '../entity/peekContext'

/** The blank line a `\n\n` paragraph break renders as. */
const PARAGRAPH_BREAK = { display: 'block', height: space[12] } satisfies CSSProperties

/**
 * One in-prose trait reference: a MENTION (entity display language E4). The
 * name resolves against the traits glossary, then the keywords; the Mention
 * links to its page, opens it, or (unresolved) renders inert, and Peeks
 * wherever it resolves. It is never raw `[[markup]]`, a chip or a Stat.
 */
// This module's public surface is the `useParseTraitReferences` HOOK; `TraitRef`
// is a private rendering detail of it and must not enter the barrel. The rule
// below is a Fast Refresh heuristic wanting a module to export only components —
// exporting TraitRef to satisfy it would widen the package's public API to
// silence a dev-server hint, and splitting a 10-line private helper into its own
// file to the same end is worse. The hook is the boundary.
// biome-ignore lint/style/useComponentExportOnlyModules: private helper of an intentionally hook-only module; see above
function TraitRef({ name, param }: { name: string; param?: string }) {
  const label = param === undefined ? name : `${name} (${param})`
  return <Mention entityRef={mentionRef(name)}>{label}</Mention>
}

/**
 * Hook to parse text content for trait references and replace them with
 * Mentions (each a link or opener where its entry resolves, with its Peek)
 *
 * Supports two bracket notation patterns:
 * 1. Simple traits: [[trait-name]] -> a Mention reading "trait-name"
 * 2. Traits with parameters: [[[Trait Name] (parameter)]] -> a Mention reading "Trait Name (parameter)"
 *
 * And the book's page references: where the surface supplies `pageRefs` (the
 * SRD), a "p. 235" that resolves (`resolvePageRef`) is a Mention of the entity
 * covering that page, reading "p. 235". One that does not, and every one
 * inside a Peek (terminal, E16), stays text.
 *
 * Performance: Uses useMemo to prevent re-parsing on every render
 * Returns original text as-is if no bracket notation found (common case)
 *
 * @param text - The text content to parse
 * @returns Original text string if no matches, or array of React nodes (strings and Mentions) if matches found
 */
export function useParseTraitReferences(text: string | undefined): ReactNode {
  const { pageRefs: pageIndex } = useEntitySurface()
  const insidePeek = useInsidePeek()
  const pageRefIndex = insidePeek ? undefined : pageIndex
  return useMemo(() => {
    if (!text) {
      return null
    }

    const hasTraits = text.includes('[[')
    const hasParagraphBreaks = text.includes('\n\n')
    const hasPageRefs = !!pageRefIndex && text.includes('p.')

    if (!hasTraits && !hasParagraphBreaks && !hasPageRefs) {
      return text
    }

    const nodes: ReactNode[] = []
    let currentIndex = 0

    // The trait grammar is parsed by the PACKAGE, not re-implemented here.
    //
    // The package's parser also builds the search index, so a second regex
    // here could disagree with it and render a trait as a link that search
    // cannot find.
    //
    // `parseTraitReferences` returns positions, which is exactly what node
    // building needs, so this composes it and adds only what is genuinely
    // presentational: the React elements, and the `\n\n` paragraph break,
    // which is a rendering concern the package has no opinion about.
    const refs = parseTraitRefs(text)
    const breaks = [...text.matchAll(/\n\n/g)].map((m) => ({
      start: m.index,
      end: m.index + 2,
      kind: 'break' as const,
    }))
    const traits = refs.map((r) => ({
      start: r.startIndex,
      end: r.startIndex + r.fullMatch.length,
      kind: 'trait' as const,
      name: r.traitName,
      param: r.parameter,
    }))

    // A reference is resolved from the prose before it, read with any trait
    // markup in place: a `[[Name]]` still contains the name.
    const pages = pageRefIndex
      ? findPageRefs(text).flatMap((m) => {
          const ref = resolvePageRef(pageRefIndex, m.page, text.slice(0, m.start))
          return ref ? [{ ...m, kind: 'page' as const, ref }] : []
        })
      : []

    for (const seg of [...traits, ...breaks, ...pages].sort((a, b) => a.start - b.start)) {
      // A paragraph break inside a trait reference cannot happen, but a
      // defensive skip keeps a pathological overlap from duplicating prose.
      if (seg.start < currentIndex) continue
      if (seg.start > currentIndex) {
        nodes.push(text.substring(currentIndex, seg.start))
      }
      if (seg.kind === 'break') {
        nodes.push(<span key={`break-${seg.start}`} style={PARAGRAPH_BREAK} />)
      } else if (seg.kind === 'page') {
        nodes.push(
          <Mention key={`page-${seg.start}`} entityRef={seg.ref}>
            {text.substring(seg.start, seg.end)}
          </Mention>
        )
      } else {
        nodes.push(<TraitRef key={`trait-${seg.start}`} name={seg.name} param={seg.param} />)
      }
      currentIndex = seg.end
    }

    if (currentIndex < text.length) {
      nodes.push(text.substring(currentIndex))
    }

    return nodes.length === 0 ? text : nodes
  }, [text, pageRefIndex])
}

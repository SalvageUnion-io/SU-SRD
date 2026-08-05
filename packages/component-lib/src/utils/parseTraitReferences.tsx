import type { ReactNode } from 'react'
import { useMemo } from 'react'
import {
  parseTraitReferences as parseTraitRefs,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { InlineRef } from '../components/chrome/InlineRef'
import { EntityTooltip } from '../components/referenceEntity/EntityTooltip'

/**
 * One in-prose trait reference, rendered through `InlineRef` (canonical
 * primitive language §2: InlineRef absorbs parseTraitReferences). The trait
 * name resolves against the traits schema; when found, the mark is wrapped in
 * the rich entity hover-tooltip, else it renders as a plain inert mark. No
 * `href` is passed — component-lib is route-agnostic, so these are the inert
 * (ink dashed, tooltip-summoning) form of the ref, never the rust link.
 */
// This module's public surface is the `useParseTraitReferences` HOOK; `TraitRef`
// is a private rendering detail of it and must not enter the barrel. The rule
// below is a Fast Refresh heuristic wanting a module to export only components —
// exporting TraitRef to satisfy it would widen the package's public API to
// silence a dev-server hint, and splitting a 20-line private helper into its own
// file to the same end is worse. The hook is the boundary.
// biome-ignore lint/style/useComponentExportOnlyModules: private helper of an intentionally hook-only module; see above
function TraitRef({ name, param }: { name: string; param?: string }) {
  const trait = SalvageUnionReference.findIn(
    'traits',
    (t) => t.name.toLowerCase() === name.toLowerCase()
  )
  const label = param === undefined ? name : `${name} (${param})`
  const mark = <InlineRef>{label}</InlineRef>
  if (trait?.id) {
    return (
      <EntityTooltip schemaName="traits" entityId={trait.id} openDelay={300}>
        {mark}
      </EntityTooltip>
    )
  }
  return mark
}

/**
 * Hook to parse text content for trait references and replace them with in-prose
 * `InlineRef` marks (with an entity hover-tooltip when the trait resolves)
 *
 * Supports two bracket notation patterns:
 * 1. Simple traits: [[trait-name]] -> an InlineRef mark reading "trait-name"
 * 2. Traits with parameters: [[[Trait Name] (parameter)]] -> an InlineRef mark reading "Trait Name (parameter)"
 *
 * Performance: Uses useMemo to prevent re-parsing on every render
 * Returns original text as-is if no bracket notation found (common case)
 *
 * @param text - The text content to parse
 * @returns Original text string if no matches, or array of React nodes (strings and InlineRef marks) if matches found
 */
export function useParseTraitReferences(text: string | undefined): ReactNode {
  return useMemo(() => {
    if (!text) {
      return null
    }

    const hasTraits = text.includes('[[')
    const hasParagraphBreaks = text.includes('\n\n')

    if (!hasTraits && !hasParagraphBreaks) {
      return text
    }

    const nodes: ReactNode[] = []
    let currentIndex = 0

    // The trait grammar is parsed by the PACKAGE, not re-implemented here.
    //
    // There used to be three regexes for this markup — one here, one in the
    // reference package, one in the Discord bot — and they did not agree: the
    // package required a space in `[[[Melee] (2)]]` where both renderers
    // accepted `[[[Melee](2)]]`, so it silently extracted nothing from the
    // space-less form while this file resolved the trait. Since the package's
    // parser is what builds the search index, that divergence meant a trait
    // could render as a link and be missing from search.
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

    for (const seg of [...traits, ...breaks].sort((a, b) => a.start - b.start)) {
      // A paragraph break inside a trait reference cannot happen, but a
      // defensive skip keeps a pathological overlap from duplicating prose.
      if (seg.start < currentIndex) continue
      if (seg.start > currentIndex) {
        nodes.push(text.substring(currentIndex, seg.start))
      }
      if (seg.kind === 'break') {
        nodes.push(<span key={`break-${seg.start}`} className="block h-3" />)
      } else {
        nodes.push(<TraitRef key={`trait-${seg.start}`} name={seg.name} param={seg.param} />)
      }
      currentIndex = seg.end
    }

    if (currentIndex < text.length) {
      nodes.push(text.substring(currentIndex))
    }

    return nodes.length === 0 ? text : nodes
  }, [text])
}

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
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

    // Combined regex: trait references (both forms) and paragraph breaks.
    //
    // The name/param classes exclude their own OPENING delimiter (`[^\][]`,
    // `[^)(]`) as well as the closing one. A trait name can never contain a
    // bracket and a parameter never contains a paren, so this matches exactly
    // the same strings — but it bounds every scan at the next opening
    // delimiter. With the opener admitted, input like `[[[[[[[…` made the
    // engine re-scan the remainder from each `[[` start, which is quadratic.
    const combinedRegex = /\[\[\[([^\][]+)\]\s*\(([^)(]+)\)\]\]|\[\[([^\][]+)\]\]|\n\n/g

    let match: RegExpExecArray | null = combinedRegex.exec(text)

    while (match !== null) {
      if (match.index > currentIndex) {
        nodes.push(text.substring(currentIndex, match.index))
      }

      if (match[0] === '\n\n') {
        // Paragraph break: block spacer element
        nodes.push(<span key={`break-${match.index}`} className="block h-3" />)
      } else if (match[1] !== undefined && match[2] !== undefined) {
        nodes.push(
          <TraitRef key={`trait-${match.index}`} name={match[1].trim()} param={match[2].trim()} />
        )
      } else if (match[3] !== undefined) {
        nodes.push(<TraitRef key={`trait-${match.index}`} name={match[3].trim()} />)
      }

      currentIndex = match.index + match[0].length
      match = combinedRegex.exec(text)
    }

    if (currentIndex < text.length) {
      nodes.push(text.substring(currentIndex))
    }

    return nodes.length === 0 ? text : nodes
  }, [text])
}

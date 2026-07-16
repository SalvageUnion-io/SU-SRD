import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { StatDisplay } from '../components/shared/StatDisplay'

/**
 * Hook to parse text content for trait references and replace them with horizontal StatDisplay chips (with an entity hover-tooltip)
 *
 * Supports two bracket notation patterns:
 * 1. Simple traits: [[trait-name]] -> a horizontal StatDisplay with label="trait-name"
 * 2. Traits with parameters: [[[Trait Name] (parameter)]] -> a horizontal StatDisplay with label="trait-name", value="parameter"
 *
 * Performance: Uses useMemo to prevent re-parsing on every render
 * Returns original text as-is if no bracket notation found (common case)
 *
 * @param text - The text content to parse
 * @returns Original text string if no matches, or array of React nodes (strings and horizontal StatDisplay chips (with an entity hover-tooltip)) if matches found
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

    // Combined regex: trait references (both forms) and paragraph breaks
    const combinedRegex = /\[\[\[([^\]]+)\]\s*\(([^)]+)\)\]\]|\[\[([^\]]+)\]\]|\n\n/g

    let match: RegExpExecArray | null = combinedRegex.exec(text)

    while (match !== null) {
      if (match.index > currentIndex) {
        nodes.push(text.substring(currentIndex, match.index))
      }

      if (match[0] === '\n\n') {
        // Paragraph break: block spacer element
        nodes.push(<span key={`break-${match.index}`} className="block h-3" />)
      } else if (match[1] !== undefined && match[2] !== undefined) {
        const traitName = match[1].trim()
        const paramValue = match[2].trim()

        nodes.push(
          <StatDisplay
            key={`trait-${match.index}`}
            orientation="horizontal"
            label={traitName}
            value={paramValue}
            compact
            entityTooltip={{ schemaName: 'traits', label: traitName }}
          />
        )
      } else if (match[3] !== undefined) {
        const traitName = match[3].trim()

        nodes.push(
          <StatDisplay
            key={`trait-${match.index}`}
            orientation="horizontal"
            label={traitName}
            compact
            entityTooltip={{ schemaName: 'traits', label: traitName }}
          />
        )
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

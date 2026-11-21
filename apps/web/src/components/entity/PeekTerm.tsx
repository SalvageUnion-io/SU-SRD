import type { CSSProperties } from 'react'
import { fontSize, space } from '../../design/tokens'
import { Slab } from '../atoms/Slab'
import { Box } from '../containers/Box'
import type { StatTerm } from './parts/statTerms'
import { InsidePeekContext } from './peekContext'

const TEXT = { margin: 0 } satisfies CSSProperties

const CITE = {
  fontSize: fontSize.caption,
  margin: `${space[8]} 0 0`,
  textAlign: 'right',
} satisfies CSSProperties

/**
 * The PEEK of a stat the glossary has no entry for (`term:<key>`): its name
 * on a Slab (N5), what it means in the app's words, and the book's page.
 * Read-only and terminal, as every Peek is (E16).
 */
export function PeekTerm({ term }: { term: StatTerm }) {
  return (
    <InsidePeekContext.Provider value={true}>
      <Box>
        <Slab label={term.name} />
        <p style={TEXT}>{term.text}</p>
        <p style={CITE}>{term.cite}</p>
      </Box>
    </InsidePeekContext.Provider>
  )
}

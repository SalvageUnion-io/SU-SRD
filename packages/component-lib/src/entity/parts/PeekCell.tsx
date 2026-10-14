import type { ReactNode } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { usePeekAttrs } from '../peekContext'

/** The cell does not grow or reflow its row by being wrapped. */
const WRAP = { display: 'inline-flex', flex: 'none', lineHeight: 1 } as const

/**
 * A chip that Peeks the glossary entry its label names (a measured keyword,
 * "Damage | 2 SP"; entity display language E4). The chip stays a plain `Stat`
 * atom: this wrapper carries the Peek's address, and the page's PeekHost does
 * the rest. With nothing to Peek it adds no element.
 */
export function PeekCell({ peek, children }: { peek: EntityRef | undefined; children: ReactNode }) {
  const attrs = usePeekAttrs(peek)
  if (!attrs['data-peek']) return children
  return (
    <span {...attrs} style={WRAP}>
      {children}
    </span>
  )
}

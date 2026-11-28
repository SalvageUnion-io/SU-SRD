import type { ReactNode } from 'react'
import { entityCopy } from '../../../messages/components-entity'
import { ChipButton } from '../../atoms/ChipButton'
import { PEEK_PRESS_ATTRIBUTE, usePeekAttrs } from '../peekContext'
import type { StatTerm } from './statTerms'
import { termPeekAddress } from './statTerms'

/**
 * A chip or tile that names a stat with no glossary entry (`statTerms`), as
 * the control that defines it (E27): a press, hover or focus opens the term's
 * Peek, its meaning in the app's words over the book's page. Inside a Peek,
 * or where nothing Peeks, the cell only reads.
 */
export function TermChip({
  term,
  value,
  above = false,
  children,
}: {
  term: StatTerm
  /**
   * Its Peek opens above it (r6 E20): a sheet's stat label, whose own
   * controls sit below it and must stay free to press.
   */
  above?: boolean
  /** The cell's value, for the control's name: `Cargo Capacity: 30`. */
  value?: string | undefined
  children: ReactNode
}) {
  const peek = usePeekAttrs(undefined, termPeekAddress(term))
  if (!('data-peek' in peek)) return <>{children}</>
  return (
    <ChipButton
      {...peek}
      {...{ [PEEK_PRESS_ATTRIBUTE]: '' }}
      data-term=""
      data-peek-side={above ? 'top' : undefined}
      aria-label={
        value
          ? entityCopy('termValueMeans', { term: term.name, value })
          : entityCopy('termMeans', { term: term.name })
      }
    >
      {children}
    </ChipButton>
  )
}

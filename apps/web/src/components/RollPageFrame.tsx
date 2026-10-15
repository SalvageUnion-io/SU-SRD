import { InlineRef } from 'component-lib'
import type { ReactNode } from 'react'

type RollPageFrameProps = {
  /** The page's density setting (`rollTableDensity`, or always `compact`). */
  density: string
  /** The table's prose, a paragraph each, over the instrument. */
  description: readonly string[]
  /** The page's main column under the prose: the table's instrument. */
  children: ReactNode
}

/**
 * The roll pages' shared frame (board 08b): the table's prose, the table, and
 * the Randsum credit, set very small under it. A roll's result is a toast
 * (`toastRoll`), as on every card, raised by the island; the table marks where
 * it landed. `RollTableView` and `ColumnsTableView` differ only in the table.
 */
export function RollPageFrame({ density, description, children }: RollPageFrameProps) {
  return (
    <div className="srd-roll" data-density={density}>
      {description.map((paragraph) => (
        <p key={paragraph} className="srd-roll__description">
          {paragraph}
        </p>
      ))}
      {children}
      <p className="srd-roll__credit">
        Dice rolling powered by{' '}
        <InlineRef href="https://randsum.dev" target="_blank" rel="noopener noreferrer">
          Randsum.dev
        </InlineRef>
      </p>
    </div>
  )
}

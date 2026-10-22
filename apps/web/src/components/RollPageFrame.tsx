import type { ReactNode } from 'react'
import type { RefText } from '../lib/rollTablePage'
import { plainText } from '../lib/rollTablePage'
import { InlineRef } from './index'
import { MentionProse } from './MentionProse'

type RollPageFrameProps = {
  /** The page's density setting (`rollTableDensity`, or always `compact`). */
  density: string
  /** The table's prose, a paragraph each, over the instrument: its references are Mentions. */
  description: readonly RefText[]
  /** The page's main column under the prose: the table's instrument. */
  children: ReactNode
}

/**
 * The roll pages' shared frame: the table's prose, the table, and
 * the Randsum credit, set very small under it. A roll's result is a toast
 * (`toastRoll`), as on every card, raised by the island; the table marks where
 * it landed. `RollTableView` and `ColumnsTableView` differ only in the table.
 */
export function RollPageFrame({ density, description, children }: RollPageFrameProps) {
  return (
    <div className="su-roll-page" data-density={density}>
      {description.map((paragraph) => (
        <p key={plainText(paragraph)} className="su-roll-page__description">
          <MentionProse parts={paragraph} />
        </p>
      ))}
      {children}
      <p className="su-roll-page__credit">
        Dice rolling powered by{' '}
        <InlineRef href="https://randsum.dev" target="_blank" rel="noopener noreferrer">
          Randsum.dev
        </InlineRef>
      </p>
    </div>
  )
}

import type { CSSProperties } from 'react'
import { cn } from '../../../lib/cn'
import { capsLabel } from '../../atoms/capsLabel'
import { FOCUS_RING } from '../../atoms/interaction'
import { RollControl } from '../../compositions/RollTableInstrument'
import { usePeekAttrs } from '../peekContext'

const PILL = cn('su-entity-token__pill', capsLabel())

/** The roll table's pill: ink, a thing you do, as an action's Token. */
const TOKEN_PILL = {
  backgroundColor: 'var(--color-ink)',
  color: 'var(--color-paper)',
} satisfies CSSProperties

/**
 * ROLL TOKEN — a roll table nested in another card (EDL E14: "nested: Token,
 * Table, Roll the Die"; owner's calls, 2026-10-14 and 2026-10-18): the ink
 * pill with the table's name on the cut-out, at a Token's height, its roll
 * (`RollControl`, Mini) inside its strip after the name (chips and actions
 * C1a, C8). It is a Token with an action, so a `div` whose name tab is the
 * Peek trigger (`peekAt`, the table's rows): no button sits in a link, and
 * the rows never open in the card.
 *
 * The Token form's own markup (`.su-entity-token__*`), here in `entity/`
 * with the other forms (E15), never hand-built by its host.
 */
export function RollToken({
  name,
  stamp,
  onRoll,
  peekAt,
}: {
  /** The table's name, on the cut-out. */
  name: string
  /** The roll's words: "Roll the Die:", or "Roll twice:" for two dice. */
  stamp: string
  /** Roll it; absent (a damaged host), the stamp only reads. */
  onRoll?: () => void
  /** The table's Peek address; none, and its name only reads. */
  peekAt?: string
}) {
  const peek = usePeekAttrs(undefined, peekAt)
  const peeks = Object.keys(peek).length > 0
  return (
    <div className="su-entity-token su-roll-token">
      <div className={PILL} style={TOKEN_PILL}>
        {/* The name tab is the Peek's trigger, focusable so a keyboard
            opens it too; the roll beside it is its own control. */}
        <span
          className={peeks ? `su-entity-token__notch ${FOCUS_RING}` : 'su-entity-token__notch'}
          tabIndex={peeks ? 0 : undefined}
          {...peek}
        >
          <span className="su-entity-token__name">
            {name}
            <span className="su-sr-only"> (roll table)</span>
          </span>
        </span>
        <span className="su-roll-token__actions">
          <RollControl name={name} size="mini" onRoll={onRoll}>
            {stamp}
          </RollControl>
        </span>
      </div>
    </div>
  )
}

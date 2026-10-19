import type { CSSProperties } from 'react'
import { cn } from '../../../lib/cn'
import { capsLabel } from '../../atoms/capsLabel'
import { FOCUS_RING } from '../../atoms/interaction'
import { RollControl } from '../../compositions/RollTableInstrument'
import { SELECT_DIM, SELECTED_RING } from '../modes/selectedRing'
import { toggleAttrs } from '../modes/toggle'
import { usePeekAttrs } from '../peekContext'

const PILL = cn('su-entity-token__pill', capsLabel())

/** The roll table's pill: ink, a thing you do, as an action's Token. */
const TOKEN_PILL = {
  backgroundColor: 'var(--color-ink)',
  color: 'var(--color-paper)',
} satisfies CSSProperties

/** The name on the cut-out, its kind for screen readers. */
function Name({ name }: { name: string }) {
  return (
    <span className="su-entity-token__name">
      {name}
      <span className="su-sr-only"> (roll table)</span>
    </span>
  )
}

/**
 * ROLL TOKEN — a roll table as a Token (EDL E14: "nested: Token, Table, Roll
 * the Die"; owner's calls, 2026-10-14 and 2026-10-18): the ink pill with the
 * table's name on the cut-out, at a Token's height.
 *
 * - **Nested in a card** (`onRoll`): its roll (`RollControl`, Mini) inside its
 *   strip after the name (chips and actions C1a, C8). It is a Token with an
 *   action, so a `div` whose name tab is the Peek trigger (`peekAt`, the
 *   table's rows): no button sits in a link, and the rows never open in the
 *   card.
 * - **In a list of tables to choose from** (`toggle`: Play's Tables, ruleset
 *   §1.3): the toggle Token (EDL Modes), the whole Token one button, pressed
 *   while its table is open, the ring on its pill; an unchosen one beside a
 *   chosen one in the one dim. Choosing it opens the table's instrument
 *   (R8), whose stamp is the one roll, so it carries no roll of its own; its
 *   parent marks it (`data-choice-toggle`, N7).
 *
 * The Token form's own markup (`.su-entity-token__*`), here in `entity/`
 * with the other forms (E15), never hand-built by its host.
 */
export function RollToken({
  name,
  stamp,
  onRoll,
  peekAt,
  toggle,
}: {
  /** The table's name, on the cut-out. */
  name: string
  /** The roll's words: "Roll the Die:" (the default), or "Roll twice:" for two dice. */
  stamp?: string
  /** Roll it; absent (a damaged host), the stamp only reads. */
  onRoll?: () => void
  /** The table's Peek address; none, and its name only reads. */
  peekAt?: string
  /** A choice of table: pressed while it is open, `dim` beside a chosen one. */
  toggle?: { pressed: boolean; onToggle: () => void; dim?: boolean }
}) {
  const peek = usePeekAttrs(undefined, toggle ? undefined : peekAt)
  const peeks = Object.keys(peek).length > 0
  if (toggle) {
    return (
      <div
        className={cn('su-entity-token su-roll-token', FOCUS_RING, toggle.dim && SELECT_DIM)}
        {...toggleAttrs({ pressed: toggle.pressed, onToggle: toggle.onToggle, label: name })}
      >
        <span className={PILL} style={{ ...TOKEN_PILL, ...(toggle.pressed ? SELECTED_RING : {}) }}>
          <span className="su-entity-token__notch">
            <Name name={name} />
          </span>
        </span>
      </div>
    )
  }
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
          <Name name={name} />
        </span>
        <span className="su-roll-token__actions">
          <RollControl name={name} size="mini" onRoll={onRoll}>
            {stamp ?? 'Roll the Die:'}
          </RollControl>
        </span>
      </div>
    </div>
  )
}

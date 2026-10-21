import type { CSSProperties } from 'react'
import { cn } from '../../../lib/cn'
import { capsLabel } from '../../atoms/capsLabel'
import { FOCUS_RING } from '../../atoms/interaction'
import { RollControl } from '../../compositions/RollTableInstrument'
import { SELECT_DIM, SELECTED_RING } from '../modes/selectedRing'
import { toggleAttrs } from '../modes/toggle'
import { usePeekAttrs } from '../peekContext'

const PILL = cn('su-entity-mini__pill', capsLabel())

/** The roll table's pill: ink, a thing you do, as an action's Mini. */
const TOKEN_PILL = {
  backgroundColor: 'var(--color-ink)',
  color: 'var(--color-paper)',
} satisfies CSSProperties

/** The name on the cut-out, its kind for screen readers. */
function Name({ name }: { name: string }) {
  return (
    <span className="su-entity-mini__name">
      {name}
      <span className="su-sr-only"> (roll table)</span>
    </span>
  )
}

/**
 * ROLL TOKEN — a roll table as a Mini (EDL E14: "nested: Mini, Table, Roll
 * the Die"; owner's calls, 2026-10-14 and 2026-10-18): the ink pill with the
 * table's name on the cut-out, at a Mini's height.
 *
 * - **Nested in a card** (`onRoll`): its roll (`RollControl`, Mini) inside its
 *   strip after the name (chips and actions C1a, C8). It is a Mini with an
 *   action, so a `div` whose name tab is the Peek trigger (`peekAt`, the
 *   table's rows): no button sits in a link, and the rows never open in the
 *   card.
 * - **In a list of tables to choose from** (`toggle`: Play's Tables, ruleset
 *   §1.3): the toggle Mini (EDL Modes), the whole Mini one button, pressed
 *   while its table is open, the ring on its pill; an unchosen one beside a
 *   chosen one in the one dim. Choosing it opens the table's instrument
 *   (R8), whose stamp is the one roll, so it carries no roll of its own; its
 *   parent marks it (`data-choice-toggle`, N7).
 *
 * The Mini form's own markup (`.su-entity-mini__*`), here in `entity/`
 * with the other forms (E15), never hand-built by its host.
 */
export function RollMini({
  name,
  stamp,
  onRoll,
  peekAt,
  toggle,
  size = 'mini',
}: {
  /** The table's name, on the cut-out. */
  name: string
  /** The roll's words: "Roll the Die:" (the default), or "Roll the Dice:" for two dice. */
  stamp?: string
  /** Roll it; absent (a damaged host), the stamp only reads. */
  onRoll?: () => void
  /** The table's Peek address; none, and its name only reads. */
  peekAt?: string
  /** A choice of table: pressed while it is open, `dim` beside a chosen one. */
  toggle?: { pressed: boolean; onToggle: () => void; dim?: boolean }
  /** Nested in a Page (a Full host), one size up: a Compact head (owner, round 6). */
  size?: 'mini' | 'compact'
}) {
  const peek = usePeekAttrs(undefined, toggle ? undefined : peekAt)
  const peeks = Object.keys(peek).length > 0
  if (toggle) {
    return (
      <div
        className={cn('su-entity-mini su-roll-token', FOCUS_RING, toggle.dim && SELECT_DIM)}
        {...toggleAttrs({ pressed: toggle.pressed, onToggle: toggle.onToggle, label: name })}
      >
        <span className={PILL} style={{ ...TOKEN_PILL, ...(toggle.pressed ? SELECTED_RING : {}) }}>
          <span className="su-entity-mini__notch">
            <Name name={name} />
          </span>
        </span>
      </div>
    )
  }
  return (
    <div
      className="su-entity-mini su-roll-token"
      data-size={size === 'compact' ? 'compact' : undefined}
    >
      <div className={PILL} style={TOKEN_PILL}>
        {/* The name tab is the Peek's trigger, focusable so a keyboard
            opens it too; the roll beside it is its own control. */}
        <span
          className={peeks ? `su-entity-mini__notch ${FOCUS_RING}` : 'su-entity-mini__notch'}
          tabIndex={peeks ? 0 : undefined}
          {...peek}
        >
          <Name name={name} />
        </span>
        {/* Its chip group (C8): the roll, the strip's one action. */}
        <span className="su-roll-token__actions" data-chip-group="">
          <RollControl name={name} size={size} onRoll={onRoll}>
            {stamp ?? 'Roll the Die:'}
          </RollControl>
        </span>
      </div>
    </div>
  )
}

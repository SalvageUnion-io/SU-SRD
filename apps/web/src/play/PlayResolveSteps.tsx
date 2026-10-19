/**
 * PlayResolveSteps — an action's resolve, opened in place in its Row (play.md
 * §5): Activate, then the Core Mechanic table, then Apply. Presentational:
 * `useActionsDeck` builds the `ResolveModel` from the seat's `resolving` and
 * owns every write; this draws its steps and calls back.
 *
 * The roll is the table's (`PlayRollInstrument`, R8): its ROLL THE DIE stamp
 * is the one roll control, and the result is its marked row. Once a mech's
 * action has rolled, the same stamp reads Push (reroll, +2 Heat and a Heat
 * Check, Core Book p.233) while a Push is open to it.
 *
 * Inside a level-1 Row, so the steps are plain buttons and plain content (the
 * Nested Frames Audit, play.md §12): no box, card or titled head of their own.
 * A note (the Cascade Failure hand-off) is an unlabelled Callout.
 */

import type { CSSProperties } from 'react'
import { Button, Callout, tokens } from '../components/index'
import { ResolveCost, ResolveSpend } from './PlayResolveCost'
import { PlayRollInstrument } from './PlayRollInstrument'
import type { ResolveModel } from './useActionsDeck'

type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

/** The table every action's roll reads (Core Book p.233). */
const CORE_MECHANIC = 'Core Mechanic'

const GROW = { flex: '1 1 0', minWidth: 0 } satisfies CSSProperties

const NOTE = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  color: tokens.color.ink,
} satisfies CSSProperties

export function PlayResolveSteps({ view, canWrite }: { view: Resolving; canWrite: boolean }) {
  const { controls, roll } = view
  // Rolled, a mech's action Pushes from the same stamp while it may.
  const push = roll && controls.push && !controls.push.disabled ? controls.push : null
  return (
    <div className="su-play-resolve">
      {/* Mounted before the first roll, so the d20, its band and Apply are
          spoken as they land; each line is one text node, read whole. */}
      <div aria-live="polite" className="su-sr-only">
        {roll && <p>{`Rolled ${roll.roll}: ${roll.bandLabel}. ${roll.bandSummary}`}</p>}
        {view.pushLog && <p>{view.pushLog}</p>}
        {view.applied && <p>Result applied</p>}
      </div>

      <div className="su-play-resolve__spend">
        <ResolveSpend cost={view.cost} currency={view.currency} />
      </div>
      <ResolveCost currencyChoice={view.currencyChoice} variableHot={view.variableHot} />

      <div className="su-play-resolve__steps">
        <Button
          variant={controls.activated ? 'default' : 'primary'}
          size="compact"
          style={GROW}
          onClick={controls.onActivate}
          disabled={!canWrite || controls.activateDisabled}
          title={controls.activateTitle}
        >
          {controls.activated ? 'Activated ✓' : 'Activate'}
        </Button>
      </div>

      <PlayRollInstrument
        table={CORE_MECHANIC}
        roll={roll?.roll ?? null}
        stamp={push ? 'Push:' : undefined}
        onRoll={canWrite ? (push ? push.onPush : controls.onRoll) : undefined}
      />
      {controls.push?.lockedReason && <p style={NOTE}>{controls.push.lockedReason}</p>}

      <div className="su-play-resolve__steps">
        <Button
          size="compact"
          style={GROW}
          onClick={controls.onApply}
          disabled={!canWrite || controls.applyDisabled}
          title="Commit this result"
        >
          {controls.applyLabel}
        </Button>
        <Button variant="ghost" size="compact" onClick={controls.onClear} disabled={!canWrite}>
          Clear
        </Button>
      </div>

      {view.pushLog && <p style={NOTE}>{view.pushLog}</p>}
      {view.meltdown && (
        <Button variant="primary" size="compact" onClick={view.meltdown.onConfirm}>
          Confirm Meltdown — Mark Mech destroyed
        </Button>
      )}
      {view.applied && <p style={NOTE}>Result applied ✓</p>}
      {view.applyRouted && (
        <Callout>
          Cascade Failure: a severe consequence. Take the damage on the unit’s gauge in Units;
          nothing was applied for you.
        </Callout>
      )}
    </div>
  )
}

/**
 * DowntimeStepNav — the way through a Downtime's steps, drawn once for the
 * player's step box (`PlayDowntimeStep`) and the Mediator's
 * (`PlayMediatorDowntime`): **Back** to the step before (`BackLabel`, the
 * Mediator's), **End Downtime**, and on to the next step (`NextLabel`,
 * "Next: Step 3"). Every control is Compact, the step box's line.
 *
 * The last step's way on is End Downtime, in Next's place. The Mediator may
 * end early (`endEarly`): End Downtime stands at every step, before Next (the
 * caller asks first before the last step, ADR-007).
 *
 * It draws its controls into its host's control row (a fragment), after the
 * step's own acts (Skip, Apply & mark done), so the row keeps one Size.
 */

import type { CSSProperties } from 'react'
import { Button, NextLabel } from '../components/index'
import { playCopy } from '../messages/play'

/** Pushes End and Next to the row's end, Back left at its start. */
const SPACER = { flex: '1 1 0%' } satisfies CSSProperties

type DowntimeStepNavProps = {
  /** The step the table is on (0-based), and how many there are. */
  step: number
  count: number
  /** The session may not write: every control is off. */
  off: boolean
  /** Back a step; absent, no Back (the player's box), null when it cannot go back. */
  onBack?: (() => void) | null
  /** End Downtime. */
  onEnd: () => void
  /** On to the next step. */
  onAdvance: () => void
  /** End Downtime is offered at every step, not only the last (the Mediator's). */
  endEarly?: boolean
}

export function DowntimeStepNav({
  step,
  count,
  off,
  onBack,
  onEnd,
  onAdvance,
  endEarly = false,
}: DowntimeStepNavProps) {
  // The last step's way on is End Downtime itself.
  const last = step >= count - 1
  return (
    <>
      {onBack !== undefined && (
        <>
          <Button
            back
            size="compact"
            variant="ghost"
            disabled={off || step === 0 || onBack === null}
            onClick={() => onBack?.()}
          >
            {playCopy('step', { max: Math.max(step, 1) })}
          </Button>
          <span style={SPACER} />
        </>
      )}
      {(endEarly || last) && (
        <Button size="compact" variant={last ? 'ink' : 'default'} disabled={off} onClick={onEnd}>
          {playCopy('endDowntime')}
        </Button>
      )}
      {!last && (
        <Button size="compact" variant="ink" disabled={off} onClick={onAdvance}>
          <NextLabel to={`Step ${step + 2}`} />
        </Button>
      )}
    </>
  )
}

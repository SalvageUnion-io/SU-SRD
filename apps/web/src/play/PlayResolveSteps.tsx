/**
 * PlayResolveSteps — an action's resolve, opened in place in its Row (play.md
 * §5): Activate, Roll, Push?, Apply, and what the roll came to. Presentational:
 * `useActionsDeck` builds the `ResolveModel` from the seat's `resolving` and
 * owns every write; this draws its steps and calls back.
 *
 * Inside a level-1 Row, so the steps are plain buttons and plain content (the
 * Nested Frames Audit, play.md §12): no box, card or titled head of their own.
 * A note (the Cascade Failure hand-off) is an unlabelled Callout.
 */

import type { CSSProperties } from 'react'
import { Button, Callout, tokens } from '../components/index'
import { ResolveCost, ResolveSpend } from './PlayResolveCost'
import type { ResolveModel } from './useActionsDeck'

type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

const GROW = { flex: '1 1 0', minWidth: 0 } satisfies CSSProperties

const NOTE = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  color: tokens.color.ink,
} satisfies CSSProperties

export function PlayResolveSteps({ view, canWrite }: { view: Resolving; canWrite: boolean }) {
  const { controls, roll } = view
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
        <Button
          variant={roll ? 'default' : 'primary'}
          size="compact"
          style={GROW}
          onClick={controls.onRoll}
          disabled={!canWrite}
          aria-label="Roll"
        >
          {roll ? `Roll · ${roll.roll}` : 'Roll'}
        </Button>
        {controls.push && (
          <Button
            variant="danger"
            size="compact"
            style={GROW}
            onClick={controls.push.onPush}
            disabled={!canWrite || controls.push.disabled}
            title={controls.push.lockedReason ?? 'Reroll the d20, +2 Heat, forcing a Heat Check'}
          >
            {controls.push.pushed ? 'Pushed' : 'Push?'}
          </Button>
        )}
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

      {controls.push?.lockedReason && <p style={NOTE}>{controls.push.lockedReason}</p>}

      {roll && (
        <div className="su-play-resolve__roll" data-band={roll.band}>
          <span className="su-play-resolve__d20">{roll.roll}</span>
          <span className="su-play-resolve__band">
            <strong>
              {roll.bandLabel} · {roll.bandRange}
            </strong>
            <span>{roll.bandSummary}</span>
          </span>
        </div>
      )}
      {view.pushLog && <p style={NOTE}>{view.pushLog}</p>}
      {view.meltdown && (
        <Button variant="danger" size="compact" onClick={view.meltdown.onConfirm}>
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

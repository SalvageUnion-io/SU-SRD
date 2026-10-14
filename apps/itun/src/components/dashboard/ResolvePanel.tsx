/**
 * ResolvePanel — the display's Resolve tab: the action chosen from the deck,
 * and the Activate / Roll / Push / Apply flow that resolves it
 * (docs/architecture/dashboard.md §5.2).
 *
 * Presentational: `useActionsDeck` builds the `ResolveModel` and owns every
 * write, and this only renders it and calls back. The action itself is the
 * reused `ReferenceEntityCard` at its full extent, so its roll table and
 * details are all here. With nothing chosen, it says where to choose.
 */

import type { ReferenceCardEntity } from 'component-lib'
import { ActivationCost, Button, ReferenceEntityCard, Stat } from 'component-lib'
import { color, font, fontSize, space, weight } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

export type ResolveModel =
  | {
      kind: 'idle'
      text: string
      /** Offered when the seat names an action the deck no longer has. */
      onClear?: () => void
    }
  | {
      kind: 'resolve'
      onBack: () => void
      /**
       * What activating spends, each 0 when it spends none: `amount` of the
       * `currency`, the Heat it adds, and its uses. Drawn by `ResolveSpend`.
       */
      cost: { amount: number; heat: number; uses: number }
      /** What this activation spends: the mech's EP or the pilot's AP. */
      currency: 'EP' | 'AP'
      entity: ReferenceCardEntity
      /** EP-vs-AP cost radio for `activationCurrency === 'EP or AP'` actions. */
      currencyChoice?: {
        epCost: number
        currency: 'EP' | 'AP'
        pilotAvailable: boolean
        activated: boolean
        onCurrency: (c: 'EP' | 'AP') => void
      }
      /** `− X +` Hot(X) stepper + heat projection for variable-Heat actions. */
      variableHot?: {
        hotX: number
        activated: boolean
        projText: string
        over: boolean
        onDec: () => void
        onInc: () => void
      }
      controls: {
        activateLabel: string
        activateDisabled: boolean
        activateTitle?: string
        onActivate: () => void
        onRoll: () => void
        /**
         * Mech actions only (pilots cannot Push, Core Book p.233). Disabled
         * before a roll, once this roll is pushed, and where +2 Heat would
         * pass the Heat Cap (Quick Ref p.233).
         */
        push?: {
          disabled: boolean
          pushed: boolean
          onPush: () => void
          /** Why Push is refused at this Heat, or undefined when it is not. */
          lockedReason?: string
        }
        /** The activation is paid (or the action needs none paid). */
        activated: boolean
        applyLabel: string
        applyDisabled: boolean
        onApply: () => void
        onClear: () => void
      }
      roll?: {
        roll: number
        band: string
        /** The band's span on the d20, as the book prints it ("11–19"). */
        bandRange: string
        bandLabel: string
        bandSummary: string
        /** A Cascade Failure: Apply hands it to the Major, never writes it. */
        destructive: boolean
      } | null
      pushLog?: string | null
      /** A Push's Heat Check melted the reactor down; the player confirms it. */
      meltdown?: { onConfirm: () => void; onDismiss: () => void } | null
      applied: boolean
      applyRouted: boolean
    }

const GROW: CSSProperties = { flex: 1 }

const STEP: CSSProperties = { minWidth: 0, paddingInline: space[8] }

const IDLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space[8],
  height: '100%',
}

const SPEND = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[6],
} satisfies CSSProperties

const NO_COST = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.note,
  color: color.wkMuted,
} satisfies CSSProperties

/**
 * What activating spends, label-first: `HEAT | +1` and `USES | 3` chips, then
 * the activation cost ("2 EP") last — the one count that reads value-first.
 * The Resolve tab's head and the phone's bottom bar both draw it.
 */
export function ResolveSpend({
  cost,
  currency,
}: Pick<Extract<ResolveModel, { kind: 'resolve' }>, 'cost' | 'currency'>) {
  if (cost.amount <= 0 && cost.heat <= 0 && cost.uses <= 0) {
    return <span style={NO_COST}>No cost</span>
  }
  return (
    <span style={SPEND}>
      {cost.heat > 0 && (
        <Stat orientation="horizontal" size="compact" label="Heat" value={`+${cost.heat}`} />
      )}
      {cost.uses > 0 && (
        <Stat orientation="horizontal" size="compact" label="Uses" value={cost.uses} />
      )}
      {cost.amount > 0 && <ActivationCost cost={cost.amount} currency={currency} compact />}
    </span>
  )
}

/**
 * What an activation asks before it is paid: EP or AP for an `EP or AP`
 * action, and X for a variable Hot. The canvas's Resolve tab and the phone's
 * resolve screen (`PhoneResolve`) both render it.
 */
export function ResolveCost({
  currencyChoice,
  variableHot,
}: Pick<Extract<ResolveModel, { kind: 'resolve' }>, 'currencyChoice' | 'variableHot'>) {
  return (
    <>
      {currencyChoice && (
        <fieldset className="su-dash-deck-cost-choice">
          {/*
           * Deliberately NATIVE radios, not the chrome `Radio` primitive.
           * That primitive is a self-framed choice-row card; here the two
           * options are compact inline `su-dash-deck-radio` labels inside the
           * already-bordered `su-dash-deck-cost-choice` fieldset, and the framed
           * primitive would turn the tight EP/AP pair into two bordered cards
           * nested in a bordered fieldset. Adopt only once `Radio` grows a
           * bare/instrument rung.
           */}
          <legend className="su-dash-deck-cost-choice-lab">Pay with</legend>
          <label className="su-dash-deck-radio">
            <input
              type="radio"
              name="su-dash-deck-currency"
              checked={currencyChoice.currency === 'EP'}
              disabled={currencyChoice.activated}
              onChange={() => currencyChoice.onCurrency('EP')}
            />
            {currencyChoice.epCost} EP
          </label>
          <label className="su-dash-deck-radio">
            <input
              type="radio"
              name="su-dash-deck-currency"
              checked={currencyChoice.currency === 'AP'}
              disabled={currencyChoice.activated || !currencyChoice.pilotAvailable}
              onChange={() => currencyChoice.onCurrency('AP')}
            />
            {currencyChoice.epCost} AP
          </label>
        </fieldset>
      )}

      {variableHot && (
        <div className="su-dash-deck-hotx">
          <span className="su-dash-deck-hotx-lab">Hot</span>
          <div className="su-dash-step">
            <Button
              size="compact"
              style={STEP}
              onClick={variableHot.onDec}
              disabled={variableHot.activated}
              aria-label="Decrease Hot"
            >
              −
            </Button>
            <span className="su-dash-step-num">{variableHot.hotX}</span>
            <Button
              size="compact"
              style={STEP}
              onClick={variableHot.onInc}
              disabled={variableHot.activated}
              aria-label="Increase Hot"
            >
              +
            </Button>
          </div>
          <span
            className={`su-dash-deck-hotx-proj${variableHot.over ? ' su-dash-deck-hotx-proj--over' : ''}`}
          >
            {variableHot.projText}
          </span>
        </div>
      )}
    </>
  )
}

export function ResolvePanel({ view }: { view: ResolveModel }) {
  if (view.kind === 'idle') {
    return (
      <div style={IDLE}>
        <div className="su-dash-deck-empty">{view.text}</div>
        {view.onClear ? (
          <Button variant="ghost" size="compact" onClick={view.onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    )
  }

  const { currencyChoice, variableHot, controls, roll } = view
  return (
    <div className="su-dash-display-scroll">
      {/* Mounted before the first roll, so the d20, its band and Apply are
          spoken as they land; each line is one text node, read whole. */}
      <div aria-live="polite" className="su-sr-only">
        {roll && <p>{`Rolled ${roll.roll}: ${roll.bandLabel}. ${roll.bandSummary}`}</p>}
        {view.pushLog && <p>{view.pushLog}</p>}
        {view.applied && <p>Result applied</p>}
      </div>
      <div className="su-dash-deck-panel">
        <div className="su-dash-deck-panel-head">
          <Button variant="ghost" size="compact" onClick={view.onBack}>
            ◀ Back
          </Button>
          <ResolveSpend cost={view.cost} currency={view.currency} />
        </div>

        {/* The card being resolved prints its READ pennant (board D1): the
            rust pennant is the deck row's, which brought the action here
            (ruleset §1). Activate is a step of the resolve, beside Roll and
            Apply. The Dashboard stays flat, so no speckle. */}
        <ReferenceEntityCard data={view.entity} texture={false} />

        <ResolveCost currencyChoice={currencyChoice} variableHot={variableHot} />

        <div className="su-dash-deck-controls">
          <Button
            variant="primary"
            size="compact"
            style={GROW}
            onClick={controls.onActivate}
            disabled={controls.activateDisabled}
            title={controls.activateTitle}
          >
            {controls.activateLabel}
          </Button>
          <Button size="compact" style={GROW} onClick={controls.onRoll}>
            Roll
          </Button>
          {controls.push && (
            <Button
              variant="danger"
              size="compact"
              style={GROW}
              onClick={controls.push.onPush}
              disabled={controls.push.disabled}
              title={controls.push.lockedReason ?? 'Reroll the d20, +2 Heat, forcing a Heat Check'}
            >
              Push
            </Button>
          )}
          <Button
            size="compact"
            style={GROW}
            onClick={controls.onApply}
            disabled={controls.applyDisabled}
            title="Commit this result"
          >
            {controls.applyLabel}
          </Button>
        </div>

        <div className="su-dash-deck-controls">
          <Button variant="ghost" size="compact" onClick={controls.onClear}>
            Clear
          </Button>
        </div>

        {roll && (
          <div className="su-dash-deck-roll" data-band={roll.band}>
            <span className="su-dash-deck-d20">{roll.roll}</span>
            <div className="su-dash-deck-band">
              <strong>{roll.bandLabel}</strong>
              <span>{roll.bandSummary}</span>
            </div>
          </div>
        )}
        {view.pushLog && <p className="su-dash-deck-pushlog">{view.pushLog}</p>}
        {view.meltdown && (
          <div className="su-dash-deck-controls">
            <Button variant="danger" size="compact" style={GROW} onClick={view.meltdown.onConfirm}>
              Confirm Meltdown — Mark Mech destroyed
            </Button>
          </div>
        )}
        {view.applied && <p className="su-dash-deck-applied">Result applied ✓</p>}
        {view.applyRouted && (
          <p className="su-dash-deck-apply-route">
            Cascade Failure — a severe consequence. The Take-Damage control is open on the Mech's
            Major slot above; confirm the hit there. Nothing was auto-applied.
          </p>
        )}
      </div>
    </div>
  )
}

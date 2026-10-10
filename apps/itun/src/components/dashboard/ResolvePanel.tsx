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
import { Button, ReferenceEntityCard } from 'component-lib'
import { space } from 'component-lib/design/tokens'
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
      costLabel: string
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
         * before a roll and once this roll is pushed.
         */
        push?: { disabled: boolean; pushed: boolean; onPush: () => void }
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
        <fieldset className="pc-deck-cost-choice">
          {/*
           * Deliberately NATIVE radios, not the chrome `Radio` primitive.
           * That primitive is a self-framed choice-row card; here the two
           * options are compact inline `pc-deck-radio` labels inside the
           * already-bordered `pc-deck-cost-choice` fieldset, and the framed
           * primitive would turn the tight EP/AP pair into two bordered cards
           * nested in a bordered fieldset. Adopt only once `Radio` grows a
           * bare/instrument rung.
           */}
          <legend className="pc-deck-cost-choice-lab">Pay with</legend>
          <label className="pc-deck-radio">
            <input
              type="radio"
              name="pc-deck-currency"
              checked={currencyChoice.currency === 'EP'}
              disabled={currencyChoice.activated}
              onChange={() => currencyChoice.onCurrency('EP')}
            />
            {currencyChoice.epCost} EP
          </label>
          <label className="pc-deck-radio">
            <input
              type="radio"
              name="pc-deck-currency"
              checked={currencyChoice.currency === 'AP'}
              disabled={currencyChoice.activated || !currencyChoice.pilotAvailable}
              onChange={() => currencyChoice.onCurrency('AP')}
            />
            {currencyChoice.epCost} AP
          </label>
        </fieldset>
      )}

      {variableHot && (
        <div className="pc-deck-hotx">
          <span className="pc-deck-hotx-lab">Hot</span>
          <div className="pc-step">
            <Button
              size="compact"
              style={STEP}
              onClick={variableHot.onDec}
              disabled={variableHot.activated}
              aria-label="Decrease Hot"
            >
              −
            </Button>
            <span className="pc-step-num">{variableHot.hotX}</span>
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
          <span className={`pc-deck-hotx-proj${variableHot.over ? ' is-over' : ''}`}>
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
        <div className="pc-deck-empty">{view.text}</div>
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
    <div className="pc-display-scroll">
      <div className="pc-deck-panel">
        <div className="pc-deck-panel-head">
          <Button variant="ghost" size="compact" onClick={view.onBack}>
            ◀ Back
          </Button>
          <span className="pc-deck-cost">{view.costLabel}</span>
        </div>

        {/* The cost pennant IS the Activate button (ruleset §1, board E3): the
            same size, shape and place as the read pennant, filled rust, inside
            a 44px hit area — there is no separate deck button. The Dashboard
            stays flat, so no speckle. */}
        <ReferenceEntityCard
          data={view.entity}
          texture={false}
          controls={[
            {
              key: 'activate',
              pennant: true,
              label: controls.activateLabel,
              onClick: controls.onActivate,
              disabled: controls.activateDisabled,
              title: controls.activateTitle,
            },
          ]}
        />

        <ResolveCost currencyChoice={currencyChoice} variableHot={variableHot} />

        <div className="pc-deck-controls">
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
              title="Reroll the d20, +2 Heat, forcing a Heat Check"
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

        <div className="pc-deck-controls">
          <Button variant="ghost" size="compact" onClick={controls.onClear}>
            Clear
          </Button>
        </div>

        {roll && (
          <div className="pc-deck-roll" data-band={roll.band}>
            <span className="pc-deck-d20">{roll.roll}</span>
            <div className="pc-deck-band">
              <strong>{roll.bandLabel}</strong>
              <span>{roll.bandSummary}</span>
            </div>
          </div>
        )}
        {view.pushLog && <p className="pc-deck-pushlog">{view.pushLog}</p>}
        {view.meltdown && (
          <div className="pc-deck-controls">
            <Button variant="danger" size="compact" style={GROW} onClick={view.meltdown.onConfirm}>
              Confirm Meltdown — Mark Mech Destroyed
            </Button>
          </div>
        )}
        {view.applied && <p className="pc-deck-applied">Result applied ✓</p>}
        {view.applyRouted && (
          <p className="pc-deck-apply-route">
            Cascade Failure — a severe consequence. The Take-Damage control is open on the Mech's
            Major slot above; confirm the hit there. Nothing was auto-applied.
          </p>
        )}
      </div>
    </div>
  )
}

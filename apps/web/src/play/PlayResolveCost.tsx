/**
 * The resolve's two cost readouts (play.md §5), drawn inside an action Row by
 * `PlayResolveSteps`: what activating spends (`ResolveSpend`), and what it
 * asks before it is paid (`ResolveCost`: EP or AP, and X for a variable Hot).
 * Presentational: `useActionsDeck` builds the `ResolveModel` and owns every
 * write.
 */

import type { CSSProperties } from 'react'
import { ActivationCost, Button, cn, FOCUS_RING, Stat } from '../components/index'
import { color, font, fontSize, space, weight } from '../design/tokens'
import type { ResolveModel } from './useActionsDeck'

const STEP = { minWidth: 0, paddingInline: space[8] } satisfies CSSProperties

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
 * action, and X for a variable Hot.
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
              className={FOCUS_RING}
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
              className={FOCUS_RING}
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
            className={cn(
              'su-dash-deck-hotx-proj',
              variableHot.over && 'su-dash-deck-hotx-proj--over'
            )}
          >
            {variableHot.projText}
          </span>
        </div>
      )}
    </>
  )
}

/**
 * The resolve's two cost readouts (play.md §5), drawn inside an action Row by
 * `PlayResolveSteps`: what activating spends (`ResolveSpend`), and what it
 * asks before it is paid (`ResolveCost`: EP or AP, and X for a variable Hot).
 * Presentational: `useActionsDeck` builds the `ResolveModel` and owns every
 * write.
 */

import type { CSSProperties } from 'react'
import { capsLabel } from '../components/atoms/capsLabel'
import { ActivationCost, cn, Radio, Stat } from '../components/index'
import { color, font, fontSize, space, weight } from '../design/tokens'
import type { ResolveModel } from './useActionsDeck'

const CHOICE_LABEL = cn('su-dash-deck-cost-choice-lab', capsLabel())

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
          {/* One choice, the one `Radio` (hard rule R15): `bare`, as the
              fieldset already frames the pair. */}
          <legend className={CHOICE_LABEL}>Pay with</legend>
          <Radio
            bare
            label={`${currencyChoice.epCost} EP`}
            name="su-dash-deck-currency"
            checked={currencyChoice.currency === 'EP'}
            disabled={currencyChoice.activated}
            onChange={() => currencyChoice.onCurrency('EP')}
          />
          <Radio
            bare
            label={`${currencyChoice.epCost} AP`}
            name="su-dash-deck-currency"
            checked={currencyChoice.currency === 'AP'}
            disabled={currencyChoice.activated || !currencyChoice.pilotAvailable}
            onChange={() => currencyChoice.onCurrency('AP')}
          />
        </fieldset>
      )}

      {variableHot && (
        <div className="su-dash-deck-hotx">
          {/* The sheet's own stepper (`Stat` in Edit): X's cell and its − / +. */}
          <Stat
            label="Hot"
            value={variableHot.hotX}
            size="compact"
            min={1}
            mode={variableHot.activated ? 'read' : 'edit'}
            onChange={(next) => (next > variableHot.hotX ? variableHot.onInc : variableHot.onDec)()}
          />
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

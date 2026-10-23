/**
 * The resolve's two cost readouts (play.md §5), drawn inside an action Mini by
 * `PlayResolveSteps`: what activating spends (`ResolveSpend`), and what it
 * asks before it is paid (`ResolveCost`: EP or AP, and X for a variable Hot).
 * Presentational: `useActionsDeck` builds the `ResolveModel` and owns every
 * write.
 */

import type { CSSProperties } from 'react'
import { capsLabel } from '../components/atoms/capsLabel'
import { ActivationCost, cn, Radio, Stat } from '../components/index'
import { color, font, fontSize, space, weight } from '../design/tokens'
import { playCopy } from '../messages/play'
import type { ResolveModel } from './useActionsDeck'

const CHOICE_LABEL = cn('su-play-deck-cost-choice-lab', capsLabel())

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
  color: color.wkMuted, // design-tokens-ignore: a condensed label
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
    return <span style={NO_COST}>{playCopy('noCost')}</span>
  }
  return (
    <span style={SPEND}>
      {cost.heat > 0 && <Stat size="compact" label={playCopy('heat')} value={`+${cost.heat}`} />}
      {cost.uses > 0 && <Stat size="compact" label={playCopy('uses')} value={cost.uses} />}
      {cost.amount > 0 && <ActivationCost cost={cost.amount} currency={currency} size="compact" />}
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
        <fieldset className="su-play-deck-cost-choice">
          {/* One choice, the one `Radio` (hard rule R15): `bare`, as the
              fieldset already frames the pair. */}
          <legend className={CHOICE_LABEL}>{playCopy('payWith')}</legend>
          <Radio
            bare
            label={playCopy('ep', { epCost: currencyChoice.epCost })}
            name="su-play-deck-currency"
            checked={currencyChoice.currency === 'EP'}
            disabled={currencyChoice.activated}
            onChange={() => currencyChoice.onCurrency('EP')}
          />
          <Radio
            bare
            label={playCopy('ap', { epCost: currencyChoice.epCost })}
            name="su-play-deck-currency"
            checked={currencyChoice.currency === 'AP'}
            disabled={currencyChoice.activated || !currencyChoice.pilotAvailable}
            onChange={() => currencyChoice.onCurrency('AP')}
          />
        </fieldset>
      )}

      {variableHot && (
        <div className="su-play-deck-hotx">
          {/* The sheet's own stepper (`Stat` in Edit): X's cell and its − / +. */}
          <Stat
            label={playCopy('hot')}
            value={variableHot.hotX}
            size="compact"
            min={1}
            mode={variableHot.activated ? 'read' : 'edit'}
            onChange={(next) => (next > variableHot.hotX ? variableHot.onInc : variableHot.onDec)()}
          />
          <span
            className={cn(
              'su-play-deck-hotx-proj',
              variableHot.over && 'su-play-deck-hotx-proj--over'
            )}
          >
            {variableHot.projText}
          </span>
        </div>
      )}
    </>
  )
}

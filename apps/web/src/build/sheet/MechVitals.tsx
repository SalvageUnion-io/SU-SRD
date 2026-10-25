import type { UnitsStore } from '../../replica/units'
/**
 * MechVitals — the mech sheet's vitals, its opening's right column
 * (`SheetHero`'s `vitals`): SP, EP and Heat as `SheetVitalGauge`s named from
 * the one vitals map, each max overridable in Edit with its provenance, then
 * Conditions (Read prints them only when there is one; Edit writes them in
 * `MechConditionsEditor`).
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { pinFor, unifiedMechConditions } from 'salvageunion-reference/rules'
import { Conditions, Eyebrow, heatDangerFrom, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import { MechConditionsEditor } from './MechConditionsEditor'
import type { MechSheetModel } from './mechSheet.model'
import type { useMechSheetActions } from './mechSheetActions.model'
import { SheetVitalGauge } from './SheetVitalGauge'

const CONDITIONS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  width: '100%',
} satisfies CSSProperties

type MechVitalsProps = {
  mech: Mech
  model: MechSheetModel
  actions: ReturnType<typeof useMechSheetActions>
  readOnly: boolean
  store: UnitsStore
}

export function MechVitals({ mech, model, actions, readOnly, store }: MechVitalsProps) {
  const { spParts, epParts, heatParts, maxSP, maxEP, heatCap } = model
  // The conditions Read prints: the same merged list the Edit chips write.
  const readConditions = readOnly ? unifiedMechConditions(mech) : []
  return (
    <>
      <SheetVitalGauge
        vital="sp"
        value={model.currentSP}
        max={maxSP}
        onChange={readOnly ? undefined : (v) => actions.patchMech({ currentSP: v })}
        onMaxChange={
          readOnly
            ? undefined
            : (next) => actions.overrideMechMax({ maxSpOverride: pinFor(next, spParts) })
        }
        breakdown={readOnly ? undefined : spParts}
        provenance={readOnly ? undefined : model.spLines}
        onRevertOverride={
          readOnly ? undefined : () => actions.overrideMechMax({ maxSpOverride: undefined })
        }
        readOnly={readOnly}
      />
      <SheetVitalGauge
        vital="ep"
        value={model.currentEP}
        max={maxEP}
        onChange={readOnly ? undefined : (v) => actions.patchMech({ currentEP: v })}
        onMaxChange={
          readOnly
            ? undefined
            : (next) => actions.overrideMechMax({ maxEpOverride: pinFor(next, epParts) })
        }
        breakdown={readOnly ? undefined : epParts}
        provenance={readOnly ? undefined : model.epLines}
        onRevertOverride={
          readOnly ? undefined : () => actions.overrideMechMax({ maxEpOverride: undefined })
        }
        readOnly={readOnly}
      />
      <SheetVitalGauge
        vital="heat"
        value={model.currentHeat}
        max={heatCap}
        danger={heatCap > 0 ? heatDangerFrom(heatCap) : undefined}
        onChange={readOnly ? undefined : (v) => actions.patchMech({ currentHeat: v })}
        onMaxChange={
          readOnly
            ? undefined
            : (next) => actions.overrideMechMax({ maxHeatOverride: pinFor(next, heatParts) })
        }
        breakdown={readOnly ? undefined : heatParts}
        provenance={readOnly ? undefined : model.heatLines}
        onRevertOverride={
          readOnly ? undefined : () => actions.overrideMechMax({ maxHeatOverride: undefined })
        }
        readOnly={readOnly}
      />
      {/* Read leaves an empty field out and draws no control: Conditions
          prints as chips only when there is one to read. */}
      {(!readOnly || readConditions.length > 0) && (
        <div style={CONDITIONS}>
          <Eyebrow tone="toneDeep">{buildSheetCopy('conditions')}</Eyebrow>
          {readOnly ? (
            <Conditions conditions={readConditions} />
          ) : (
            <MechConditionsEditor mech={mech} store={store} />
          )}
        </div>
      )}
    </>
  )
}

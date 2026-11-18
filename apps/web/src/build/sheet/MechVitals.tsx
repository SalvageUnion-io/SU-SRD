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
import { pinFor } from 'salvageunion-reference/rules'
import { Conditions, Eyebrow, heatDangerFrom, PhoneVitals, tokens } from '../../components/index'
import { changeUndoToast } from '../../lib/changeUndoToast'
import { buildSheetCopy } from '../../messages/build-sheet'
import { MechConditionsEditor } from './MechConditionsEditor'
import type { MechSheetModel } from './mechSheet.model'
import type { useMechSheetActions } from './mechSheetActions.model'
import { SheetVitalGauge } from './SheetVitalGauge'
import { SHEET_VITALS } from './sheetVitals.model'

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
  /**
   * MOCK (Working Manual D, principle 2): the viewer may write the sheet, so
   * in Read the three gauges keep their value live: − / + steppers
   * (`VitalGauge`'s `steppers`: under the track; the Compact Size from `sm`,
   * `.su-sheet-vitals`), each change said with Undo. Edit keeps the
   * maxima and their provenance.
   */
  live?: boolean
  /** MOCK (wave 2): a phone in Read draws the vitals as `PhoneVitals`, one row a number. */
  phone?: boolean
}

export function MechVitals({
  mech,
  model,
  actions,
  readOnly,
  store,
  live = false,
  phone = false,
}: MechVitalsProps) {
  // MOCK: session state writes in Read too, and every change shows its line with Undo.
  const writes = !readOnly || live
  const change = (field: 'currentSP' | 'currentEP' | 'currentHeat', label: string, from: number) =>
    writes
      ? (next: number) => {
          actions.patchMech({ [field]: next })
          changeUndoToast({
            id: `mech:${mech.id}:${field}`,
            label,
            from,
            to: next,
            undo: (value) => actions.patchMech({ [field]: value }),
          })
        }
      : undefined
  const { spParts, epParts, heatParts, maxSP, maxEP, heatCap } = model
  // The conditions Read prints: the same list the Edit chips write.
  const readConditions = readOnly ? mech.conditions : []
  // MOCK (wave 2): the phone's block. Names come from the one vitals map (R11).
  if (phone)
    return (
      <PhoneVitals
        label={`${mech.name} vitals`}
        vitals={[
          {
            key: 'sp',
            label: SHEET_VITALS.sp.short,
            name: SHEET_VITALS.sp.label,
            value: model.currentSP,
            max: maxSP,
            onChange: change('currentSP', 'SP', model.currentSP),
          },
          {
            key: 'ep',
            label: SHEET_VITALS.ep.short,
            name: SHEET_VITALS.ep.label,
            value: model.currentEP,
            max: maxEP,
            onChange: change('currentEP', 'EP', model.currentEP),
          },
          {
            key: 'heat',
            label: SHEET_VITALS.heat.short,
            name: SHEET_VITALS.heat.label,
            value: model.currentHeat,
            max: heatCap,
            danger: heatCap > 0 ? heatDangerFrom(heatCap) : undefined,
            onChange: change('currentHeat', 'Heat', model.currentHeat),
          },
        ]}
        foot={readConditions.length > 0 ? <Conditions conditions={readConditions} /> : undefined}
      />
    )
  return (
    <>
      <SheetVitalGauge
        vital="sp"
        value={model.currentSP}
        max={maxSP}
        onChange={change('currentSP', 'SP', model.currentSP)}
        steppers={writes}
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
        readOnly={!writes}
      />
      <SheetVitalGauge
        vital="ep"
        value={model.currentEP}
        max={maxEP}
        onChange={change('currentEP', 'EP', model.currentEP)}
        steppers={writes}
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
        readOnly={!writes}
      />
      <SheetVitalGauge
        vital="heat"
        value={model.currentHeat}
        max={heatCap}
        danger={heatCap > 0 ? heatDangerFrom(heatCap) : undefined}
        onChange={change('currentHeat', 'Heat', model.currentHeat)}
        steppers={writes}
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
        readOnly={!writes}
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

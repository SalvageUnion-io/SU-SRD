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
import type { PhoneVital } from '../../components/index'
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
   * The viewer may write the sheet, so Read keeps the three vitals live
   * (R11, ruleset §1.2): the gauge's − / + at the track's end
   * (`VitalGauge`'s `steppers="end"`), each change one toast with Undo (K5).
   * Edit keeps the maxima and their provenance.
   */
  live?: boolean
  /** A phone in Read: the vitals as `PhoneVitals`, one row a number (ruleset §2.1). */
  phone?: boolean
}

/**
 * A mech's three vitals as rows (SP, EP, Heat), named from the one vitals map
 * (R11) and written with one Undo toast a change (K5): what a phone's block
 * and the sheet's header strip both draw.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: the rows the block draws, beside it
export function mechVitalRows({
  mech,
  model,
  actions,
  writes,
}: Pick<MechVitalsProps, 'mech' | 'model' | 'actions'> & { writes: boolean }): PhoneVital[] {
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
  const { maxSP, maxEP, heatCap } = model
  const sp = change('currentSP', SHEET_VITALS.sp.short, model.currentSP)
  const ep = change('currentEP', SHEET_VITALS.ep.short, model.currentEP)
  const heat = change('currentHeat', SHEET_VITALS.heat.short, model.currentHeat)
  return [
    {
      key: 'sp',
      label: SHEET_VITALS.sp.short,
      name: SHEET_VITALS.sp.label,
      value: model.currentSP,
      max: maxSP,
      ...(sp ? { onChange: sp } : {}),
    },
    {
      key: 'ep',
      label: SHEET_VITALS.ep.short,
      name: SHEET_VITALS.ep.label,
      value: model.currentEP,
      max: maxEP,
      ...(ep ? { onChange: ep } : {}),
    },
    {
      key: 'heat',
      label: SHEET_VITALS.heat.short,
      name: SHEET_VITALS.heat.label,
      value: model.currentHeat,
      max: heatCap,
      ...(heatCap > 0 ? { danger: heatDangerFrom(heatCap) } : {}),
      ...(heat ? { onChange: heat } : {}),
    },
  ]
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
  // Session state writes in Read too, and every change shows its line with Undo.
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
  // The phone's block. Names come from the one vitals map (R11).
  if (phone)
    return (
      <PhoneVitals
        label={buildSheetCopy('unitVitals', { name: mech.name })}
        vitals={mechVitalRows({ mech, model, actions, writes })}
        foot={readConditions.length > 0 ? <Conditions conditions={readConditions} /> : undefined}
      />
    )
  return (
    <>
      <SheetVitalGauge
        vital="sp"
        value={model.currentSP}
        max={maxSP}
        onChange={change('currentSP', SHEET_VITALS.sp.short, model.currentSP)}
        steppers={writes ? 'end' : false}
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
        onChange={change('currentEP', SHEET_VITALS.ep.short, model.currentEP)}
        steppers={writes ? 'end' : false}
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
        onChange={change('currentHeat', SHEET_VITALS.heat.short, model.currentHeat)}
        steppers={writes ? 'end' : false}
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

/**
 * PilotVitals — a pilot's vitals on the Live Sheet: HP and AP, named from the
 * one vitals map (R11), Training Points (a counter, no gauge: ruleset §2.1),
 * Conditions and, in Read, the class as its header-only Mini (R49).
 *
 * Session state steps in Read for whoever may write the sheet (`live`; R11,
 * ruleset §1.2): HP, AP and Training Points, each change one toast with Undo
 * (K5). Edit keeps the maxima, their provenance and the Conditions editor.
 *
 * A phone in Read draws them as `PhoneVitals` (`phone`, ruleset §2.1), one
 * row a number; from 40rem and in Edit, the gauges (`SheetVitalGauge`).
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { pinFor } from 'salvageunion-reference/rules'
import { Conditions, PhoneVitals } from '../../components/app'
import { Entity } from '../../components/entity/Entity'
import type { PhoneVital } from '../../components/index'
import { Eyebrow, Stat, tokens } from '../../components/index'
import { changeUndoToast } from '../../lib/changeUndoToast'
import { resolveClass } from '../../lib/classRef'
import { buildSheetCopy } from '../../messages/build-sheet'
import { ChipListEditor } from './ChipListEditor'
import { CONDITION_DRAFT } from './chipWell.model'
import type { PilotSheetModel } from './pilotSheet.model'
import type { PilotSheetActions } from './pilotSheetActions.model'
import { SheetVitalGauge } from './SheetVitalGauge'
import { SHEET_VITALS } from './sheetVitals.model'

const MIN_W_0 = { minWidth: 0 } satisfies CSSProperties

/** The Conditions label's place over the chip row. */
const CONDITIONS_LABEL = { display: 'block', marginBottom: tokens.space[8] } satisfies CSSProperties

/** TP under the AP gauge: the vitals' own row, no rule between them. */
const TP_ROW = {
  borderTopWidth: 0,
  display: 'flex',
  marginTop: tokens.space[8],
  paddingTop: 0,
} satisfies CSSProperties

/** Training Points, as its phone row and its Undo line say it. */
const TP = 'TP'

/**
 * Training Points, straight under the AP gauge. A counter, not a gauge
 * (ruleset §2.1: no cap, no track): the label-first chip (`TRAINING POINTS |
 * 3`), with the +/- steppers while the sheet writes it, as every stat reads.
 */
function TpBlock({
  value,
  onChange,
  editable,
}: {
  value: number
  onChange?: ((next: number) => void) | undefined
  editable: boolean
}) {
  return (
    <Stat
      label={buildSheetCopy('trainingPoints')}
      value={value}
      mode={editable ? 'edit' : 'read'}
      onChange={editable ? onChange : undefined}
    />
  )
}

type PilotVitalsProps = {
  pilot: Pilot
  model: PilotSheetModel
  actions: PilotSheetActions
  readOnly: boolean
  /** The viewer may write the sheet, so Read keeps HP and AP live, and a phone's Training Points row (R11). */
  live?: boolean
  /** A phone in Read: the vitals as `PhoneVitals`, one row a number. */
  phone?: boolean
}

/**
 * A pilot's numbers as rows (HP, AP, then Training Points, a counter), named
 * from the one vitals map (R11) and written with one Undo toast a change
 * (K5): what a phone's block and the sheet's header strip both draw.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: the rows the block draws, beside it
export function pilotVitalRows({
  pilot,
  model,
  actions,
  writes,
}: Pick<PilotVitalsProps, 'pilot' | 'model' | 'actions'> & { writes: boolean }): PhoneVital[] {
  const change = (
    field: 'currentHP' | 'currentAP' | 'trainingPoints',
    label: string,
    from: number
  ) =>
    writes
      ? (next: number) => {
          actions.patchPilot({ [field]: next })
          changeUndoToast({
            id: `pilot:${pilot.id}:${field}`,
            label,
            from,
            to: next,
            undo: (value) => actions.patchPilot({ [field]: value }),
          })
        }
      : undefined
  const { maxHP, maxAP, hp, ap, tp } = model
  const onHp = change('currentHP', SHEET_VITALS.hp.short, hp)
  const onAp = change('currentAP', SHEET_VITALS.ap.short, ap)
  const onTp = change('trainingPoints', TP, tp)
  return [
    {
      key: 'hp',
      label: SHEET_VITALS.hp.short,
      name: SHEET_VITALS.hp.label,
      value: hp,
      max: maxHP,
      ...(onHp ? { onChange: onHp } : {}),
    },
    {
      key: 'ap',
      label: SHEET_VITALS.ap.short,
      name: SHEET_VITALS.ap.label,
      value: ap,
      max: maxAP,
      ...(onAp ? { onChange: onAp } : {}),
    },
    {
      key: 'tp',
      label: TP,
      name: buildSheetCopy('trainingPoints'),
      note: buildSheetCopy('trainingPoints'),
      value: tp,
      ...(onTp ? { onChange: onTp } : {}),
    },
  ]
}

export function PilotVitals({
  pilot,
  model,
  actions,
  readOnly,
  live = false,
  phone = false,
}: PilotVitalsProps) {
  const { hpParts, apParts, maxHP, maxAP, hp, ap, tp } = model
  // Session state writes in Read too, and every change shows its line with Undo.
  const writes = !readOnly || live
  const change = (
    field: 'currentHP' | 'currentAP' | 'trainingPoints',
    label: string,
    from: number
  ) =>
    writes
      ? (next: number) => {
          actions.patchPilot({ [field]: next })
          changeUndoToast({
            id: `pilot:${pilot.id}:${field}`,
            label,
            from,
            to: next,
            undo: (value) => actions.patchPilot({ [field]: value }),
          })
        }
      : undefined
  if (phone)
    return (
      <PhoneVitals
        label={buildSheetCopy('unitVitals', { name: pilot.name })}
        vitals={pilotVitalRows({ pilot, model, actions, writes })}
        foot={
          pilot.conditions.length > 0 ? (
            <Conditions conditions={[...pilot.conditions]} />
          ) : undefined
        }
      />
    )
  const pilotClass = resolveClass(pilot.classRef)
  return (
    <>
      <SheetVitalGauge
        vital="hp"
        value={hp}
        max={maxHP}
        onChange={change('currentHP', SHEET_VITALS.hp.short, hp)}
        steppers={writes ? 'end' : false}
        onMaxChange={
          readOnly
            ? undefined
            : (next) => actions.overridePilotMax({ maxHpOverride: pinFor(next, hpParts) })
        }
        breakdown={readOnly ? undefined : hpParts}
        provenance={readOnly ? undefined : model.hpLines}
        onRevertOverride={
          readOnly ? undefined : () => actions.overridePilotMax({ maxHpOverride: undefined })
        }
        readOnly={!writes}
      />
      <SheetVitalGauge
        vital="ap"
        value={ap}
        max={maxAP}
        onChange={change('currentAP', SHEET_VITALS.ap.short, ap)}
        steppers={writes ? 'end' : false}
        onMaxChange={
          readOnly
            ? undefined
            : (next) => actions.overridePilotMax({ maxApOverride: pinFor(next, apParts) })
        }
        breakdown={readOnly ? undefined : apParts}
        provenance={readOnly ? undefined : model.apLines}
        onRevertOverride={
          readOnly ? undefined : () => actions.overridePilotMax({ maxApOverride: undefined })
        }
        readOnly={!writes}
      />
      {/* TP stands right under AP, in the same row of the vitals. */}
      <div style={TP_ROW}>
        <TpBlock
          value={tp}
          onChange={readOnly ? undefined : change('trainingPoints', TP, tp)}
          editable={!readOnly}
        />
      </div>
      {/* Read leaves an empty field out: Conditions prints only
        when there is one to read. */}
      {readOnly ? (
        pilot.conditions.length > 0 && (
          <div style={MIN_W_0}>
            <Eyebrow tone="toneDeep" style={CONDITIONS_LABEL}>
              {buildSheetCopy('conditions')}
            </Eyebrow>
            <Conditions conditions={[...pilot.conditions]} />
          </div>
        )
      ) : (
        <div style={MIN_W_0}>
          <Eyebrow tone="toneDeep" style={CONDITIONS_LABEL}>
            {buildSheetCopy('conditions')}
          </Eyebrow>
          <ChipListEditor
            items={pilot.conditions}
            onChange={actions.handleConditionsChange}
            noun="condition"
            draftWidth={CONDITION_DRAFT}
            unique
          />
        </div>
      )}
      {/* The class, its header-only Mini under the stats, linking to
        its Page (R49). */}
      {/* Read only: in Edit the R57 row is the class. */}
      {pilotClass && readOnly && (
        <div style={MIN_W_0}>
          <Entity size="mini" context="browse" entity={pilotClass} mode={{ kind: 'link' }} />
        </div>
      )}
    </>
  )
}

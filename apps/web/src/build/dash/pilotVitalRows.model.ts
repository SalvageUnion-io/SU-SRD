/**
 * A pilot's vitals as the dashboard's masthead rows (`PilotDash`).
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import { pinFor } from 'salvageunion-reference/rules'
import type { PhoneVital } from '../../components/index'
import { changeUndoToast } from '../../lib/changeUndoToast'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { PilotSheetModel } from '../sheet/pilotSheet.model'
import type { PilotSheetActions } from '../sheet/pilotSheetActions.model'
import { SHEET_VITALS } from '../sheet/sheetVitals.model'

/** Training Points, as its row and its Undo line say it. */
const TP = 'TP'

/**
 * A pilot's numbers as rows (HP, AP, then Training Points, a counter), named
 * from the one vitals map (R11) and written with one Undo toast a change
 * (K5); in Edit each max is a field, with where it comes from (ruleset §2.1).
 */
export function pilotVitalRows({
  pilot,
  model,
  actions,
  writes,
  edit = false,
}: {
  pilot: Pilot
  model: PilotSheetModel
  actions: PilotSheetActions
  writes: boolean
  edit?: boolean
}): PhoneVital[] {
  const change = (
    field: 'currentHP' | 'currentAP' | 'trainingPoints',
    label: string,
    from: number
  ) =>
    writes
      ? (next: number) => {
          actions.patchPilot({ [field]: next })
          changeUndo(pilot, field, label, from, next, actions)
        }
      : undefined
  const { maxHP, maxAP, hp, ap, tp, hpParts, apParts } = model
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
      ...(edit
        ? {
            maxEdit: {
              onMaxChange: (next: number) =>
                actions.overridePilotMax({ maxHpOverride: pinFor(next, hpParts) }),
              breakdown: hpParts,
              provenance: model.hpLines,
              onRevertOverride: () => actions.overridePilotMax({ maxHpOverride: undefined }),
            },
          }
        : {}),
    },
    {
      key: 'ap',
      label: SHEET_VITALS.ap.short,
      name: SHEET_VITALS.ap.label,
      value: ap,
      max: maxAP,
      ...(onAp ? { onChange: onAp } : {}),
      ...(edit
        ? {
            maxEdit: {
              onMaxChange: (next: number) =>
                actions.overridePilotMax({ maxApOverride: pinFor(next, apParts) }),
              breakdown: apParts,
              provenance: model.apLines,
              onRevertOverride: () => actions.overridePilotMax({ maxApOverride: undefined }),
            },
          }
        : {}),
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

/** One change of a number, one line with Undo (K5). */
function changeUndo(
  pilot: Pilot,
  field: 'currentHP' | 'currentAP' | 'trainingPoints',
  label: string,
  from: number,
  to: number,
  actions: PilotSheetActions
) {
  changeUndoToast({
    id: `pilot:${pilot.id}:${field}`,
    label,
    from,
    to,
    undo: (value) => actions.patchPilot({ [field]: value }),
    sheet: { id: pilot.id, field },
  })
}

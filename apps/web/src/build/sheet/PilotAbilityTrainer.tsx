/**
 * PilotAbilityTrainer — the pilot sheet's Manage Abilities, opened on its own:
 * the sheet's picker, model and writes (`PilotSheetPickers`,
 * `pilotSheet.model.ts`, `pilotSheetActions.model.ts`) with no sheet under
 * them. Play's Downtime action "Spend TP" opens it (play.md §6), so Training
 * Points are spent where the step earned them; the edit is still the Build
 * sheet's, its rule-break line and Undo included.
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { UnitsStore } from '../../replica/units'
import { useUnits } from '../../replica/units'
import { PilotSheetPickers } from './PilotSheetPickers'
import { usePilotSheetModel } from './pilotSheet.model'
import { usePilotSheetActions } from './pilotSheetActions.model'

export function PilotAbilityTrainer({
  pilot,
  onClose,
  store = useUnits,
}: {
  pilot: Pilot
  onClose: () => void
  /** Injectable store, as `PilotSheet`'s. */
  store?: UnitsStore
}) {
  const storeState = store()
  const fresh = storeState.get('pilot', pilot.id) ?? pilot
  const model = usePilotSheetModel({ pilot: fresh, storeState, picker: 'abilities' })
  const actions = usePilotSheetActions({
    pilot: fresh,
    store,
    storeState,
    crawlerTechLevel: model.effectiveCrawlerLevel,
  })
  return (
    <PilotSheetPickers
      picker="abilities"
      onClose={onClose}
      pilot={fresh}
      model={model}
      actions={actions}
      store={store}
    />
  )
}

/**
 * PilotSheetPickers — the pilot sheet's ONE shared picker modal: abilities and
 * equipment "Manage" both open it (the multi-select grids write through on
 * toggle; no Save button). Always available in Edit: Free Edit, not
 * rule-gated (ADR-021).
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { RefAbility } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { EntitySearcher } from '../../components/index'
import { abilityTrainingCost } from '../../lib/rules/training'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { PilotSheetModel } from './pilotSheet.model'
import type { PilotSheetActions } from './pilotSheetActions.model'
import { SheetPickerModal } from './SheetPickerModal'

export type PilotPicker = 'abilities' | 'equipment'

export function PilotSheetPickers({
  picker,
  onClose,
  pilot,
  model,
  actions,
}: {
  /** Which collection's picker is open. */
  picker: PilotPicker | null
  onClose: () => void
  pilot: Pilot
  model: PilotSheetModel
  actions: PilotSheetActions
}) {
  return (
    <>
      <SheetPickerModal
        open={picker === 'abilities'}
        onClose={onClose}
        title={buildSheetCopy('manageAbilities')}
        floating
      >
        <EntitySearcher
          schema="abilities"
          selected={pilot.abilities}
          onToggle={actions.toggleAbility}
          idOf={(item) => nameToSlug(item.name)}
          cost={(item) => {
            const slug = nameToSlug(item.name)
            const price = abilityTrainingCost(slug)
            if (price === null) return undefined
            const left = pilot.trainingPoints ?? 0
            return {
              label: buildSheetCopy('costsTp', { cost: price, left }),
              payLabel: buildSheetCopy('spendTpAndAdd', { cost: price }),
              canPay: left >= price,
              onPay: () => actions.trainAbility(slug),
            }
          }}
          filter={
            model.abilityTrees
              ? (item) => model.abilityTrees?.has((item as RefAbility).tree) ?? false
              : undefined
          }
          facets={{
            category: { label: buildSheetCopy('tree'), of: (item) => (item as RefAbility).tree },
          }}
          railName={pilot.name}
          chosenLabel={buildSheetCopy('learned')}
          emptyMessage={buildSheetCopy('noAbilitiesMatchThoseFilters')}
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'equipment'}
        onClose={onClose}
        title={buildSheetCopy('manageEquipment')}
        floating
      >
        <EntitySearcher
          schema="equipment"
          selected={pilot.equipment}
          onToggle={actions.toggleEquipment}
          idOf={(item) => nameToSlug(item.name)}
          railName={pilot.name}
          chosenLabel={buildSheetCopy('equipped')}
          emptyMessage={buildSheetCopy('noEquipmentMatchesThoseFilters')}
          budget={{
            label: buildSheetCopy('inventorySlots'),
            used: model.slotsUsed,
            max: model.slotsCap,
          }}
        />
      </SheetPickerModal>
    </>
  )
}

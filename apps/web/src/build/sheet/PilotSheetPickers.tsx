/**
 * PilotSheetPickers — the pilot sheet's ONE shared picker modal: abilities and
 * equipment "Manage" both open it (the multi-select grids write through on
 * toggle; no Save button). Always available in Edit: Free Edit, not
 * rule-gated (ADR-021).
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import { useState } from 'react'
import type { RefAbility, RefMetaEntity } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { EntitySearcher } from '../../components/index'
import { isPartnerEquipment } from '../../lib/rules/partnerGrants'
import { resolveEquipment } from '../../lib/rules/pilotInventory'
import { abilityTrainingCost } from '../../lib/rules/training'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'
import type { PilotSheetModel } from './pilotSheet.model'
import type { PilotSheetActions } from './pilotSheetActions.model'
import { EquipmentChoiceDialog } from './rowControls'
import { SheetPickerModal } from './SheetPickerModal'

export type PilotPicker = 'abilities' | 'equipment'

export function PilotSheetPickers({
  picker,
  onClose,
  pilot,
  model,
  actions,
  store,
}: {
  /** Which collection's picker is open. */
  picker: PilotPicker | null
  onClose: () => void
  pilot: Pilot
  model: PilotSheetModel
  actions: PilotSheetActions
  /** Where an added item's choice is saved (`Pilot.equipmentChoices`). */
  store: UnitsStore
}) {
  // Equipment that asks a choice asks it as it is added, as a mech's Systems
  // do: its Page opens over the picker (hidden meanwhile, so two dialogs never
  // share the focus trap), and closing it returns to the picker.
  const [asking, setAsking] = useState<string | null>(null)
  const askingEntity = asking ? resolveEquipment(asking) : undefined
  function toggleEquipment(slug: string) {
    const adding = !pilot.equipment.includes(slug)
    actions.toggleEquipment(slug)
    if (adding && asksAChoice(slug) && !pilot.equipmentChoices?.[slug]) setAsking(slug)
  }
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
        open={picker === 'equipment' && !asking}
        onClose={onClose}
        title={buildSheetCopy('manageEquipment')}
        floating
      >
        <EntitySearcher
          schema="equipment"
          selected={pilot.equipment}
          onToggle={toggleEquipment}
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
      {asking && askingEntity && (
        <EquipmentChoiceDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(null)
          }}
          slug={asking}
          equipment={askingEntity as RefMetaEntity & { name: string }}
          pilotId={pilot.id}
          seed={pilot.equipmentChoices?.[asking]}
          scalingParent={model.scalingParent}
          store={store}
        />
      )}
    </>
  )
}

/**
 * Whether the equipment asks a choice the pilot keeps (its own `choices`). A
 * drone or companion it grants is set up on its own card (ADR-028).
 */
function asksAChoice(slug: string): boolean {
  const entity = resolveEquipment(slug)
  return (entity?.choices?.length ?? 0) > 0 && !isPartnerEquipment(slug)
}

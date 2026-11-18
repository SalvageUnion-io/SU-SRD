/**
 * MechSheetPickers — the mech sheet's ONE shared picker modal: Systems and
 * Modules "Manage" both open it (the install grid writes through on click; no
 * Save button). Always available in Edit: Free Edit, not rule-gated (ADR-021).
 */

import type { Mech } from 'game-domain/schemas/mech'
import { nameToSlug } from 'salvageunion-reference'
import { EntitySearcher } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { MechSheetModel } from './mechSheet.model'
import type { ItemKind, MechSheetActions } from './mechSheetActions.model'
import { overAsPrinted } from './mechSlots.model'
import { SheetPickerModal } from './SheetPickerModal'

export function MechSheetPickers({
  picker,
  onClose,
  mech,
  model,
  actions,
}: {
  /** Which collection's picker is open. */
  picker: ItemKind | null
  onClose: () => void
  mech: Mech
  model: MechSheetModel
  actions: MechSheetActions
}) {
  const { chassis, capacity, maxEP } = model
  return (
    <>
      <SheetPickerModal
        open={picker === 'system'}
        onClose={onClose}
        title={buildSheetCopy('addSystems')}
        floating
      >
        <EntitySearcher
          schema="systems"
          mode="count"
          selected={mech.systems}
          idOf={(item) => nameToSlug(item.name)}
          onAdd={(slug) => actions.addItem('system', slug)}
          onRemove={(index) => actions.removeItem('system', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel={buildSheetCopy('installed')}
          emptyMessage={buildSheetCopy('noSystemsMatchThoseFilters')}
          budget={[
            {
              label: overAsPrinted(
                capacity.systemSlotsUsed,
                capacity.systemSlotsMax,
                capacity.asPrinted
              )
                ? buildSheetCopy('systemSlotsAsPrinted')
                : buildSheetCopy('systemSlots'),
              used: capacity.systemSlotsUsed,
              max: capacity.systemSlotsMax,
            },
            { label: buildSheetCopy('energy'), used: model.currentEP, max: maxEP },
          ]}
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'module'}
        onClose={onClose}
        title={buildSheetCopy('addModules')}
        floating
      >
        <EntitySearcher
          schema="modules"
          mode="count"
          selected={mech.modules}
          idOf={(item) => nameToSlug(item.name)}
          onAdd={(slug) => actions.addItem('module', slug)}
          onRemove={(index) => actions.removeItem('module', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel={buildSheetCopy('installed')}
          emptyMessage={buildSheetCopy('noModulesMatchThoseFilters')}
          budget={[
            {
              label: overAsPrinted(
                capacity.moduleSlotsUsed,
                capacity.moduleSlotsMax,
                capacity.asPrinted
              )
                ? buildSheetCopy('moduleSlotsAsPrinted')
                : buildSheetCopy('moduleSlots'),
              used: capacity.moduleSlotsUsed,
              max: capacity.moduleSlotsMax,
            },
            { label: buildSheetCopy('energy'), used: model.currentEP, max: maxEP },
          ]}
        />
      </SheetPickerModal>
    </>
  )
}

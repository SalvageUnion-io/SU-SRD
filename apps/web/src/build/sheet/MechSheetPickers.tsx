/**
 * MechSheetPickers — the mech sheet's ONE shared picker modal: Systems and
 * Modules "Manage" both open it (the install grid writes through on click; no
 * Save button). Always available in Edit: Free Edit, not rule-gated (ADR-021).
 */

import type { Mech } from 'game-domain/schemas/mech'
import { useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { EntitySearcher } from '../../components/index'
import { resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { mechScrap } from '../../lib/rules/mechScrap'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'
import { choicesOf } from '../wizard/pickColumns'
import { MechItemChoiceDialog } from './MechItemDetails'
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
  store,
}: {
  /** Which collection's picker is open. */
  picker: ItemKind | null
  onClose: () => void
  mech: Mech
  model: MechSheetModel
  actions: MechSheetActions
  /** Where an added item's choice is saved (`Mech.itemChoices`). */
  store: UnitsStore
}) {
  // An item that asks a choice asks it as it is added: its Page opens over the
  // picker (hidden meanwhile, so two dialogs never share the focus trap), and
  // closing it returns to the picker.
  const [asking, setAsking] = useState<{ kind: ItemKind; slug: string } | null>(null)
  const askingEntity = asking
    ? asking.kind === 'system'
      ? resolveSystem(asking.slug)
      : resolveModule(asking.slug)
    : null
  function add(kind: ItemKind, slug: string) {
    actions.addItem(kind, slug)
    const entity = kind === 'system' ? resolveSystem(slug) : resolveModule(slug)
    if (entity && choicesOf(entity).length > 0 && !mech.itemChoices?.[slug]) {
      setAsking({ kind, slug })
    }
  }
  const { chassis, capacity, maxEP } = model
  // The pickers open on the mech's Tech Level; a lettered one (Bio) shows all.
  const chassisTl = model.chassisEntity?.techLevel
  const techLevel = typeof chassisTl === 'number' ? chassisTl : undefined
  // What the build is worth beside the slots (r3 F3), by Tech Level as the
  // sheet's tiles say it (r4 E10, E11): worth, never a cost the sheet charges.
  const worth = mechScrap(mech).byTechLevel.map(({ techLevel, scrap }) => ({
    label: buildSheetCopy('worthInScrap', { tl: techLevel }),
    used: scrap,
  }))
  return (
    <>
      <SheetPickerModal
        open={picker === 'system' && !asking}
        onClose={onClose}
        title={buildSheetCopy('manageSystems')}
        floating
      >
        <EntitySearcher
          schema="systems"
          mode="count"
          selected={mech.systems}
          idOf={(item) => nameToSlug(item.name)}
          techLevel={techLevel}
          onAdd={(slug) => add('system', slug)}
          onRemove={(index) => actions.removeItem('system', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel={buildSheetCopy('installed')}
          emptyMessage={buildSheetCopy('noSystemsMatchThoseFilters')}
          budget={[
            {
              label: overAsPrinted(
                capacity.systemSlotsUsed,
                capacity.systemSlotsMax,
                capacity.asPrinted,
                'systems'
              )
                ? buildSheetCopy('systemSlotsAsPrinted')
                : buildSheetCopy('systemSlots'),
              used: capacity.systemSlotsUsed,
              max: capacity.systemSlotsMax,
            },
            ...worth,
            { label: buildSheetCopy('energy'), used: model.currentEP, max: maxEP },
          ]}
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'module' && !asking}
        onClose={onClose}
        title={buildSheetCopy('manageModules')}
        floating
      >
        <EntitySearcher
          schema="modules"
          mode="count"
          selected={mech.modules}
          idOf={(item) => nameToSlug(item.name)}
          techLevel={techLevel}
          onAdd={(slug) => add('module', slug)}
          onRemove={(index) => actions.removeItem('module', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel={buildSheetCopy('installed')}
          emptyMessage={buildSheetCopy('noModulesMatchThoseFilters')}
          budget={[
            {
              label: overAsPrinted(
                capacity.moduleSlotsUsed,
                capacity.moduleSlotsMax,
                capacity.asPrinted,
                'modules'
              )
                ? buildSheetCopy('moduleSlotsAsPrinted')
                : buildSheetCopy('moduleSlots'),
              used: capacity.moduleSlotsUsed,
              max: capacity.moduleSlotsMax,
            },
            ...worth,
            { label: buildSheetCopy('energy'), used: model.currentEP, max: maxEP },
          ]}
        />
      </SheetPickerModal>
      {asking && askingEntity && (
        <MechItemChoiceDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(null)
          }}
          slug={asking.slug}
          entity={askingEntity}
          mechId={mech.id}
          seed={mech.itemChoices?.[asking.slug]}
          store={store}
        />
      )}
    </>
  )
}

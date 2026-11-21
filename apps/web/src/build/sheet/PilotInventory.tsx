/**
 * PilotInventory — what a pilot carries, on the Live Sheet.
 *
 *  - `PilotInventory`: the sidebar's Inventory section (ruleset §1.2), one
 *    item a line in Read and Edit alike: each piece of equipment a contentful
 *    Mini (its head, then its text), a generic entry its Mini; in Edit their
 *    controls ride the chip group (`SheetItemLine`), as a mech's Systems do.
 *    The slots' `SlotGrid` stands under them.
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { SlotGrid } from '../../components/app'
import { Button, EmptyState, SlabSection, tokens } from '../../components/index'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'
import { GenericEntryAdder, GenericEntryLine, PilotEquipmentItem } from './PilotSheetItems'
import type { PilotSheetModel } from './pilotSheet.model'
import { inventoryEmpty } from './pilotSheet.model'
import type { PilotSheetActions } from './pilotSheetActions.model'

/** The inventory's slots under its pills: the SlotGrid, set to the left. */
const SLOTS = { display: 'flex', marginTop: tokens.space[8] } satisfies CSSProperties

const ADDER_ROW = { marginTop: tokens.space[12] } satisfies CSSProperties

export function PilotInventory({
  pilot,
  model,
  actions,
  readOnly,
  store,
  onManage,
}: {
  pilot: Pilot
  model: PilotSheetModel
  actions: PilotSheetActions
  readOnly: boolean
  store: UnitsStore
  /** Open the equipment picker (Edit's "Manage"). */
  onManage: () => void
}) {
  const empty = inventoryEmpty(pilot, model)
  return (
    <SlabSection
      title={buildSheetCopy('inventory')}
      count={{
        label: buildSheetCopy('slots'),
        value: model.slotsUsed,
        max: model.slotsCap,
        state: model.overCapacity ? 'critical' : undefined,
      }}
      actions={
        readOnly ? undefined : (
          <Button size="compact" onClick={onManage}>
            {buildSheetCopy('manageEquipment')}
          </Button>
        )
      }
    >
      {empty ? (
        <EmptyState variant="quiet" body={buildSheetCopy('nothingCarried')} />
      ) : (
        // One item a line, in Read and Edit alike: each piece of
        // equipment a contentful Mini (its head, then its text), a
        // generic entry its Mini; in Edit their controls ride the
        // chip group (`SheetItemLine`), as a mech's Systems do.
        <ul
          aria-label={buildSheetCopy('sEquipment', { name: pilot.name })}
          data-sheet-carried=""
          className={readOnly ? 'su-entity-mini-list' : 'su-entity-mini-list su-sheet-items'}
        >
          {model.ordinaryEquipment.map((slug) => (
            <li key={slug}>
              <PilotEquipmentItem
                slug={slug}
                granted={model.granted.has(slug) || (pilot.abilities ?? []).includes(slug)}
                pilotId={pilot.id}
                seedSelections={pilot.equipmentChoices?.[slug]}
                condition={pilot.equipmentConditions?.[slug] ?? 'intact'}
                usesLeft={pilot.equipmentUses?.[slug]}
                onConditionChange={(itemSlug, next) => {
                  runWrite(() => actions.handleEquipmentConditionChange(itemSlug, next))
                }}
                onUsesChange={(itemSlug, next) => {
                  actions.handleUsesChange(itemSlug, next)
                }}
                onRemove={
                  readOnly || model.granted.has(slug)
                    ? undefined
                    : () => actions.toggleEquipment(slug)
                }
                readOnly={readOnly}
                scalingParent={model.scalingParent}
                store={store}
              />
            </li>
          ))}
          {model.genericInventory.map((entry, index) => (
            <li key={entry.id}>
              <GenericEntryLine
                entry={entry}
                readOnly={readOnly}
                onRemove={
                  readOnly
                    ? undefined
                    : () => {
                        actions.handleGenericInventoryChange(
                          model.genericInventory.filter((_, i) => i !== index)
                        )
                      }
                }
              />
            </li>
          ))}
        </ul>
      )}
      {!empty && (
        <div style={SLOTS}>
          <SlotGrid
            used={model.slotsUsed}
            cap={model.slotsCap}
            label={buildSheetCopy(
              model.overCapacity ? 'inventoryOverCapacity' : 'inventorySlotsFilled',
              { used: model.slotsUsed, cap: model.slotsCap }
            )}
            readOnly
          />
        </div>
      )}
      {!readOnly && (
        <div style={ADDER_ROW}>
          <GenericEntryAdder
            onAdd={(entry) => {
              actions.handleGenericInventoryChange([...model.genericInventory, entry])
            }}
          />
        </div>
      )}
    </SlabSection>
  )
}

/**
 * PilotEquipmentLoadout — the installed systems/modules loadout for a
 * drone/companion equipment carried by a pilot (Survey Drone, Mecha Companion,
 * Auto-Turret). These equipment entities carry their own systemSlots/moduleSlots,
 * so they host a real loadout the same way a mech does.
 *
 * Reuses the exact mech loadout stack — SheetSectionCard + SectionAddButton +
 * SheetPickerModal + EntitySearcher (mode="count") for editing, and MechItemCard
 * for each installed item (status cycle + uses stepper + repair + remove) —
 * writing through `pilot.equipmentLoadouts[slug]` via useEquipmentLoadout. There
 * is no crawler scrap pool in this surface, so repair uses the no-deduction path
 * (scrapPool=null); "using a system" (EP/heat) is a mech-sheet transaction and is
 * not offered here (uses stay hand-editable via the stepper).
 */

import { useState } from 'react'

import { useEquipmentLoadout } from '../shared/useEquipmentLoadout'
import type { EquipmentLoadout } from '../shared/useEquipmentLoadout'
import type { useEntityStore } from '../../stores/entityStore'
import { EntitySearcher } from 'component-lib'
import { EntityGrid, EntityGridRow } from 'component-lib'
import { MechItemCard } from './MechItemCard'
import { cycleCondition, resolveModule, resolveSystem } from './mechItemRules'
import { SectionAddButton, SheetPickerModal } from 'component-lib'
import { SheetSectionCard } from 'component-lib'

/** Read a numeric slot field off the drone-equipment entity, defaulting to 0. */
function slotMax(equipment: Record<string, unknown>, field: 'systemSlots' | 'moduleSlots'): number {
  const raw = equipment[field]
  return typeof raw === 'number' ? raw : 0
}

type Kind = 'system' | 'module'

type PilotEquipmentLoadoutProps = {
  /** Owning pilot id — the loadout persists under this entity. */
  pilotId: string
  /** Equipment slug as stored on the pilot. */
  slug: string
  /** Resolved drone-equipment entity (carries systemSlots/moduleSlots + name). */
  equipment: Record<string, unknown> & { name?: string }
  /** Persisted loadout for this equipment, from the canonical pilot prop. */
  seed: EquipmentLoadout | undefined
  readOnly: boolean
  /** Injectable store — forwarded to useEquipmentLoadout for tests. */
  store: typeof useEntityStore
}

export function PilotEquipmentLoadout({
  pilotId,
  slug,
  equipment,
  seed,
  readOnly,
  store,
}: PilotEquipmentLoadoutProps) {
  const [picker, setPicker] = useState<Kind | null>(null)
  const { loadout, addSystem, removeSystem, addModule, removeModule, setCondition, setUses } =
    useEquipmentLoadout(pilotId, slug, seed, store)

  const systemMax = slotMax(equipment, 'systemSlots')
  const moduleMax = slotMax(equipment, 'moduleSlots')
  const railName = equipment.name ?? 'Companion'

  function renderItems(kind: Kind, slugs: string[], onRemove: (index: number) => void) {
    if (slugs.length === 0) {
      return (
        <p className="font-body text-caption text-wk-muted">
          {kind === 'system' ? 'No systems installed.' : 'No modules installed.'}
        </p>
      )
    }
    const conditions = kind === 'system' ? loadout.systemConditions : loadout.moduleConditions
    return (
      <EntityGrid>
        {slugs.map((itemSlug, index) => {
          const condition = conditions?.[itemSlug] ?? 'intact'
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the same slug may be installed more than once; install order is stable
            <EntityGridRow key={`${itemSlug}-${index}`}>
              <MechItemCard
                slug={itemSlug}
                entity={kind === 'system' ? resolveSystem(itemSlug) : resolveModule(itemSlug)}
                condition={condition}
                usesRemaining={loadout.itemUses?.[itemSlug]}
                scrapPool={null}
                readOnly={readOnly}
                onStatusCycle={() => {
                  setCondition(kind, itemSlug, cycleCondition(condition))
                }}
                onUsesChange={(next) => {
                  setUses(itemSlug, next)
                }}
                onRepair={() => {
                  setCondition(kind, itemSlug, 'intact')
                }}
                onRemove={
                  readOnly
                    ? undefined
                    : () => {
                        onRemove(index)
                      }
                }
              />
            </EntityGridRow>
          )
        })}
      </EntityGrid>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {'systemSlots' in equipment && (
        <SheetSectionCard
          title="Systems"
          count={
            <span className="tabular-nums">
              {loadout.systems.length}/{systemMax} slots
            </span>
          }
          controls={
            readOnly ? undefined : (
              <SectionAddButton label="system" onClick={() => setPicker('system')} />
            )
          }
        >
          {renderItems('system', loadout.systems, removeSystem)}
        </SheetSectionCard>
      )}

      {'moduleSlots' in equipment && (
        <SheetSectionCard
          title="Modules"
          count={
            <span className="tabular-nums">
              {loadout.modules.length}/{moduleMax} slots
            </span>
          }
          controls={
            readOnly ? undefined : (
              <SectionAddButton label="module" onClick={() => setPicker('module')} />
            )
          }
        >
          {renderItems('module', loadout.modules, removeModule)}
        </SheetSectionCard>
      )}

      <SheetPickerModal
        open={picker === 'system'}
        onClose={() => setPicker(null)}
        title="Add Systems"
        floating
      >
        <EntitySearcher
          schema="systems"
          mode="count"
          selected={loadout.systems}
          onAdd={addSystem}
          onRemove={removeSystem}
          railName={railName}
          chosenLabel="Installed"
          emptyMessage="No systems match those filters."
          budget={[{ label: 'System Slots', used: loadout.systems.length, max: systemMax }]}
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'module'}
        onClose={() => setPicker(null)}
        title="Add Modules"
        floating
      >
        <EntitySearcher
          schema="modules"
          mode="count"
          selected={loadout.modules}
          onAdd={addModule}
          onRemove={removeModule}
          railName={railName}
          chosenLabel="Installed"
          emptyMessage="No modules match those filters."
          budget={[{ label: 'Module Slots', used: loadout.modules.length, max: moduleMax }]}
        />
      </SheetPickerModal>
    </div>
  )
}

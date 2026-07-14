/**
 * PilotEquipmentLoadout — the installed systems/modules loadout for a
 * drone/companion equipment carried by a pilot (Survey Drone, Mecha Companion,
 * Auto-Turret). These equipment entities carry their own systemSlots/moduleSlots,
 * so they host a real loadout the same way a mech does.
 *
 * Reuses the exact mech loadout stack — SheetSectionCard + SectionAddButton +
 * SheetPickerModal + EntitySearcher (mode="count") — writing through
 * `pilot.equipmentLoadouts[slug]` via useEquipmentLoadout. Installed items render
 * as compact ReferenceEntityDisplay cards with a remove control; per-item
 * condition/uses tracking is intentionally deferred for v1 (kept read-only),
 * unlike a mech's MechItemCard economy.
 */

import { useState } from 'react'

import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'

import type { useEntityStore } from '../../stores/entityStore'
import { useEquipmentLoadout } from '../shared/useEquipmentLoadout'
import type { EquipmentLoadout } from '../shared/useEquipmentLoadout'
import { EntitySearcher } from '../shared/EntitySearcher'
import { Ecflow, Erow } from './Erow'
import { resolveModule, resolveSystem } from './mechItemRules'
import {
  REMOVABLE_CARD_STYLE,
  SectionAddButton,
  SheetPickerModal,
  cardRemoveControls,
} from './SheetSection'
import { SheetSectionCard } from './SheetSectionCard'

const HIDE_CHOICES = { choices: true } as const

/** Read a numeric slot field off the drone-equipment entity, defaulting to 0. */
function slotMax(equipment: Record<string, unknown>, field: 'systemSlots' | 'moduleSlots'): number {
  const raw = equipment[field]
  return typeof raw === 'number' ? raw : 0
}

/** True when the resolved equipment is a loadout host (carries slot fields). */
// biome-ignore lint/style/useComponentExportOnlyModules: gate helper colocated with the loadout component it guards
export function isLoadoutHost(equipment: Record<string, unknown> | null): boolean {
  return !!equipment && ('systemSlots' in equipment || 'moduleSlots' in equipment)
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
  const { loadout, addSystem, removeSystem, addModule, removeModule } = useEquipmentLoadout(
    pilotId,
    slug,
    seed,
    store
  )

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
    return (
      <Ecflow>
        {slugs.map((itemSlug, index) => {
          const entity = kind === 'system' ? resolveSystem(itemSlug) : resolveModule(itemSlug)
          const controls =
            readOnly || !entity
              ? undefined
              : cardRemoveControls({
                  name: entity.name ?? itemSlug,
                  onRemove: () => {
                    onRemove(index)
                  },
                })
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the same slug may be installed more than once; install order is stable
            <Erow key={`${itemSlug}-${index}`}>
              {entity ? (
                <ReferenceEntityDisplay
                  data={entity as unknown as SURefEntity}
                  compact
                  hide={HIDE_CHOICES}
                  controls={controls}
                  cardStyle={controls ? REMOVABLE_CARD_STYLE : undefined}
                />
              ) : (
                <div className="flex h-full items-center justify-between gap-2 rounded-[3px] border-chrome border-ink bg-paper px-3 py-2">
                  <span className="font-body text-sm text-ink">{itemSlug}</span>
                </div>
              )}
            </Erow>
          )
        })}
      </Ecflow>
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

/**
 * SystemModuleGrid — select systems and modules from salvageunion-reference.
 *
 * Over-slot selection is surfaced visually via the CapacityIndicator (the
 * parent MechBuilder computes capacity on every change). Items can be toggled
 * on/off freely; adding an item that would breach the slot cap renders the
 * item with a rust warning ring and an inline reason — but does NOT block the
 * toggle. The user can select anyway and resolve over-capacity via the
 * indicator (matches the legacy soft-cap UX).
 */
import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { MechSystemSlot, MechModuleSlot } from '../../lib/rules/types'
import { EntityChoiceCard } from '../shared/EntityChoiceCard'

type SystemModuleGridProps = {
  chassisName: string | null
  selectedSystems: MechSystemSlot[]
  selectedModules: MechModuleSlot[]
  onSystemsChange: (systems: MechSystemSlot[]) => void
  onModulesChange: (modules: MechModuleSlot[]) => void
  systemSlotsUsed: number
  systemSlotsMax: number
  moduleSlotsUsed: number
  moduleSlotsMax: number
}

type TabId = 'systems' | 'modules'

type SlotItemLike = { id: string; name: string; slotsRequired: number }

export function SystemModuleGrid({
  chassisName,
  selectedSystems,
  selectedModules,
  onSystemsChange,
  onModulesChange,
  systemSlotsUsed,
  systemSlotsMax,
  moduleSlotsUsed,
  moduleSlotsMax,
}: SystemModuleGridProps) {
  const [activeTab, setActiveTab] = useState<TabId>('systems')

  // TODO(p3): Filter systems by mech tech level (mirroring CrawlerBuilder's
  // filterSystemsByTL) once a mech TL context is available. MechBuilder
  // currently does not expose a tech level — chassis drives slot math only.
  // When a mech TL field is added, apply filterSystemsByTL here.
  const allSystems = useMemo(() => SalvageUnionReference.Systems.all(), [])
  const allModules = useMemo(() => SalvageUnionReference.Modules.all(), [])

  function toggleSystem(name: string, slotsRequired: number) {
    const isSelected = selectedSystems.some((s) => s.ref === name)
    if (isSelected) {
      onSystemsChange(selectedSystems.filter((s) => s.ref !== name))
    } else {
      onSystemsChange([...selectedSystems, { ref: name, slotCost: slotsRequired }])
    }
  }

  function toggleModule(name: string, slotsRequired: number) {
    const isSelected = selectedModules.some((m) => m.ref === name)
    if (isSelected) {
      onModulesChange(selectedModules.filter((m) => m.ref !== name))
    } else {
      onModulesChange([...selectedModules, { ref: name, slotCost: slotsRequired }])
    }
  }

  if (!chassisName) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Select a chassis to choose systems and modules.
      </div>
    )
  }

  function renderGrid(
    items: SlotItemLike[],
    selectedRefs: { ref: string }[],
    used: number,
    max: number,
    onToggle: (name: string, slotsRequired: number) => void
  ) {
    return (
      <div className="grid w-full grid-cols-1 gap-2 lg:grid-cols-2">
        {items.map((item) => {
          const isSelected = selectedRefs.some((s) => s.ref === item.name)
          const wouldExceed = !isSelected && max > 0 && used + item.slotsRequired > max
          return (
            <EntityChoiceCard
              key={item.id}
              entity={item}
              selected={isSelected}
              warning={wouldExceed}
              warningReason={
                wouldExceed
                  ? `Would exceed slot cap (${used + item.slotsRequired}/${max})`
                  : undefined
              }
              onSelect={() => onToggle(item.name, item.slotsRequired)}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tab toggles — .stepper-style pill tabs with slot counts as font-cond chips */}
      <div className="flex gap-2 border-b border-su-black pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('systems')}
          className={[
            'flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-[0.05em] transition-colors',
            activeTab === 'systems'
              ? 'bg-su-orange-dark text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]'
              : 'border border-su-black bg-white text-su-black hover:bg-su-blue-pale',
          ].join(' ')}
        >
          Systems
          <span
            className={[
              'rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold',
              activeTab === 'systems'
                ? 'bg-white/20 text-white'
                : 'bg-su-blue-pale text-su-grey-dark',
            ].join(' ')}
          >
            ({systemSlotsUsed}/{systemSlotsMax})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('modules')}
          className={[
            'flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-[0.05em] transition-colors',
            activeTab === 'modules'
              ? 'bg-su-orange-dark text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]'
              : 'border border-su-black bg-white text-su-black hover:bg-su-blue-pale',
          ].join(' ')}
        >
          Modules
          <span
            className={[
              'rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold',
              activeTab === 'modules'
                ? 'bg-white/20 text-white'
                : 'bg-su-blue-pale text-su-grey-dark',
            ].join(' ')}
          >
            ({moduleSlotsUsed}/{moduleSlotsMax})
          </span>
        </button>
      </div>

      {activeTab === 'systems' &&
        renderGrid(
          allSystems as unknown as SlotItemLike[],
          selectedSystems,
          systemSlotsUsed,
          systemSlotsMax,
          toggleSystem
        )}
      {activeTab === 'modules' &&
        renderGrid(
          allModules as unknown as SlotItemLike[],
          selectedModules,
          moduleSlotsUsed,
          moduleSlotsMax,
          toggleModule
        )}
    </div>
  )
}

/**
 * SystemModuleGrid — select systems and modules from salvageunion-reference.
 *
 * Over-slot selection is surfaced visually via the CapacityIndicator (the
 * parent MechBuilder computes capacity on every change). Items can be toggled
 * on/off; adding an item that would breach the slot cap shows an inline
 * warning and the CapacityIndicator turns red — but does NOT block the toggle
 * (user sees the violation and may undo it).
 */
import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { MechSystemSlot, MechModuleSlot } from '../../lib/rules/types'
import { cn } from '../../lib/utils'

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('systems')}
          className={cn(
            'px-3 py-1 text-sm rounded-md transition-colors',
            activeTab === 'systems'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Systems ({systemSlotsUsed}/{systemSlotsMax})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('modules')}
          className={cn(
            'px-3 py-1 text-sm rounded-md transition-colors',
            activeTab === 'modules'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Modules ({moduleSlotsUsed}/{moduleSlotsMax})
        </button>
      </div>

      {activeTab === 'systems' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {allSystems.map((system) => {
            const isSelected = selectedSystems.some((s) => s.ref === system.name)
            const wouldExceed =
              !isSelected &&
              systemSlotsMax > 0 &&
              systemSlotsUsed + system.slotsRequired > systemSlotsMax

            return (
              <button
                key={system.id}
                type="button"
                onClick={() => toggleSystem(system.name, system.slotsRequired)}
                className={cn(
                  'flex items-start gap-2 rounded-md border p-2 text-left text-sm transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : wouldExceed
                      ? 'border-red-300 bg-red-50 opacity-70'
                      : 'border-border hover:bg-accent'
                )}
                aria-pressed={isSelected}
              >
                <span className="flex-1">
                  <span className="font-medium">{system.name}</span>
                  <span className="ml-1 text-muted-foreground text-xs">
                    ({system.slotsRequired} slot{system.slotsRequired !== 1 ? 's' : ''})
                  </span>
                </span>
                {wouldExceed && <span className="text-xs text-red-500 shrink-0">Over cap</span>}
              </button>
            )
          })}
        </div>
      )}

      {activeTab === 'modules' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {allModules.map((module) => {
            const isSelected = selectedModules.some((m) => m.ref === module.name)
            const wouldExceed =
              !isSelected &&
              moduleSlotsMax > 0 &&
              moduleSlotsUsed + module.slotsRequired > moduleSlotsMax

            return (
              <button
                key={module.id}
                type="button"
                onClick={() => toggleModule(module.name, module.slotsRequired)}
                className={cn(
                  'flex items-start gap-2 rounded-md border p-2 text-left text-sm transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : wouldExceed
                      ? 'border-red-300 bg-red-50 opacity-70'
                      : 'border-border hover:bg-accent'
                )}
                aria-pressed={isSelected}
              >
                <span className="flex-1">
                  <span className="font-medium">{module.name}</span>
                  <span className="ml-1 text-muted-foreground text-xs">
                    ({module.slotsRequired} slot{module.slotsRequired !== 1 ? 's' : ''})
                  </span>
                </span>
                {wouldExceed && <span className="text-xs text-red-500 shrink-0">Over cap</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

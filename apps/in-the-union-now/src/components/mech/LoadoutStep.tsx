import { useState } from 'react'
import { cn } from '../../lib/utils'
import { InstallStep } from './InstallStep'

type LoadoutTab = 'systems' | 'modules'

type LoadoutStepProps = {
  systems: string[]
  modules: string[]
  /** Append one copy of the named system/module (duplicates allowed). */
  onAddSystem: (name: string) => void
  onAddModule: (name: string) => void
  /** Remove the single chosen entry at `index` (drops one copy). */
  onRemoveSystem: (index: number) => void
  onRemoveModule: (index: number) => void
  loadoutName: string
  systemSlotsUsed: number
  systemSlotsMax: number
  moduleSlotsUsed: number
  moduleSlotsMax: number
  energyValue: number
  energyMax: number
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-[1.5px] border-b-entity px-3 pb-2 pt-1 font-cond text-lede font-bold uppercase tracking-caps-snug transition-colors',
        active
          ? 'border-rust text-ink'
          : 'border-transparent text-wk-muted hover:text-ink focus-visible:text-ink'
      )}
    >
      {children}
    </button>
  )
}

/**
 * Custom-loadout step: systems and modules combined onto one screen, split by
 * a Systems / Modules tab bar. Each tab renders the existing InstallStep (the
 * TL-filtered Sel grid + Loadout panel) for its dataset.
 */
export function LoadoutStep({
  systems,
  modules,
  onAddSystem,
  onAddModule,
  onRemoveSystem,
  onRemoveModule,
  loadoutName,
  systemSlotsUsed,
  systemSlotsMax,
  moduleSlotsUsed,
  moduleSlotsMax,
  energyValue,
  energyMax,
}: LoadoutStepProps) {
  const [tab, setTab] = useState<LoadoutTab>('systems')

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Loadout"
        className="mb-6 flex gap-1 border-b-chrome border-wk-faint"
      >
        <TabButton active={tab === 'systems'} onClick={() => setTab('systems')}>
          Systems
        </TabButton>
        <TabButton active={tab === 'modules'} onClick={() => setTab('modules')}>
          Modules
        </TabButton>
      </div>

      {tab === 'systems' ? (
        <InstallStep
          kind="systems"
          selected={systems}
          onAdd={onAddSystem}
          onRemove={onRemoveSystem}
          loadoutName={loadoutName}
          slotsUsed={systemSlotsUsed}
          slotsMax={systemSlotsMax}
          energyValue={energyValue}
          energyMax={energyMax}
        />
      ) : (
        <InstallStep
          kind="modules"
          selected={modules}
          onAdd={onAddModule}
          onRemove={onRemoveModule}
          loadoutName={loadoutName}
          slotsUsed={moduleSlotsUsed}
          slotsMax={moduleSlotsMax}
          energyValue={energyValue}
          energyMax={energyMax}
        />
      )}
    </div>
  )
}

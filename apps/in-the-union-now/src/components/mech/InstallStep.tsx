import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { FilterChip } from 'suref-react'
import type { TechLevel } from '../../lib/rules/types'
import { SelCard } from '../wizard/SelCard'
import { LoadoutPanel } from './LoadoutPanel'

type InstallItemLike = {
  id: string
  name: string
  techLevel: number
  slotsRequired: number
}

const ALL_TLS: TechLevel[] = [1, 2, 3, 4, 5, 6]

type InstallStepProps = {
  /** Which dataset this step installs from. */
  kind: 'systems' | 'modules'
  /** Name refs currently installed. */
  selected: string[]
  onToggle: (name: string) => void
  /** Loadout panel header name (mech name, falling back to chassis). */
  loadoutName: string
  /** 'SYSTEM SLOTS' / 'MODULE SLOTS' budget figures (soft — never blocks). */
  slotsUsed: number
  slotsMax: number
  /** Energy Points readout for the is-ap track. */
  energyValue: number
  energyMax: number
}

/**
 * Install Systems / Install Modules step (design §3.2 mech wizard — NOT the
 * master-detail skeleton): a `1fr 300px` grid. Left: TL filter chips over a
 * 2-col grid of compact Sel-wrapped entity cards (gap 25 between columns).
 * Right: the 'Loadout · {name}' panel with pip budget tracks + head-mode
 * chosen cards. Selection is never blocked — over-capacity shows honestly in
 * the budget track (capacity stays soft, plan 3.4).
 */
export function InstallStep({
  kind,
  selected,
  onToggle,
  loadoutName,
  slotsUsed,
  slotsMax,
  energyValue,
  energyMax,
}: InstallStepProps) {
  const [activeTls, setActiveTls] = useState<TechLevel[]>([])

  const allItems = useMemo(() => {
    const accessor =
      kind === 'systems' ? SalvageUnionReference.Systems : SalvageUnionReference.Modules
    const items = accessor.all() as unknown as InstallItemLike[]
    return [...items].sort((a, b) => a.techLevel - b.techLevel || a.name.localeCompare(b.name))
  }, [kind])

  const visible =
    activeTls.length === 0
      ? allItems
      : allItems.filter((i) => activeTls.includes(i.techLevel as TechLevel))

  function toggleTl(tl: TechLevel) {
    setActiveTls((prev) => (prev.includes(tl) ? prev.filter((t) => t !== tl) : [...prev, tl]))
  }

  return (
    <div className="grid grid-cols-1 gap-[25px] lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* Left — TL filter chips + 2-col compact Sel grid */}
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tech level">
          {ALL_TLS.map((tl) => (
            <FilterChip
              key={tl}
              label={`TL${tl}`}
              active={activeTls.includes(tl)}
              onClick={() => toggleTl(tl)}
              swatchStyle={`var(--color-tl-${tl})`}
            />
          ))}
        </div>

        <div className="mt-[25px] grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3.5">
          {visible.map((item) => (
            <SelCard
              key={item.id}
              entity={item}
              name={item.name}
              selected={selected.includes(item.name)}
              onToggle={() => onToggle(item.name)}
            />
          ))}
        </div>
        {visible.length === 0 && (
          <p className="mt-4 text-sm text-wk-muted">No {kind} at the selected tech levels.</p>
        )}
      </div>

      {/* Right — Loadout panel (sticky on desktop) */}
      <LoadoutPanel
        name={loadoutName}
        slotLabel={kind === 'systems' ? 'System Slots' : 'Module Slots'}
        slotsUsed={slotsUsed}
        slotsMax={slotsMax}
        energyValue={energyValue}
        energyMax={energyMax}
        chosen={selected}
        kind={kind}
        className="lg:sticky lg:top-4"
      />
    </div>
  )
}

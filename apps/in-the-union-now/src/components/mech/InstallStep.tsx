import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { MiniBtn, ReferenceEntityDisplay } from 'suref-react'
import type { SURefEntity } from 'salvageunion-reference'
import type { TechLevel } from '../../lib/rules/types'
import { LoadoutPanel } from './LoadoutPanel'

type InstallItemLike = {
  id: string
  name: string
  techLevel: TechLevel
  slotsRequired: number
}

/**
 * Sort key for a tech level. Numeric tiers keep their value; Bio and Nanite
 * (the non-numeric equipment tiers) sort after TL6, in B → N order, so the
 * available list reads 1…6, B, N. Per the Core Book TECH LEVELS box ("TECH 6
 * … BIO AND NANITE TECH") these are legitimate tiers and must be browsable.
 */
function tlSortKey(tl: TechLevel): number {
  if (tl === 'B') return 7
  if (tl === 'N') return 8
  return tl
}

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
 * master-detail skeleton): a `1fr 300px` grid. Left: the full Systems/Modules
 * catalog as header-only compact rows, each with an "Add" control that appends
 * the item to the loadout. The list is NOT tier-gated, so every tier — including
 * Bio (B) and Nanite (N) — is reachable (Core Book TECH LEVELS box; Systems /
 * Modules tables pp.183-189). A small tier swatch badge labels each row.
 * Right: the 'Loadout · {name}' panel with pip budget tracks + head-mode chosen
 * cards. Selection is never blocked — over-capacity shows honestly in the
 * budget track (capacity stays soft, plan 3.4).
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
  const allItems = useMemo(() => {
    const accessor =
      kind === 'systems' ? SalvageUnionReference.Systems : SalvageUnionReference.Modules
    const items = accessor.all() as unknown as InstallItemLike[]
    return [...items].sort(
      (a, b) => tlSortKey(a.techLevel) - tlSortKey(b.techLevel) || a.name.localeCompare(b.name)
    )
  }, [kind])

  return (
    <div className="grid grid-cols-1 gap-[25px] lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* Left — full catalog as header-only rows, each with an Add control */}
      <div className="min-w-0">
        <div className="columns-1 gap-3.5 sm:columns-2 [&>*]:mb-3.5 [&>*]:break-inside-avoid">
          {allItems.map((item) => {
            const isAdded = selected.includes(item.name)
            return (
              <div key={item.id} className="flex items-start gap-2">
                <span
                  className="mt-0.5 inline-flex h-5 min-w-[22px] items-center justify-center rounded-[3px] px-1 font-cond text-[11px] font-bold leading-none text-paper"
                  style={{ backgroundColor: `var(--color-tl-${item.techLevel})` }}
                  title={`Tech Level ${item.techLevel}`}
                  aria-label={`Tech Level ${item.techLevel}`}
                >
                  {item.techLevel}
                </span>
                <div className="min-w-0 flex-1">
                  <ReferenceEntityDisplay
                    data={item as unknown as SURefEntity}
                    mode="head"
                    hide={{ actions: true, choices: true }}
                  />
                </div>
                <MiniBtn
                  onClick={() => onToggle(item.name)}
                  aria-label={`${isAdded ? 'Remove' : 'Add'} ${item.name}`}
                  aria-pressed={isAdded}
                  className={isAdded ? 'border-rust text-rust' : undefined}
                >
                  {isAdded ? 'Added' : 'Add'}
                </MiniBtn>
              </div>
            )
          })}
        </div>
        {allItems.length === 0 && (
          <p className="mt-4 text-sm text-wk-muted">No {kind} available.</p>
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

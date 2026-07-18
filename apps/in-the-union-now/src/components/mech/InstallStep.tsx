import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Btn, FilterChip, MasonryColumns, MicroLabel, ReferenceEntityDisplay } from 'component-lib'
import type { TechLevel } from '../../lib/rules/types'
import { LoadoutPanel } from './LoadoutPanel'
import { matchesRef } from '../../lib/rules/resolveRefs'

type InstallItemLike = {
  id: string
  name: string
  techLevel: TechLevel
  slotsRequired: number
}

const ALL_TLS: TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

/** Sort rank for a tech level: numeric tiers 1–6, then Bio (B), then Nanite (N). */
function tlRank(tl: TechLevel): number {
  if (tl === 'B') return 7
  if (tl === 'N') return 8
  return tl
}

type InstallStepProps = {
  /** Which dataset this step installs from. */
  kind: 'systems' | 'modules'
  /** Slug refs currently installed (may contain duplicates). */
  selected: string[]
  /** Append one copy of the named entity. */
  onAdd: (name: string) => void
  /** Remove the single chosen entry at `index` (drops one copy). */
  onRemove: (index: number) => void
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
 * row-major 2-col grid of compact entity cards (gap-4).
 * Right: the 'Loadout · {name}' panel with pip budget tracks + head-mode
 * chosen cards. Selection is never blocked — over-capacity shows honestly in
 * the budget track (capacity stays soft, plan 3.4).
 */
export function InstallStep({
  kind,
  selected,
  onAdd,
  onRemove,
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
    return [...items].sort(
      (a, b) => tlRank(a.techLevel) - tlRank(b.techLevel) || a.name.localeCompare(b.name)
    )
  }, [kind])

  const visible =
    activeTls.length === 0 ? allItems : allItems.filter((i) => activeTls.includes(i.techLevel))

  function toggleTl(tl: TechLevel) {
    setActiveTls((prev) => (prev.includes(tl) ? prev.filter((t) => t !== tl) : [...prev, tl]))
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* Left — TL filter chips + 2-col compact Sel grid */}
      <div className="min-w-0">
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would need a legend and carries min-content sizing quirks in this flex chip row; role="group" + aria-label conveys the same semantics */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tech level">
          {ALL_TLS.map((tl) => (
            <FilterChip
              key={tl}
              label={typeof tl === 'number' ? `TL${tl}` : tl === 'B' ? 'Bio' : 'Nanite'}
              active={activeTls.includes(tl)}
              onClick={() => toggleTl(tl)}
              swatchStyle={`var(--color-tl-${typeof tl === 'number' ? tl : tl.toLowerCase()})`}
            />
          ))}
        </div>

        <div className="mt-6">
          <MasonryColumns maxColumns={2}>
            {visible.map((item) => {
              const count = selected.filter((ref) => matchesRef(item, ref)).length
              const installed = count > 0
              // Count-based adder (duplicates are rules-legal; removal lives in
              // the Loadout panel) rendered natively: the card's `selected` ring
              // marks "installed", the add affordance rides its footActions band.
              return (
                <ReferenceEntityDisplay
                  key={item.id}
                  data={item as unknown as SURefEntity}
                  compact
                  selected={installed}
                  hide={{ actions: true, choices: true }}
                  footActions={
                    <>
                      {installed && (
                        <MicroLabel
                          tone="rust"
                          className="text-badge"
                          data-testid={`install-count-${item.name}`}
                        >
                          {count} Installed
                        </MicroLabel>
                      )}
                      <Btn
                        size="xs"
                        onClick={() => onAdd(item.name)}
                        aria-label={`Add ${item.name}`}
                      >
                        {installed ? '+ Add another' : '+ Add'}
                      </Btn>
                    </>
                  }
                />
              )
            })}
          </MasonryColumns>
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
        onRemove={onRemove}
        kind={kind}
        className="lg:sticky lg:top-4"
      />
    </div>
  )
}

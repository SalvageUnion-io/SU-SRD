import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { FilterChip, MasonryColumns, ReferenceEntityDisplay } from 'component-lib'
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
 * master-detail skeleton): the catalog is full-width — TL filter chips over a
 * row-major 2-col grid of compact entity cards. The 'Loadout · {name}' HUD no
 * longer takes a layout column; it FLOATS as a horizontal bar pinned to the
 * bottom-right of the viewport (over the catalog, never pushing it). Selection
 * is never blocked — over-capacity shows honestly in the budget track (capacity
 * stays soft, plan 3.4).
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
    <>
      {/* Full-width catalog. Bottom padding reserves room so the floating HUD
          never hides the last cards (it's out of flow — see below). */}
      <div className="min-w-0 pb-44">
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
              // the Loadout panel): the card's `selected` ring marks "installed"
              // and the add rides the standard ReferenceEntity `controls` API —
              // the install count shows as the control's secondary segment.
              return (
                <ReferenceEntityDisplay
                  key={item.id}
                  data={item as unknown as SURefEntity}
                  compact
                  selected={installed}
                  hide={{ actions: true, choices: true }}
                  controls={[
                    {
                      key: 'add',
                      label: installed ? '+ Add another' : '+ Add',
                      segmentText: installed ? String(count) : undefined,
                      ariaLabel: `Add ${item.name}`,
                      onClick: () => onAdd(item.name),
                    },
                  ]}
                />
              )
            })}
          </MasonryColumns>
        </div>
        {visible.length === 0 && (
          <p className="mt-4 text-sm text-wk-muted">No {kind} at the selected tech levels.</p>
        )}
      </div>

      {/* Floating Loadout HUD — a horizontal bar pinned bottom-right, over the
          catalog (out of flow, so it never pushes content). The wrapper is
          pointer-transparent so clicks fall through to the cards behind it; only
          the bar itself is interactive. z-30 sits UNDER the WizShell footer pill
          (z-40) so Back/Next stays clickable where the two corners meet. Full
          width on mobile, an auto-width bottom-right float from `sm` up. */}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-30 flex justify-end">
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
          className="pointer-events-auto w-full shadow-xl sm:max-w-2xl"
        />
      </div>
    </>
  )
}

import type { Story } from '@ladle/react'
import { type CSSProperties, useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { matchesRef } from 'salvageunion-reference/rules'
import { Button } from '../../../components/chrome/Button'
import { Panel } from '../../../components/chrome/Panel'
import { FilterChip } from '../../../components/shared/FilterChip'
import { MasonryColumns } from '../../../components/shared/MasonryColumns'
import { ReferenceEntityDisplay } from '../../../components/referenceEntity/card/referenceEntityDisplayShim'
import { VitalGauge } from '../../../components/stat/VitalGauge'
import { cn } from '../../../utils/cn'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Mech Install Step' }

// Local mirrors of the app-only types (InstallStep.tsx lines 9-16).
type TechLevel = 1 | 2 | 3 | 4 | 5 | 6 | 'B' | 'N'
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

/**
 * Local mirror of apps/in-the-union-now/src/components/mech/LoadoutPanel.tsx
 * (lines 32-128) — an app-only component, not a shared atom, so it is
 * reproduced verbatim here (it itself composes the shared Panel / VitalGauge /
 * ReferenceEntityDisplay / Button atoms). 'Loadout · {name}' header, ink slot gauge
 * + rust energy gauge, then the chosen items as head-mode entity cards.
 */
function LegacyLoadoutPanel({
  name,
  slotLabel,
  slotsUsed,
  slotsMax,
  energyValue,
  energyMax,
  chosen,
  onRemove,
  kind,
  className,
}: {
  name: string
  slotLabel: string
  slotsUsed: number
  slotsMax: number
  energyValue: number
  energyMax: number
  chosen: string[]
  onRemove: (index: number) => void
  kind: 'systems' | 'modules'
  className?: string
}) {
  const accessor =
    kind === 'systems' ? SalvageUnionReference.Systems : SalvageUnionReference.Modules

  const seen = new Map<string, number>()
  const chosenEntries = chosen.flatMap((ref, index) => {
    const found = accessor.find((x) => matchesRef(x, ref))
    if (!found) return []
    const copy = (seen.get(ref) ?? 0) + 1
    seen.set(ref, copy)
    return [{ entity: found as unknown as SURefEntity, ref, index, copy }]
  })
  const totals = new Map<string, number>()
  for (const ref of chosen) totals.set(ref, (totals.get(ref) ?? 0) + 1)

  return (
    <Panel className={cn('self-start px-4 py-4', className)}>
      <h2 className="font-cond text-sm font-bold uppercase tracking-caps text-ink">
        Loadout · <span className="text-rust">{name}</span>
      </h2>

      <div className="mt-3 space-y-3">
        <div
          style={
            { '--tone': 'var(--color-ink)', '--tone-deep': 'var(--color-ink)' } as CSSProperties
          }
        >
          <VitalGauge label={slotLabel} value={slotsUsed} max={slotsMax} readOnly />
        </div>
        <div
          style={
            { '--tone': 'var(--color-rust)', '--tone-deep': 'var(--color-rust)' } as CSSProperties
          }
        >
          <VitalGauge label="Energy" value={energyValue} max={energyMax} readOnly />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {chosenEntries.map(({ entity, ref, index, copy }) => {
          const total = totals.get(ref) ?? 1
          return (
            <div key={index} data-testid="loadout-entry" className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <ReferenceEntityDisplay
                  data={entity}
                  mode="head"
                  hide={{ actions: true, choices: true }}
                />
                {total > 1 && (
                  <span className="mt-0.5 block px-1 font-cond text-label font-bold uppercase tracking-caps text-wk-muted">
                    Copy {copy} of {total}
                  </span>
                )}
              </div>
              <Button
                size="xs"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${(entity as { name?: string }).name ?? ref}`}
                className="mt-0.5 shrink-0"
              >
                ✕ Remove
              </Button>
            </div>
          )
        })}
        {chosenEntries.length === 0 && (
          <p className="font-body text-xs text-wk-muted">Nothing installed yet.</p>
        )}
      </div>
    </Panel>
  )
}

/**
 * Verbatim reproduction of apps/in-the-union-now/src/components/mech/InstallStep.tsx
 * (lines 52-157): a `1fr 300px` grid — left, TL filter chips over a 2-col
 * MasonryColumns of compact entity cards with a native `+ Add` affordance; right,
 * the Loadout panel (mirrored above). Selection is never blocked; over-capacity
 * reads honestly in the soft budget track.
 */
function LegacyInstallStep({ kind }: { kind: 'systems' | 'modules' }) {
  const [activeTls, setActiveTls] = useState<TechLevel[]>([])
  const [selected, setSelected] = useState<string[]>([])

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

  const slotsUsed = selected.reduce((sum, ref) => {
    const found = allItems.find((i) => matchesRef(i, ref))
    return sum + (found?.slotsRequired ?? 0)
  }, 0)

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
                        <span
                          className="font-cond text-badge font-bold uppercase tracking-caps text-rust"
                          data-testid={`install-count-${item.name}`}
                        >
                          {count} Installed
                        </span>
                      )}
                      <Button
                        size="xs"
                        onClick={() => setSelected((prev) => [...prev, item.name])}
                        aria-label={`Add ${item.name}`}
                      >
                        {installed ? '+ Add another' : '+ Add'}
                      </Button>
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
      <LegacyLoadoutPanel
        name="Iron Mongrel"
        slotLabel={kind === 'systems' ? 'System Slots' : 'Module Slots'}
        slotsUsed={slotsUsed}
        slotsMax={6}
        energyValue={3}
        energyMax={8}
        chosen={selected}
        onRemove={(index) => setSelected((prev) => prev.filter((_, i) => i !== index))}
        kind={kind}
        className="lg:sticky lg:top-4"
      />
    </div>
  )
}

export const Systems: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Install Systems step (ITUN InstallStep kind="systems", lines 52-157) + mirrored
      LoadoutPanel. Click "+ Add" to fill the loadout.
    </Caption>
    <LegacyInstallStep kind="systems" />
  </div>
)

export const Modules: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Legacy · Install Modules step (ITUN InstallStep kind="modules", lines 52-157)</Caption>
    <LegacyInstallStep kind="modules" />
  </div>
)

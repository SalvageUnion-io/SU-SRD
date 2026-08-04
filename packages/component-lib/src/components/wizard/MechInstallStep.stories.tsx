import type { Story } from '@ladle/react'
import { useMemo, useState } from 'react'
import type { SURefModule, SURefSystem } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { matchesRef } from 'salvageunion-reference/rules'
import { Caption } from '../../stories/_harness'
import type { CSSVarStyle } from '../../styles/cssVars'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { FOCUS_RING } from '../chrome/interaction'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { MasonryColumns } from '../shared/MasonryColumns'
import { VitalGauge } from '../stat/VitalGauge'

export default { title: 'Compositions/Wizard/Mech Install Step' }

// Local mirror of the app-only type (InstallStep.tsx lines 9-16).
type TechLevel = 1 | 2 | 3 | 4 | 5 | 6 | 'B' | 'N'

const ALL_TLS: TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

// Gauge tones for the two budget readouts (slots = ink, energy = rust).
const INK_TONE: CSSVarStyle = { '--tone': 'var(--color-ink)', '--tone-deep': 'var(--color-ink)' }
const RUST_TONE: CSSVarStyle = { '--tone': 'var(--color-rust)', '--tone-deep': 'var(--color-rust)' }

/** Sort rank for a tech level: numeric tiers 1–6, then Bio (B), then Nanite (N). */
function tlRank(tl: number | 'B' | 'N'): number {
  if (tl === 'B') return 7
  if (tl === 'N') return 8
  return tl
}

/**
 * Local mirror of apps/itun/src/components/mech/LoadoutPanel.tsx —
 * an app-only component (not a shared atom), reproduced here so the wizard step
 * previews in Ladle. Floating HORIZONTAL HUD: 'Loadout · {name}' header + both
 * budget gauges inline (ink slots, rust energy), then the chosen items as a
 * horizontally-scrolling strip of removable chips.
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
    return [{ entity: found, ref, index, copy }]
  })
  const totals = new Map<string, number>()
  for (const ref of chosen) totals.set(ref, (totals.get(ref) ?? 0) + 1)

  return (
    <div className={cn('min-w-0', className)}>
      {/* Top row — header + both budget gauges inline (compact single-line). */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="whitespace-nowrap font-cond text-sm font-bold uppercase tracking-caps text-ink">
          Loadout · <span className="text-rust">{name}</span>
        </h2>
        <div style={INK_TONE}>
          <VitalGauge size="compact" readOnly label={slotLabel} value={slotsUsed} max={slotsMax} />
        </div>
        <div style={RUST_TONE}>
          <VitalGauge size="compact" readOnly label="Energy" value={energyValue} max={energyMax} />
        </div>
      </div>

      {/* Bottom row — chosen items as a horizontal, scrolling strip of chips. */}
      <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5">
        {chosenEntries.length === 0 ? (
          <p className="whitespace-nowrap font-body text-xs text-wk-muted">
            Nothing installed yet.
          </p>
        ) : (
          chosenEntries.map(({ entity, ref, index, copy }) => {
            const total = totals.get(ref) ?? 1
            const itemName = entity.name ?? ref
            return (
              <span
                key={index}
                data-testid="loadout-entry"
                className="flex shrink-0 items-center gap-1.5 rounded-card border-chrome border-ink bg-paper py-1 pl-2.5 pr-1"
              >
                <span className="whitespace-nowrap font-body text-xs font-medium text-ink">
                  {itemName}
                  {total > 1 && (
                    <span className="text-wk-muted">
                      {' · '}
                      {copy}/{total}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${itemName}`}
                  className={`flex size-5 shrink-0 items-center justify-center rounded-sm text-xs text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                >
                  ✕
                </button>
              </span>
            )
          })
        )}
      </div>
    </div>
  )
}

/**
 * Reproduction of the mech Install step (apps/.../mech/InstallStep.tsx +
 * MechWizard's WizShell footer): a full-width catalog of TL-filtered `+ Add`
 * cards, with the Loadout HUD MOUNTED in the floating WizShell footer bar — the
 * frameless HUD (gauges + chips) on the left, the ink nav pill (Back / Next) on
 * the right, one paper bar. The app pins it viewport-`fixed`; the story uses
 * `absolute` in a relative frame so it floats within the Ladle canvas.
 */
function LegacyInstallStep({ kind }: { kind: 'systems' | 'modules' }) {
  const [activeTls, setActiveTls] = useState<TechLevel[]>([])
  const [selected, setSelected] = useState<string[]>([])

  const allItems = useMemo(() => {
    const items: (SURefSystem | SURefModule)[] =
      kind === 'systems' ? SalvageUnionReference.Systems.all() : SalvageUnionReference.Modules.all()
    return [...items].sort(
      (a, b) => tlRank(a.techLevel) - tlRank(b.techLevel) || a.name.localeCompare(b.name)
    )
  }, [kind])

  const visible =
    activeTls.length === 0
      ? allItems
      : allItems.filter((i) => activeTls.some((t) => t === i.techLevel))

  function toggleTl(tl: TechLevel) {
    setActiveTls((prev) => (prev.includes(tl) ? prev.filter((t) => t !== tl) : [...prev, tl]))
  }

  const slotsUsed = selected.reduce((sum, ref) => {
    const found = allItems.find((i) => matchesRef(i, ref))
    return sum + (found?.slotsRequired ?? 0)
  }, 0)

  return (
    // `relative` frames the floating HUD to the story (the app uses viewport
    // `fixed`); min-height gives the absolute bar room to float over the catalog.
    <div className="relative min-h-[540px]">
      {/* Full-width catalog; bottom padding clears the floating HUD. */}
      <div className="min-w-0 pb-44">
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would need a legend and carries min-content sizing quirks in this flex chip row; role="group" + aria-label conveys the same semantics */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tech level">
          {ALL_TLS.map((tl) => (
            <Badge
              key={tl}
              shape="chip"
              as="button"
              aria-pressed={activeTls.includes(tl)}
              surface={activeTls.includes(tl) ? 'solid' : 'ghost'}
              swatch={`var(--color-tl-${typeof tl === 'number' ? tl : tl.toLowerCase()})`}
              onClick={() => toggleTl(tl)}
            >
              {typeof tl === 'number' ? `TL${tl}` : tl === 'B' ? 'Bio' : 'Nanite'}
            </Badge>
          ))}
        </div>

        <div className="mt-6">
          <MasonryColumns maxColumns={2}>
            {visible.map((item) => {
              const count = selected.filter((ref) => matchesRef(item, ref)).length
              const installed = count > 0
              return (
                <ReferenceEntityCard
                  key={item.id}
                  data={item}
                  size="medium"
                  selected={installed}
                  hide={{ actions: true, choices: true }}
                  controls={[
                    {
                      key: 'add',
                      label: installed ? '+ Add another' : '+ Add',
                      segmentText: installed ? String(count) : undefined,
                      ariaLabel: `Add ${item.name}`,
                      onClick: () => setSelected((prev) => [...prev, item.name]),
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

      {/* Floating WizShell footer bar — the HUD mounted alongside the nav pill.
          Pointer-transparent wrapper so clicks fall through to the cards. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center sm:justify-end">
        <div className="pointer-events-auto flex w-full flex-col gap-2.5 rounded-2xl border-chrome border-ink bg-paper p-2.5 shadow-xl sm:w-auto sm:max-w-4xl sm:flex-row sm:items-stretch sm:gap-3 sm:pl-3.5">
          <div className="flex min-w-0 flex-1 items-center">
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
            />
          </div>
          {/* Mock nav pill (WizShell owns the real one). */}
          <div className="flex items-center justify-end gap-2 rounded-2xl bg-ink p-2.5 sm:gap-3 sm:rounded-full sm:pl-4">
            <Button variant="ghost" className="border-paper/40 text-paper hover:bg-paper/10">
              Back
            </Button>
            <Button variant="primary" size="full" className="rounded-full">
              Next · Modules →
            </Button>
          </div>
        </div>
      </div>
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

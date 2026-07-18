import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Glyph, Panel, VitalGauge } from 'component-lib'
import { cn } from '../../lib/utils'
import { matchesRef } from '../../lib/rules/resolveRefs'

type LoadoutPanelProps = {
  /** Mech (or chassis) name shown in the 'Loadout · {name}' header. */
  name: string
  /** 'SYSTEM SLOTS' or 'MODULE SLOTS'. */
  slotLabel: string
  slotsUsed: number
  slotsMax: number
  /** Current/max Energy Points — informational is-ap track. */
  energyValue: number
  energyMax: number
  /** Name refs of the chosen systems or modules (may contain duplicates). */
  chosen: string[]
  /** Remove the single chosen entry at `index` (drops one copy). */
  onRemove: (index: number) => void
  /** Which dataset resolves the chosen refs. */
  kind: 'systems' | 'modules'
  className?: string
}

/**
 * Loadout HUD for the install steps (design §3.2 mech wizard) — a floating
 * HORIZONTAL bar: the 'Loadout · {name}' header and both budget gauges (slots
 * default-ink, energy is-ap rust) sit inline on the top row; the chosen items
 * ride a single horizontally-scrolling strip of removable chips below. The
 * consumer positions it (InstallStep floats it bottom-right over the catalog);
 * this component is layout-agnostic and just fills the `className`-sized frame.
 */
export function LoadoutPanel({
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
}: LoadoutPanelProps) {
  const accessor =
    kind === 'systems' ? SalvageUnionReference.Systems : SalvageUnionReference.Modules

  // Keep the original index for each chosen ref so removal drops exactly ONE
  // occurrence (remove-by-index, not filter-all-matches — duplicates are legal).
  // `copy` is the 1-based ordinal among same-named entries, shown as "· c/total"
  // when there's more than one copy so each chip reads distinctly.
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
    <Panel className={cn('px-3 py-2.5', className)}>
      {/* Top row — header + both budget gauges inline (wraps on a narrow float).
          The wizard has no sheet-tone context, so feed VitalGauge its accent via
          its own `style` (--tone / --tone-deep) — ink for the slot budget, rust
          for Energy — preserving the old ink/rust distinction. Over-capacity
          segments read red natively. `compact` = the single-line gauge. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="whitespace-nowrap font-cond text-sm font-bold uppercase tracking-caps text-ink">
          Loadout · <span className="text-rust">{name}</span>
        </h2>
        <VitalGauge
          compact
          readOnly
          label={slotLabel}
          value={slotsUsed}
          max={slotsMax}
          style={
            { '--tone': 'var(--color-ink)', '--tone-deep': 'var(--color-ink)' } as CSSProperties
          }
        />
        <VitalGauge
          compact
          readOnly
          label="Energy"
          value={energyValue}
          max={energyMax}
          style={
            { '--tone': 'var(--color-rust)', '--tone-deep': 'var(--color-rust)' } as CSSProperties
          }
        />
      </div>

      {/* Bottom row — installed items as a horizontal, scrolling strip of
          removable chips (the chosen 'Bar + scrolling chips' HUD). */}
      <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5">
        {chosenEntries.length === 0 ? (
          <p className="whitespace-nowrap font-body text-xs text-wk-muted">
            Nothing installed yet.
          </p>
        ) : (
          chosenEntries.map(({ entity, ref, index, copy }) => {
            const total = totals.get(ref) ?? 1
            const itemName = (entity as { name?: string }).name ?? ref
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
                  className="flex size-5 shrink-0 items-center justify-center rounded-sm text-xs text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <Glyph name="x" />
                </button>
              </span>
            )
          })
        )}
      </div>
    </Panel>
  )
}

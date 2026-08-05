import { FOCUS_RING, Glyph, PageHeading, VitalGauge } from 'component-lib'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { matchesRef } from 'salvageunion-reference/rules'
import { cn } from '../../lib/utils'

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
 * Loadout HUD content for the install steps (design §3.2 mech wizard) — a
 * HORIZONTAL bar: the 'Loadout · {name}' header and both budget gauges (slots
 * default-ink, energy is-ap rust) sit inline on the top row; the chosen items
 * ride a single horizontally-scrolling strip of removable chips below.
 *
 * Frameless by design — it renders INSIDE the shared WizShell footer bar (the
 * paper frame + the mounted nav pill live there), passed up as `footerHud` by
 * MechWizard. Layout-agnostic; it just fills the `className`-sized area.
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
    return [{ entity: found, ref, index, copy }]
  })
  const totals = new Map<string, number>()
  for (const ref of chosen) totals.set(ref, (totals.get(ref) ?? 0) + 1)

  return (
    <div className={cn('min-w-0', className)}>
      {/* Top row — header + both budget gauges inline (wraps on a narrow float).
          The wizard has no sheet-tone context, so feed VitalGauge its accent via
          its own `style` (--tone / --tone-deep) — ink for the slot budget, rust
          for Energy — preserving the old ink/rust distinction. Over-capacity
          segments read red natively. `size="compact"` = the single-line gauge. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <PageHeading variant="section" as="h2" className="whitespace-nowrap text-ink">
          Loadout · <span className="text-rust">{name}</span>
        </PageHeading>
        <VitalGauge
          size="compact"
          readOnly
          label={slotLabel}
          value={slotsUsed}
          max={slotsMax}
          style={
            { '--tone': 'var(--color-ink)', '--tone-deep': 'var(--color-ink)' } as CSSProperties
          }
        />
        <VitalGauge
          size="compact"
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
                  <Glyph name="x" />
                </button>
              </span>
            )
          })
        )}
      </div>
    </div>
  )
}

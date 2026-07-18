import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Btn, Panel, ReferenceEntityDisplay, VitalGauge } from 'component-lib'
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
 * Right-hand Loadout panel for the install steps (design §3.2 mech wizard):
 * 'Loadout · {name}' header, pip budget tracks (slots default-ink, energy
 * is-ap rust), then the chosen items as head-mode entity cards.
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
  // `copy` is the 1-based ordinal among same-named entries, shown when there's
  // more than one copy of an item so each entry reads as "Name · N".
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
        {/* The wizard has no sheet-tone context, so feed VitalGauge its accent
            inline — ink for the slot budget, rust for Energy — preserving the
            old ink/rust distinction. Over-capacity segments read red natively. */}
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
          // `index` (the original chosen-array position) is a deliberate,
          // safe key here: duplicates are allowed so name/ref is non-unique,
          // and these rows are stateless (head-mode display + stateless
          // Btn, onRemove closes over the live index each render). Do NOT
          // add per-row local state on this index key without switching to a
          // stable id — a removal shifts indices and would desync it.
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
              <Btn
                size="xs"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${(entity as { name?: string }).name ?? ref}`}
                className="mt-0.5 shrink-0"
              >
                ✕ Remove
              </Btn>
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

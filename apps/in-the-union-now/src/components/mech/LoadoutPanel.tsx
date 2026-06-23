import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { MiniBtn, Panel, ReferenceEntityDisplay, statBlockRowStarts } from 'suref-react'
import { cn } from '../../lib/utils'

type BudgetTrackProps = {
  /** Track label, e.g. 'SYSTEM SLOTS', 'ENERGY'. */
  label: string
  value: number
  max: number
  /** 'ap' renders rust pips (ENERGY); default ink. Over-budget pips go red. */
  tone?: 'default' | 'ap'
}

/**
 * Pip budget track for the install-step Loadout panel (design §3.2 mech):
 * '{LABEL} · n / max' over a ≤6-per-row pip strip. The track renders
 * max(max, value) pips so over-capacity is displayed honestly (red pips,
 * never clamped) — capacity stays a soft warning.
 */
function BudgetTrack({ label, value, max, tone = 'default' }: BudgetTrackProps) {
  const total = Math.max(max, value)
  const isOver = value > max
  const fill = tone === 'ap' ? 'border-rust bg-rust' : 'border-ink bg-ink'

  return (
    <div>
      <p className="font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-ink">
        {label} ·{' '}
        <span className={cn('font-body text-xs font-bold', isOver ? 'text-status-bad' : '')}>
          {value} / {max}
        </span>
      </p>
      {total > 0 && (
        <div
          className="mt-1.5 flex flex-col gap-1"
          role="img"
          aria-label={`${label} ${value} of ${max}`}
        >
          {statBlockRowStarts(total).map(({ count, start }, r) => (
            <div key={r} className="flex gap-1">
              {Array.from({ length: count }).map((_, c) => {
                const i = start + c
                const on = i < value
                const over = i >= max
                return (
                  <span
                    key={i}
                    data-pip={on ? 'on' : 'off'}
                    className={cn(
                      'h-[13px] w-[13px] rounded-[2px] border-[1.5px]',
                      on
                        ? over
                          ? 'border-status-bad bg-status-bad'
                          : fill
                        : 'border-ink bg-transparent'
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
    const found = accessor.find((x) => x.name === ref)
    if (!found) return []
    const copy = (seen.get(ref) ?? 0) + 1
    seen.set(ref, copy)
    return [{ entity: found as unknown as SURefEntity, ref, index, copy }]
  })
  const totals = new Map<string, number>()
  for (const ref of chosen) totals.set(ref, (totals.get(ref) ?? 0) + 1)

  return (
    <Panel className={cn('self-start px-4 py-4', className)}>
      <h2 className="font-cond text-sm font-bold uppercase tracking-[0.08em] text-ink">
        Loadout · <span className="text-rust">{name}</span>
      </h2>

      <div className="mt-3 space-y-3">
        <BudgetTrack label={slotLabel} value={slotsUsed} max={slotsMax} />
        <BudgetTrack label="Energy" value={energyValue} max={energyMax} tone="ap" />
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
                  <span className="mt-0.5 block px-1 font-cond text-[10px] font-bold uppercase tracking-[0.08em] text-wk-muted">
                    Copy {copy} of {total}
                  </span>
                )}
              </div>
              <MiniBtn
                onClick={() => onRemove(index)}
                aria-label={`Remove ${ref}`}
                className="mt-0.5 shrink-0"
              >
                ✕ Remove
              </MiniBtn>
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

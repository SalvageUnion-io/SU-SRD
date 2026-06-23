import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Panel, ReferenceEntityDisplay, statBlockRowStarts } from 'suref-react'
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
  /**
   * Name refs of the chosen systems or modules (head-mode cards). A multiset:
   * duplicates are allowed and rendered as separate, individually-removable
   * entries so the same item can be stacked.
   */
  chosen: string[]
  /** Remove the single chosen entry at `index` (not all matching names). */
  onRemoveAt?: (index: number) => void
  /** Which dataset resolves the chosen refs. */
  kind: 'systems' | 'modules'
  className?: string
}

/**
 * Right-hand Loadout panel for the install steps (design §3.2 mech wizard):
 * 'Loadout · {name}' header, pip budget tracks (slots default-ink, energy
 * is-ap rust), then the chosen items as head-mode entity cards. Each entry —
 * including repeated copies of the same item — gets its own remove control so
 * a single occurrence can be dropped without clearing the rest of a stack.
 */
export function LoadoutPanel({
  name,
  slotLabel,
  slotsUsed,
  slotsMax,
  energyValue,
  energyMax,
  chosen,
  onRemoveAt,
  kind,
  className,
}: LoadoutPanelProps) {
  const accessor =
    kind === 'systems' ? SalvageUnionReference.Systems : SalvageUnionReference.Modules
  // Map over `chosen` by index (NOT flatMap) so each rendered entry's index
  // lines up with onRemoveAt — removing by index drops exactly one copy.
  const chosenEntries = chosen.map((ref, index) => ({
    index,
    ref,
    entity: (accessor.find((x) => x.name === ref) as unknown as SURefEntity | undefined) ?? null,
  }))

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
        {chosenEntries.map(({ index, ref, entity }) => (
          <div key={`${ref}-${index}`} className="relative">
            {entity ? (
              <ReferenceEntityDisplay
                data={entity}
                mode="head"
                hide={{ actions: true, choices: true }}
              />
            ) : (
              <p className="font-body text-xs text-wk-muted">{ref}</p>
            )}
            {onRemoveAt && (
              <button
                type="button"
                aria-label={`Remove ${ref}`}
                onClick={() => onRemoveAt(index)}
                className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-paper font-cond text-xs font-bold leading-none text-ink transition-colors hover:border-rust hover:text-rust focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-rust/30"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {chosenEntries.length === 0 && (
          <p className="font-body text-xs text-wk-muted">Nothing installed yet.</p>
        )}
      </div>
    </Panel>
  )
}

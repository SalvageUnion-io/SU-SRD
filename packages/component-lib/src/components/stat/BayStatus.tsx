import { cn } from '../../utils/cn'
import type { EntityStatus } from '../shared/entityStatus'
import { ConditionSwatch } from './ConditionSwatch'
import { statBlockRowStarts } from './pipRows'

/** Tally order — intact, then damaged, then destroyed. */
const STATE_ORDER: readonly EntityStatus[] = ['intact', 'damaged', 'destroyed']

type BayStatusProps = {
  /** One condition per bay, in order. */
  states: EntityStatus[]
  /** Header label. */
  label?: string
  /** Per-bay click (cycle / inspect a bay). Read-only when omitted. */
  onBayClick?: (index: number) => void
  className?: string
}

/**
 * BayStatus — the crawler-bay condition tally, a standalone primitive (NOT a
 * Stat mode). A framed paper card with an ink header tab, a legend of
 * counts per state, and a per-bay `ConditionSwatch` grid (split ≤6/row,
 * bottom-heavy, like the sheet trackers). Each bay swatch is a button when
 * `onBayClick` is supplied, else a static glyph.
 *
 * Fill-shape (via `ConditionSwatch`) is the primary encoding — intact solid,
 * damaged half, destroyed ✕ — grayscale-legible, no gradients.
 */
export function BayStatus({ states, label = 'Bays', onBayClick, className }: BayStatusProps) {
  const tallies = STATE_ORDER.map((state) => ({
    state,
    count: states.filter((s) => s === state).length,
  })).filter((tally) => tally.count > 0)

  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would impose default form chrome on the framed card; role="group" carries the same grouping semantics
    <div
      role="group"
      aria-label={`${label}: ${states.length} bays`}
      className={cn(
        'inline-flex w-fit flex-col overflow-hidden rounded-card border-2 border-ink bg-paper',
        className
      )}
    >
      {/* Header tab */}
      <div className="flex items-center justify-between gap-3 bg-ink px-2 py-1">
        <span className="font-cond text-xs font-bold uppercase leading-none tracking-caps-wide text-paper">
          {label}
        </span>
        <span className="font-cond text-micro uppercase leading-none text-paper/60">
          {states.length} {states.length === 1 ? 'bay' : 'bays'}
        </span>
      </div>

      {/* Legend — counts per present state */}
      {tallies.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2.5 py-1.5">
          {tallies.map(({ state, count }) => (
            <span key={state} className="flex items-center gap-1.5">
              <ConditionSwatch state={state} aria-hidden="true" className="size-3" />
              <span className="font-body text-base font-bold leading-none text-ink">{count}</span>
              <span className="font-cond text-micro uppercase leading-none text-wk-muted">
                {state}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Per-bay swatch grid */}
      {states.length > 0 && (
        <div className="flex flex-col items-center gap-1 border-t border-ink/15 px-2.5 py-2">
          {statBlockRowStarts(states.length).map(({ count, start }, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: swatch rows are positional — the row index IS their identity
            <div key={row} className="flex justify-center gap-1">
              {Array.from({ length: count }).map((_, col) => {
                const index = start + col
                const state = states[index]
                if (!state) return null
                const title = `Bay ${index + 1} · ${state}`
                const swatchClass = 'size-[13px] rounded-badge border-chrome'
                return onBayClick ? (
                  <button
                    key={index}
                    type="button"
                    title={title}
                    aria-label={title}
                    onClick={() => onBayClick(index)}
                    className="inline-flex cursor-pointer"
                  >
                    <ConditionSwatch state={state} aria-hidden="true" className={swatchClass} />
                  </button>
                ) : (
                  <span key={index} title={title} className="inline-flex">
                    <ConditionSwatch state={state} aria-hidden="true" className={swatchClass} />
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { cn } from '../../utils/cn'

type SlotGridProps = {
  /** Slots currently filled. Values above `cap` render as over-capacity cells. */
  used: number
  /** Total slot capacity. */
  cap: number
  /**
   * `pip` (default) — dense inline cells for listings / tooltips.
   * `sheet` — larger addressable cells for the Live Sheet / Dashboard.
   */
  scale?: 'pip' | 'sheet'
  /** Accessible label; defaults to "used of cap slots filled". */
  label?: string
  className?: string
}

/**
 * SlotGrid — dashed addressable cargo cells (ruleset §5, atom 10).
 *
 * The cargo rule made literal: **1 cell = 1 slot = 1 scrap.**
 *
 * - **Empty** — a dashed off-white cell (`dashed = fillable`).
 * - **Filled** — a solid `cargo`-toned cell.
 * - **Over-cap** — a solid `status-bad` cell (state as a treatment, not a hue).
 *
 * `SlotGrid` measures fungible _quantity that has addresses_ — it never merges
 * with a scalar Gauge or a StatDisplay (ruleset §6, must-NOT-merge).
 */
export function SlotGrid({ used, cap, scale = 'pip', label, className }: SlotGridProps) {
  const safeCap = Math.max(0, Math.floor(cap))
  const safeUsed = Math.max(0, Math.floor(used))
  const total = Math.max(safeCap, safeUsed)
  const over = safeUsed > safeCap

  const cell = scale === 'sheet' ? 'size-5 rounded-badge' : 'size-2.5 rounded-pip'

  return (
    <div
      role="img"
      aria-label={
        label ?? `${safeUsed} of ${safeCap} slots filled${over ? ' — over capacity' : ''}`
      }
      className={cn('flex flex-wrap gap-1', className)}
    >
      {Array.from({ length: total }).map((_, i) => {
        const state = i >= safeCap ? 'over' : i < safeUsed ? 'filled' : 'empty'
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional — the index IS the slot address
            key={i}
            aria-hidden="true"
            className={cn(
              'inline-block border-chrome',
              cell,
              state === 'filled' && 'border-cargo bg-cargo',
              state === 'empty' && 'border-dashed border-ink/40 bg-paper',
              state === 'over' && 'border-status-bad bg-status-bad'
            )}
          />
        )
      })}
    </div>
  )
}

import type { CSSProperties } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { statBlockRowStarts } from './pipRows'

type SlotGridProps = {
  /** Slots currently filled. Values above `cap` render as over-capacity cells. */
  used: number
  /** Total slot capacity. */
  cap: number
  /** Accessible label; defaults to "used of cap slots filled". */
  label?: string
  /**
   * A read surface: an empty cell is a plain outline, not a dashed drop target.
   * Dashed means "fillable" and a read-only sheet fills nothing.
   */
  readOnly?: boolean
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
 * with a scalar Gauge or a Stat (ruleset §6, must-NOT-merge).
 *
 * Cells lay out on the shared pip-row split (ruleset §4.5): ≤6 per row,
 * bottom-heavy, centred — the same rhythm as the gauge / statblock tracks.
 */
const GRID = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
} satisfies CSSProperties

const ROW = { display: 'flex', gap: space[4], justifyContent: 'center' } satisfies CSSProperties

/** An addressable cell, sized for the Live Sheet. */
const CELL = {
  borderRadius: radius.badge,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  display: 'inline-block',
  height: '1.25rem',
  width: '1.25rem',
} satisfies CSSProperties

const CELL_STATE = {
  filled: { backgroundColor: color.cargo, borderColor: color.cargo },
  /** Fillable: a dashed ink-40 outline on paper. */
  empty: { backgroundColor: color.paper, borderColor: color.ink40, borderStyle: 'dashed' },
  /** Read-only: a plain outline at ink 30%, a step under the fillable one's 40. */
  emptyReadOnly: { backgroundColor: color.paper, borderColor: color.ink30 },
  over: { backgroundColor: color.statusBad, borderColor: color.statusBad },
} satisfies Record<string, CSSProperties>

export function SlotGrid({ used, cap, label, readOnly = false }: SlotGridProps) {
  const safeCap = Math.max(0, Math.floor(cap))
  const safeUsed = Math.max(0, Math.floor(used))
  const total = Math.max(safeCap, safeUsed)
  const over = safeUsed > safeCap

  return (
    <div
      role="img"
      aria-label={
        label ?? `${safeUsed} of ${safeCap} slots filled${over ? ' — over capacity' : ''}`
      }
      style={GRID}
    >
      {statBlockRowStarts(total).map((row) => (
        <div key={row.start} style={ROW}>
          {Array.from({ length: row.count }, (_, c) => {
            const i = row.start + c
            const state = i >= safeCap ? 'over' : i < safeUsed ? 'filled' : 'empty'
            return (
              <span
                key={i}
                aria-hidden="true"
                style={{
                  ...CELL,
                  ...CELL_STATE[state === 'empty' && readOnly ? 'emptyReadOnly' : state],
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

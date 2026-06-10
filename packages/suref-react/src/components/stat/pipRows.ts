/**
 * StatBlock pip-track row split (design-spec §2.7 `.sblock__track`):
 * at most 6 pips per row, rows split evenly, extras to the LAST rows
 * (bottom-heavy): 7 → 3/4, 8 → 4/4, 13 → 4/4/5.
 *
 * NOTE: this is intentionally the OPPOSITE bias of the legacy `.pips` split
 * (≤5 per row, extras to the FIRST rows) used by the board-generation `.stat`
 * trackers and print — both algorithms ship, do not unify them (design §6.6).
 */
export function statBlockRows(n: number, perRow = 6): number[] {
  if (n <= 0) return []
  const rows = Math.max(1, Math.ceil(n / perRow))
  const base = Math.floor(n / rows)
  const extra = n % rows
  return Array.from({ length: rows }, (_, i) => base + (i >= rows - extra ? 1 : 0))
}

/** statBlockRows with each row's starting pip index precomputed (render-pure). */
export function statBlockRowStarts(n: number, perRow = 6): { count: number; start: number }[] {
  const rows = statBlockRows(n, perRow)
  return rows.map((count, r) => ({
    count,
    start: rows.slice(0, r).reduce((sum, c) => sum + c, 0),
  }))
}

/**
 * Pip click-to-set semantics (design-spec §4.5): clicking pip `i` (0-based)
 * with current value `v` sets the value to `i < v ? i : i + 1` — clicking a
 * lit pip turns it and everything above off; clicking an unlit pip fills up
 * to and including it.
 */
export function pipClickValue(index: number, value: number): number {
  return index < value ? index : index + 1
}

/**
 * Pip-track row split (ruleset §4.5): at most **5 pips per row**, rows split as
 * evenly as possible, and in awkward splits the **TOP rows get heavier** — the
 * bottom rows carry the smaller count and balance, centred beneath. So the
 * extras go to the FIRST rows (top-heavy):
 *
 *   6 → 3/3 · 7 → 4/3 · 8 → 4/4 · 9 → 5/4 · 10 → 5/5 · 13 → 5/4/4 · 20 → 5/5/5/5
 *
 * Each row is rendered `justify-center`, so the lighter lower rows sit centred
 * under the heavier top row. One canonical split for every pip surface
 * (StatDisplay framed tracker + VitalGauge).
 */
export function statBlockRows(n: number, perRow = 5): number[] {
  if (n <= 0) return []
  const rows = Math.max(1, Math.ceil(n / perRow))
  const base = Math.floor(n / rows)
  const extra = n % rows
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0))
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

/**
 * Per-segment fill state for a value/max track — the shared "segmented track"
 * core used by both StatDisplay's framed tracker (square pips) and VitalGauge
 * (full-width bars). 'off' = unlit, 'on' = lit, 'danger' = lit but past the cap
 * (over-capacity) or past the heat redline. `dangerFrom` is the first 0-based
 * index that reads danger (default Infinity = never). Each surface keeps its own
 * visual styling; only the state logic + the row split (statBlockRowStarts) are
 * shared.
 */
export type TrackSegmentState = 'off' | 'on' | 'danger'
export function trackSegmentState(
  index: number,
  value: number,
  max: number,
  dangerFrom: number = Number.POSITIVE_INFINITY
): TrackSegmentState {
  if (index >= value) return 'off'
  return index >= max || index >= dangerFrom ? 'danger' : 'on'
}

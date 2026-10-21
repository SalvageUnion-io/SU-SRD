/**
 * Pip-track row split (ruleset §4.5): at most **6 pips per row**, rows split as
 * evenly as possible, and **bottom-heavy** — the heavier row sits on the
 * BOTTOM, so the higher-numbered pips fill the last row. Extras go to the LAST
 * rows:
 *
 *   6 → 6 · 7 → 3/4 · 8 → 4/4 · 10 → 5/5 · 11 → 5/6 · 12 → 6/6 · 13 → 4/4/5 · 20 → 5/5/5/5
 *
 * Each row renders `justify-center`, so the lighter upper rows sit centred above
 * the heavier bottom row. One canonical split for every pip surface —
 * Stat framed tracker, VitalGauge, and SlotGrid cargo.
 */
/** The §4.5 law: at most 6 pips per row, on every pip surface — not a knob. */
const PER_ROW = 6

export function statBlockRows(n: number): number[] {
  if (n <= 0) return []
  const rows = Math.max(1, Math.ceil(n / PER_ROW))
  const base = Math.floor(n / rows)
  const extra = n % rows
  return Array.from({ length: rows }, (_, i) => base + (i >= rows - extra ? 1 : 0))
}

/** statBlockRows with each row's starting pip index precomputed (render-pure). */
export function statBlockRowStarts(n: number): { count: number; start: number }[] {
  const rows = statBlockRows(n)
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
 * core used by both Stat's framed tracker (square pips) and VitalGauge
 * (full-width bars). 'off' = unlit, 'on' = lit, 'danger' = lit but past the cap
 * (over-capacity) or past the heat redline, 'redline' = UNLIT but inside the
 * redline zone, so the track shows where it turns dangerous before the value
 * reaches it, at Heat 0 as well as at Heat 7 (ruleset §4.5).
 * `dangerFrom` is the first 0-based index that reads danger (default Infinity =
 * never). Each surface keeps its own visual styling; only the state logic + the
 * row split (statBlockRowStarts) are shared.
 */
export type TrackSegmentState = 'off' | 'redline' | 'on' | 'danger'
export function trackSegmentState(
  index: number,
  value: number,
  max: number,
  dangerFrom: number = Number.POSITIVE_INFINITY
): TrackSegmentState {
  if (index >= value) return index >= dangerFrom && index < max ? 'redline' : 'off'
  return index >= max || index >= dangerFrom ? 'danger' : 'on'
}

/** Whether a segment in `state` is lit (filled). */
export function segmentLit(state: TrackSegmentState): boolean {
  return state === 'on' || state === 'danger'
}

/**
 * A slot count as a line of pips for a wizard's tracker tab: `●●●○○`, filled
 * to `used` (clamped to 0…max), with a trailing space before the count beside
 * it. Empty past 12 slots, or with none, so the tab stays a tab.
 */
export function slotPips(used: number, max: number): string {
  if (max <= 0 || max > 12) return ''
  const filled = Math.max(0, Math.min(used, max))
  return `${'●'.repeat(filled)}${'○'.repeat(max - filled)} `
}

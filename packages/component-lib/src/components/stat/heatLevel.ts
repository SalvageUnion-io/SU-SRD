/**
 * Heat-track escalation thresholds (design review U-1). Heat is the game's
 * core tension mechanic, so the `heat` stat tone escalates visually as it
 * climbs: `high` at >= ~70% of cap, `critical` at cap (red border + pulse).
 * Inert without a positive max — srd renders StatBlocks with no live
 * maxima and must not escalate.
 */
export type HeatLevel = 'normal' | 'high' | 'critical'

/** Ratio of max at which the heat track starts reading as dangerous. */
export const HEAT_HIGH_RATIO = 0.7

export function heatLevel(value: number, max: number | undefined): HeatLevel {
  if (max === undefined || max <= 0) return 'normal'
  if (value >= max) return 'critical'
  if (value / max >= HEAT_HIGH_RATIO) return 'high'
  return 'normal'
}

/**
 * First 0-based pip index past the ~70% line — lit heat pips from here up
 * render in the status-bad red. Chosen so a red pip is lit exactly when
 * `heatLevel` reads `high`/`critical` (value/max >= HEAT_HIGH_RATIO).
 */
export function heatDangerFrom(max: number): number {
  return Math.ceil(max * HEAT_HIGH_RATIO) - 1
}

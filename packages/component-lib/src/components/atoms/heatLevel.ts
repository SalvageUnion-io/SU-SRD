/** Ratio of max at which the heat track starts reading as dangerous. */
const HEAT_HIGH_RATIO = 0.7

/**
 * First 0-based pip index past the ~70% line — lit heat pips from here up
 * render in the status-bad red (design review U-1: heat is the game's core
 * tension mechanic, so the track escalates visually as it climbs).
 */
export function heatDangerFrom(max: number): number {
  return Math.ceil(max * HEAT_HIGH_RATIO) - 1
}

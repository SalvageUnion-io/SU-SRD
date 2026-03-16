/**
 * Pure utility functions for heat UI presentation.
 *
 * No React, no Supabase — pure transforms for use in components and tests.
 */

import { getHeatGenerated } from 'salvageunion-reference'

/**
 * Describes the heat level relative to the heat cap.
 * Used to determine color coding on the heat stat display.
 */
export type HeatLevel = 'normal' | 'warning' | 'danger' | 'critical'

/**
 * Compute the heat level from a current heat value and heat cap.
 *
 * Thresholds (per architecture doc):
 *  - 0–49% of cap: 'normal'
 *  - 50–79% of cap: 'warning'
 *  - 80–99% of cap: 'danger'
 *  - 100% of cap (at cap): 'critical'
 */
export function getHeatLevel(currentHeat: number, heatCap: number): HeatLevel {
  if (heatCap <= 0) return 'normal'
  const pct = currentHeat / heatCap
  if (pct >= 1) return 'critical'
  if (pct >= 0.8) return 'danger'
  if (pct >= 0.5) return 'warning'
  return 'normal'
}

/**
 * Map a HeatLevel to the Tailwind color class applied to the heat stat value.
 */
export function getHeatColorClass(level: HeatLevel): string {
  switch (level) {
    case 'critical':
      return 'text-red-600'
    case 'danger':
      return 'text-orange-600'
    case 'warning':
      return 'text-amber-500'
    case 'normal':
    default:
      return ''
  }
}

/**
 * Minimal entity shape needed to read heat trait data.
 */
type EntityWithTraits = {
  traits?: Array<{ type: string; amount?: number | string }>
  [key: string]: unknown
}

/**
 * Build the label string for a "Use" button based on the heat cost of an entity.
 *
 * - Heat cost N:       "Use (Heat: N)"
 * - Variable heat (x): "Use (Heat: ?)"
 * - No heat:           "Use"
 */
export function getUseButtonLabel(entity: EntityWithTraits): string {
  const heat = getHeatGenerated(entity)
  if (heat === 'variable') return 'Use (Heat: ?)'
  if (heat > 0) return `Use (Heat: ${heat})`
  return 'Use'
}

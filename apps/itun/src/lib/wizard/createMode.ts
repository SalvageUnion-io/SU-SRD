/**
 * CreateMode — the /new routes' `mode` search param (wizard-refresh Phase 1):
 *   absent   → CreateModeChooser
 *   'guided' → the existing wizard, unchanged
 *   'blank'  → the Blank dialog (escape hatch)
 */

export type CreateMode = 'guided' | 'blank' | undefined

/** Narrow a raw search param onto the CreateMode union (routes' validateSearch). */
export function parseCreateMode(value: unknown): CreateMode {
  return value === 'guided' || value === 'blank' ? value : undefined
}

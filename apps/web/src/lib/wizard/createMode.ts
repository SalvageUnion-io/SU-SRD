/**
 * CreateMode — the /new routes' `mode` search param:
 *   absent    → the guided wizard on its first step (r6 F2), or the chooser
 *               while `OPENS_ON_FIRST_STEP` is false
 *   'guided'  → the guided wizard
 *   'blank'   → the Blank dialog (escape hatch), over the wizard
 *   'pattern' → a mech's patterns, each with its Build With This
 */

export type CreateMode = 'guided' | 'blank' | 'pattern' | undefined

/**
 * The r6 F2 ruling, in its one place: true, a /new route opens straight on
 * the guided wizard's first step, Blank and From a pattern links in its
 * head; false, it opens on the Guided / Blank chooser, which an entry point
 * that has already chosen skips with `?mode=guided`.
 */
export const OPENS_ON_FIRST_STEP: boolean = true

/** Narrow a raw search param onto the CreateMode union (routes' validateSearch). */
export function parseCreateMode(value: unknown): CreateMode {
  return value === 'guided' || value === 'blank' || value === 'pattern' ? value : undefined
}

/**
 * The mode a route draws: as asked, but a mech link naming a book pattern
 * with no mode (a pattern page's Build With This for one past the starting
 * rules) is the pattern screen, where it builds as printed.
 */
export function shownMode(mode: CreateMode, kind: string, bookPattern?: string): CreateMode {
  if (kind !== 'mech' && mode === 'pattern') return undefined
  return mode === undefined && kind === 'mech' && bookPattern !== undefined ? 'pattern' : mode
}

/** Whether a route at the `shownMode` draws the guided wizard (the Blank dialog may open over it). */
export function drawsWizard(mode: CreateMode): boolean {
  if (mode === 'guided') return true
  return OPENS_ON_FIRST_STEP && mode !== 'pattern'
}

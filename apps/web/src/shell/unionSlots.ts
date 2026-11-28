/**
 * What the shell's Union bar (`./unionBar.ts`) and the app that fills it
 * (`components/shared/UnionBarSlots.tsx`) agree on, in a module with no imports
 * so the app's bundle carries none of the shell's renderer.
 */

/** The bar's slots, by the `data-union-slot` value the app finds them by. */
export const UNION_SLOTS = ['search', 'actions', 'mobile'] as const

export type UnionSlot = (typeof UNION_SLOTS)[number]

/** The selector for one slot. */
export const slotSelector = (slot: UnionSlot): string => `[data-union-slot="${slot}"]`

/**
 * Set on `<html>` while the page draws no Union bar: a Cockpit (a pilot's Play
 * mode, `/pilots/<id>/play`, or a Game's Mediator's, `/games/<id>/mediate`),
 * which draws its own (the Play bar, ADR-051 §2), and a link preview's render
 * surface (`/og/…`). Your Games (`/games/`), a Game's page (`/games/*`, the
 * Manage context, ADR-052 §7) and an invite keep the bar. The Worker sets it on the shell it
 * serves for those paths, so the bar never flashes there; the app sets it as
 * it routes.
 */
export const BAR_HIDDEN_ATTRIBUTE = 'data-union-bar-hidden'

/** Whether a route (a path inside the app) draws no Union bar. */
export const hidesUnionBar = (path: string): boolean =>
  /^\/pilots\/[^/]+\/play\/?$/.test(path) ||
  /^\/games\/[^/]+\/mediate\/?$/.test(path) ||
  path.startsWith('/og/')

/**
 * A page on a bar-less route that cannot open draws the bar after all (r8 C6,
 * LG8-12): a refused Play screen has no Play bar, so without the Union bar it
 * would have no way out. `PlayRefusal` holds it while it is up.
 */
let barHolds = 0
const barListeners = new Set<() => void>()

export const pageShowsBar = {
  subscribe(listener: () => void): () => void {
    barListeners.add(listener)
    return () => barListeners.delete(listener)
  },
  get: (): boolean => barHolds > 0,
  /** Show the bar; the returned function lets it go. */
  hold(): () => void {
    barHolds += 1
    for (const listener of barListeners) listener()
    let held = true
    return () => {
      if (!held) return
      held = false
      barHolds -= 1
      for (const listener of barListeners) listener()
    }
  },
}

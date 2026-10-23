/**
 * What the shell's Union bar (`./unionBar.ts`) and the app that fills it
 * (`components/shared/UnionBarSlots.tsx`) agree on, in a module with no imports
 * so the app's bundle carries none of the shell's renderer.
 */

/** The bar's slots, by the `data-union-slot` value the app finds them by. */
export const UNION_SLOTS = ['banner', 'games', 'search', 'actions', 'mobile'] as const

export type UnionSlot = (typeof UNION_SLOTS)[number]

/** The selector for one slot. */
export const slotSelector = (slot: UnionSlot): string => `[data-union-slot="${slot}"]`

/**
 * Set on `<html>` while the page draws no Union bar: a Cockpit (a pilot's,
 * `/play/pilots/<id>`, or a Game's Mediator's, `/play/games/<id>/mediate`),
 * which draws its own (the Play bar, ADR-045 §6), and a link preview's render
 * surface (`/og/…`). The Play landing (`/play/`), a Game's page
 * (`/play/games/*`, the Manage context, ADR-052 §7) and an invite keep the
 * bar: its Play tab is how you got there. The Worker sets it on the shell it
 * serves for those paths, so the bar never flashes there; the app sets it as
 * it routes.
 */
export const BAR_HIDDEN_ATTRIBUTE = 'data-union-bar-hidden'

/** Whether a route (a path inside the app) draws no Union bar. */
export const hidesUnionBar = (path: string): boolean =>
  path.startsWith('/play/pilots/') ||
  /^\/play\/games\/[^/]+\/mediate\/?$/.test(path) ||
  path.startsWith('/og/')

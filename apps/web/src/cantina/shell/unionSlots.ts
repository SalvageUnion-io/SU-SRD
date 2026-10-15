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

/** The Cantina's nav, as routes; the bar shows them under the base. */
export const UNION_NAV = [
  { label: 'Hangar', path: '/' },
  { label: 'Starter Set', path: '/starter/' },
] as const

/**
 * Set on `<html>` while the page draws no Union bar: the Dashboard, which draws
 * its own (ADR-045 §6), and a link preview's render surface (`/og/*`). The
 * Worker sets it on the shell it serves for those paths, so the bar never
 * flashes there; the app sets it as it routes.
 */
export const BAR_HIDDEN_ATTRIBUTE = 'data-union-bar-hidden'

/** Whether a route (a path inside the app) draws no Union bar. */
export const hidesUnionBar = (path: string): boolean =>
  path.startsWith('/dashboard/') || path.startsWith('/og/')

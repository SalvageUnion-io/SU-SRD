/**
 * Whether the reference-search FAB (`components/shared/GlobalSearch.tsx`)
 * would cover a route's own bottom-right controls:
 *
 * - `/dashboard/*` — the canvas never scrolls, so the button would sit over
 *   the display's bottom-right corner for good, and the Dashboard carries
 *   its own SRD display. (The Dial's ▲ ▼ ⚙ bar, the first reason, is gone.)
 * - `/pilots/new`, `/mechs/new`, `/crawlers/new` — the wizard's sticky
 *   Back / Next pill floats in exactly that corner.
 *
 * Everywhere else the corner is free. Toasts were the third thing down there;
 * the root lifts them above the button instead (see `routes/__root.tsx`).
 */
export function fabCollides(pathname: string): boolean {
  return /^\/dashboard\//.test(pathname) || /^\/(pilots|mechs|crawlers)\/new\/?$/.test(pathname)
}

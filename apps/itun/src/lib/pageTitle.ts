/**
 * Browser tab titles. Every routed page sets one through its route's `head()`
 * (rendered by `<HeadContent />` in `routes/__root.tsx`), so a player with a
 * pilot, a mech and a Game open in separate tabs can tell them apart.
 *
 * Here rather than in a route file because a route module may export only
 * `Route` (`routes/__tests__/routeExports.test.ts`).
 */

import { PRODUCT } from 'component-lib/product'

export const SITE_TITLE = PRODUCT.name

/** `<prefix> · <product name>`, or the bare site name with no prefix. */
export function pageTitle(prefix?: string | null): string {
  return prefix ? `${prefix} · ${SITE_TITLE}` : SITE_TITLE
}

/**
 * Every page's title, the reference pages' and the app's: `X · SalvageUnion.io`,
 * or the bare site name where a page names nothing. A routed app page sets
 * its own through its route's `head()` (rendered by `<HeadContent />` in
 * `routes/__root.tsx`), so a player with a pilot, a mech and a Game open in
 * separate tabs can tell them apart. A page in one of the app's named areas
 * names its area too (`areaTitle`): `Patterns · Training Bay · SalvageUnion.io`.
 * The account's own pages (sign-in, sign-out, settings) belong to the whole
 * app, not an area (glossary.md §9), so they take `pageTitle` alone.
 *
 * Only a relative import of a module with none: the app's shell, which the
 * Vite config loads, titles itself with it too. So the area's name is the
 * caller's to pass (`PRODUCT.build`, `PRODUCT.play`), never imported here.
 */

import { SITE_NAME } from './documentHead'

/** `<prefix> · SalvageUnion.io`, or the bare site name with no prefix. */
export function pageTitle(prefix?: string | null): string {
  return prefix ? `${prefix} · ${SITE_NAME}` : SITE_NAME
}

/** `<page> · <area> · SalvageUnion.io`, or `<area> · SalvageUnion.io` with no page. */
export function areaTitle(area: string, page?: string | null): string {
  return pageTitle(page ? `${page} · ${area}` : area)
}

/**
 * Every page's title, the reference pages' and the Cantina's: `X · SalvageUnion.io`,
 * or the bare site name where a page names nothing. A routed Cantina page sets
 * its own through its route's `head()` (rendered by `<HeadContent />` in
 * `routes/__root.tsx`), so a player with a pilot, a mech and a Game open in
 * separate tabs can tell them apart.
 *
 * Only a relative import of a module with none: the Cantina's shell, which the
 * Vite config loads, titles itself with it too.
 */

import { SITE_NAME } from './documentHead'

/** `<prefix> · SalvageUnion.io`, or the bare site name with no prefix. */
export function pageTitle(prefix?: string | null): string {
  return prefix ? `${prefix} · ${SITE_NAME}` : SITE_NAME
}

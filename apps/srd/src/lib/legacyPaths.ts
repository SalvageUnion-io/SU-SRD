/**
 * The page grammar srd published before it dropped `/schema/…/item/` from its
 * URLs (refit N4), and where each such path lives now.
 *
 * Until then a listing was `/schema/chassis/` and a page
 * `/schema/chassis/item/mule/` (a pattern under it, `…/mule/pattern/hauler/`,
 * an unfurl beside it, `…/item/mule.og.png`). Those URLs are in search indexes,
 * Discord history and bookmarks, and a published URL never dies (ADR-043,
 * decision 4), so every one of them 301s to its new home.
 *
 * One pattern, not a rule per page: the Worker answers it (`worker/index.ts`),
 * because Static Assets runs the script for a miss and nothing the build emits
 * sits under these paths any more. The JSON API kept the old grammar
 * (`/schema/chassis/item/mule.json`, `/schema/chassis.json`): those are real
 * files, so they never reach the Worker, and a `.json` miss stays a 404 here
 * rather than turning into a page.
 *
 * Pure and dependency-free: the Worker bundles it.
 */

/** `/schema/<schema>/item/<rest>` — an entity page, its pattern pages, its unfurls. */
const LEGACY_ITEM = /^\/schema\/([a-z0-9-]+)\/item\/(.+)$/

/** `/schema/<schema>` or `/schema/<schema>/` — a listing page. */
const LEGACY_LISTING = /^\/schema\/([a-z0-9-]+)\/?$/

/**
 * Where a request for a pre-N4 page path lives now, or `undefined` when the
 * path is not one (including any `.json`, the API's own grammar).
 *
 * A page target always ends in a slash, so the 301 lands on the directory
 * index in one hop rather than through Static Assets' own trailing-slash
 * redirect. A file target (`.og.png`) keeps its name.
 *
 * @param pathname - The request's pathname, as `URL` parses it
 * @returns The current root-relative path, or `undefined`
 */
export function currentPathFor(pathname: string): string | undefined {
  if (pathname.endsWith('.json')) return undefined
  const item = LEGACY_ITEM.exec(pathname)
  if (item) {
    const [, schemaId, rest] = item
    const path = `/${schemaId}/${rest}`
    const leaf = path.split('/').at(-1) ?? ''
    return path.endsWith('/') || leaf.includes('.') ? path : `${path}/`
  }
  const listing = LEGACY_LISTING.exec(pathname)
  return listing ? `/${listing[1]}/` : undefined
}

/**
 * An entity page's pre-N4 address, `/schema/<schema>/item/<slug>/` — for the
 * generated `_redirects`, whose former-slug rules must answer the URL as it was
 * published.
 *
 * @param schemaId - The entity's schema id
 * @param slug - The entity's slug
 * @returns The legacy root-relative page path, with its trailing slash
 */
export function legacyItemHref(schemaId: string, slug: string): string {
  return `/schema/${schemaId}/item/${slug}/`
}

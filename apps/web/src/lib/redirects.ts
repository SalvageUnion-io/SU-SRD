/**
 * Every address the site once published and where it lives now: the one table
 * of moved paths, read by everything that answers one with a 301.
 *
 * Three answerers, because Static Assets answers a request before any script
 * runs:
 *
 * - `/_redirects` (`endpoints/redirects.ts`) for the exact rules Static Assets
 *   serves itself: `FIXED_MOVES`, then each former slug's.
 * - The Worker's miss (`worker/index.ts`) for the old page grammar
 *   (`currentPathFor`): one pattern, not a rule per page.
 * - The app's rules (`worker/app.ts`) for the paths under `/build` it
 *   no longer has (`retiredDocPage`, `retiredTarget`): the Worker runs first
 *   there, so `_redirects` never sees them. Play moved out from under the base
 *   to its own root, `/play` (ADR-062), so its old addresses are among them.
 *
 * A published URL never dies (ADR-043, decision 4). Pure: the Worker bundles it.
 */

import {
  cockpitPath,
  gamePath,
  invitePath,
  isEntityKind,
  mediatePath,
  sheetPath,
} from 'game-domain/entityKinds'
import { DOC_PAGES } from './docPages'

/** An exact `from → to` 301. */
export type Move = { from: string; to: string }

/**
 * The fixed site-wide rules `_redirects` carries. The build emits
 * `sitemap-index.xml`, while every crawler and every human types `sitemap.xml`:
 * the canonical name really is the index, and the redirect is permanent.
 */
export const FIXED_MOVES: readonly Move[] = [{ from: '/sitemap.xml', to: '/sitemap-index.xml' }]

// ---------------------------------------------------------------------------
// The reference pages' old grammar
// ---------------------------------------------------------------------------
//
// Until the reference site dropped `/schema/…/item/` from its URLs, a listing was
// `/schema/chassis/` and a page `/schema/chassis/item/mule/` (a pattern under
// it, `…/mule/pattern/hauler/`, an unfurl beside it, `…/item/mule.og.png`).
// Those URLs are in search indexes, Discord history and bookmarks. Nothing the
// build emits sits under these paths any more, so a request for one is a miss
// and reaches the Worker. The JSON API kept the old grammar
// (`/schema/chassis/item/mule.json`, `/schema/chassis.json`): those are real
// files, so they never reach the Worker, and a `.json` miss stays a 404 rather
// than turning into a page.

/** `/schema/<schema>/item/<rest>` — an entity page, its pattern pages, its unfurls. */
const LEGACY_ITEM = /^\/schema\/([a-z0-9-]+)\/item\/(.+)$/

/** `/schema/<schema>` or `/schema/<schema>/` — a listing page. */
const LEGACY_LISTING = /^\/schema\/([a-z0-9-]+)\/?$/

/**
 * Where a request for an old-grammar page path lives now, or `undefined` when
 * the path is not one (including any `.json`, the API's own grammar).
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
 * An entity page's old-grammar address, `/schema/<schema>/item/<slug>/` — for
 * the generated `_redirects`, whose former-slug rules must answer the URL as it
 * was published.
 *
 * @param schemaId - The entity's schema id
 * @param slug - The entity's slug
 * @returns The legacy root-relative page path, with its trailing slash
 */
export function legacyItemHref(schemaId: string, slug: string): string {
  return `/schema/${schemaId}/item/${slug}/`
}

// ---------------------------------------------------------------------------
// The reference pages that are gone
// ---------------------------------------------------------------------------

/**
 * A site page that no longer exists, and where its address lands. The search
 * page went (the bar's dropdown is the search, EDL "Which form, where"): its
 * address goes to the home page, and the Worker keeps the query string, so
 * `/search/?q=mule` opens the Union bar's search on "mule". The bot's page
 * moved from `/discord/` to `/bot/`, beside its terms and privacy policy.
 */
const RETIRED_SITE_PAGES: ReadonlyMap<string, string> = new Map([
  ['/search', '/'],
  ['/discord', '/bot/'],
])

/**
 * Where a retired site page's address lands, with or without its trailing
 * slash; `undefined` for any other path.
 *
 * @param pathname - The request's pathname, as `URL` parses it
 * @returns The root-relative page it lands on, or `undefined`
 */
export function retiredSitePage(pathname: string): string | undefined {
  return RETIRED_SITE_PAGES.get(pathname.replace(/\/+$/, ''))
}

// ---------------------------------------------------------------------------
// The app's retired paths, read inside its base
// ---------------------------------------------------------------------------

/**
 * The app's own `/about` and `/changelog`, which the site's pages replaced:
 * a bookmark or an old link lands on the site's page, on this origin.
 */
const RETIRED_DOC_PAGES: ReadonlyMap<string, string> = new Map([
  ['about', DOC_PAGES.about.href],
  ['changelog', DOC_PAGES.changelog.href],
])

/**
 * Where a retired app doc page went. Takes a path inside the base, with or
 * without its trailing slash; null for any other path.
 */
export function retiredDocPage(path: string): string | null {
  return RETIRED_DOC_PAGES.get(path.replace(/^\/+|\/+$/g, '')) ?? null
}

/**
 * Retired addresses under the base, each read as a route inside it, and where
 * each lives now. Two generations:
 *
 * Play's and the sheets' addresses before Play had its own root (ADR-062),
 * from links pasted into Discord, bookmarks and installed apps:
 *
 *   - `/play/…`                              → `/play/…` at its own root:
 *     `/play/game/:gameId`                   → `/play/games/:gameId/mediate`,
 *     `/play/:pilotId`                       → `/play/pilots/:pilotId`, and
 *     every other Play path keeps its own (`/play/`, `/play/games/:gameId`)
 *   - `/invite/:token`                       → `/play/invite/:token`
 *   - `/sheet/:kind/:id`                     → `/<kind>s/:id` (`sheetPath`)
 *   - `/mechs/patterns`                      → `/patterns/`
 *
 * And intheunionnow.com's, once TanStack routes that redirected in the
 * browser; that zone's Redirect Rule sends every path to the same path under
 * salvageunion.io/build:
 *
 *   - `/games`                               → `/play/` (Your Games is Play's hub)
 *   - `/games/:gameId`                       → `/play/games/:gameId` (ADR-052 §5)
 *   - `/games/:gameId/view/:kind/:entityId`  → `/<kind>s/:entityId` (the old crew
 *     view; the live read-only sheet takes the same row id)
 *   - `/join/:code`                          → `/play/invite/:code` (an invite's
 *     token is its old join code, so the invite page joins or explains)
 *   - `/dashboard/:pilotId`                  → `/play/pilots/:pilotId` (`PlayGate`
 *     resolves an old mech-keyed id to its pilot)
 *   - `/mediator/:gameId`                    → `/play/games/:gameId/mediate`
 *
 * Each lands where it lives now in one hop. A trailing slash names the same
 * address. A path under one of these prefixes that names none of these shapes
 * keeps its own path: it never matched a route before either, and lands on the
 * app's not-found page.
 *
 * `/s/:id` (ADR-036) is not here: its page explains a retired snapshot link and
 * has nowhere to send anyone, so it stays a route.
 *
 * @returns The route it lives at now (`appPath` puts it on the site), without
 *   its query string, or null
 */
export function retiredTarget(path: string): string | null {
  const parts = path.split('/').filter((part) => part.length > 0)
  const [first, second, third, fourth, fifth] = parts
  if (first === 'play') return playTarget(parts)
  if (first === 'sheet' && parts.length === 3 && second !== undefined && third !== undefined)
    return isEntityKind(second) ? sheetPath(second, third) : null
  if (first === 'mechs' && second === 'patterns' && parts.length === 2) return '/patterns/'
  if (first === 'invite' && parts.length === 2 && second !== undefined) return invitePath(second)
  if (first === 'games' && parts.length === 1) return '/play/'
  if (first === 'games' && parts.length === 2 && second !== undefined) return gamePath(second)
  if (first === 'games' && parts.length === 5 && third === 'view') {
    return fourth !== undefined && fifth !== undefined && isEntityKind(fourth)
      ? sheetPath(fourth, fifth)
      : null
  }
  if (first === 'join' && parts.length === 2 && second !== undefined) return invitePath(second)
  if (first === 'dashboard' && parts.length === 2 && second !== undefined)
    return cockpitPath(second)
  if (first === 'mediator' && parts.length === 2 && second !== undefined) return mediatePath(second)
  return null
}

/** A Play path from under the base, at its own root and its current name. */
function playTarget(parts: readonly string[]): string {
  const [, second, third] = parts
  if (parts.length === 3 && second === 'game' && third !== undefined) return mediatePath(third)
  if (parts.length === 2 && second !== undefined && second !== 'games') return cockpitPath(second)
  return parts.length === 1 ? '/play/' : `/${parts.join('/')}`
}

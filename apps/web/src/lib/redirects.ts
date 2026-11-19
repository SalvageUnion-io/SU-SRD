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
 *   to `/play` (ADR-062), then became the Games' root and each pilot's Play
 *   mode (ADR-065), so its old addresses are among them, at either root.
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
import { APP_BASE, appPath, GAMES_ROOT, underBase } from './appBase'

/** Your Games, the Games' root (ADR-065). */
const GAMES_HOME = `${GAMES_ROOT}/`

import { DOC_PAGES } from './docPages'
import { searchHref } from './searchHref'

/** An exact `from → to` 301. */
export type Move = { from: string; to: string }

/**
 * The fixed site-wide rules `_redirects` carries. The build emits
 * `sitemap-index.xml`, while every crawler and every human types `sitemap.xml`:
 * the canonical name really is the index, and the redirect is permanent.
 */
export const FIXED_MOVES: readonly Move[] = [
  { from: '/sitemap.xml', to: '/sitemap-index.xml' },
  // Pages published under an earlier name, still crawled and linked.
  ...bothSpellings('/equipment/knife-missle/', '/equipment/knife-missile/'),
  ...bothSpellings(
    '/systems/integrated-amphibious-locomotion-system/',
    '/systems/amphibious-locomotion-system/'
  ),
  // Mech Monday, no longer a source: its page goes to the sources, and the
  // Gatecrasher's Mech Monday patterns to their chassis.
  ...bothSpellings('/sources/mech-monday/', '/sources/'),
  ...[
    'cornerstone',
    'crash-cart',
    'kam',
    'one-punch',
    'pioneer',
    'the-quaestor',
    'retiarius-terebro',
    'tsunami',
  ].flatMap((slug) =>
    bothSpellings(`/chassis/gatecrasher/pattern/${slug}/`, '/chassis/gatecrasher/')
  ),
]

/** A page's move with and without its trailing slash: a hand-typed link may have either. */
function bothSpellings(from: string, to: string): Move[] {
  return [
    { from, to },
    { from: from.slice(0, -1), to },
  ]
}

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
// Earlier addresses of the site's pages
// ---------------------------------------------------------------------------

/**
 * The site's own pages that went, by pattern rather than one rule per page.
 * Search engines still crawl them daily, and leyline.press links the mech
 * sheet:
 *
 *   - `/titans/…`                     → `/bio-titans/…`
 *   - `/actions/<slug>/`              → the Union bar's search for its words.
 *     An action has no page of its own: it renders on the entity that has it,
 *     and `_redirects` sends each action with one such entity there first
 *     (`endpoints/redirects.ts`). This is the rest.
 *   - `/catalog-categories/<id>/`     → the guides, or the home page, which
 *     lists every category
 *   - `/sheets/<kind>`                → a new sheet of that kind in Build
 *   - `/roll-tables/salvage-cache-table/` → the search: the table is two now,
 *     one per book
 *   - `/apple-touch-icon*.png`        → the icon `documentHead` declares; iOS
 *     asks for the conventional names before reading the page, at the root
 *     and under the app's base when Build is added to a home screen
 *   - the site's icons asked for under the app's base → the site's own
 *
 * @param pathname - The request's pathname, as `URL` parses it
 * @returns The root-relative address it lands on, or `undefined`
 */
export function formerSitePath(pathname: string): string | undefined {
  const icon = siteIcon(pathname)
  if (icon) return icon
  const parts = pathname.split('/').filter((part) => part.length > 0)
  const [first, second] = parts
  if (first === 'titans')
    return `/bio-titans/${parts.slice(1).join('/')}${parts.length > 1 ? '/' : ''}`
  if (parts.length > 2 || second === undefined) return undefined
  if (first === 'actions' && SLUG.test(second)) return searchFor(second)
  if (first === 'catalog-categories') return second === 'guides' ? '/guides/' : '/'
  if (first === 'sheets' && parts.length === 2 && isEntityKind(second)) {
    return appPath(`/${second}s/new`)
  }
  if (first === 'roll-tables' && second === 'salvage-cache-table') return searchFor(second)
  return undefined
}

/** iOS's guesses at a touch icon, sized or not, precomposed or not. */
const APPLE_TOUCH_ICON = /^\/apple-touch-icon(-\d+x\d+)?(-precomposed)?\.png$/

/** The touch icon `documentHead.ts` links. */
const TOUCH_ICON = '/favicons/su/favicon-180.png'

/** An icon asked for by a conventional name, or under the app's base. */
function siteIcon(pathname: string): string | undefined {
  const app = underBase(pathname)
  const path = app ? pathname.slice(APP_BASE.length) : pathname
  if (APPLE_TOUCH_ICON.test(path)) return TOUCH_ICON
  if (!app) return undefined
  if (path === '/favicon.ico') return path
  if (path === '/favicon.svg') return '/favicons/su/favicon.svg'
  return path.startsWith('/favicons/') ? path : undefined
}

const SLUG = /^[a-z0-9-]+$/

/** The home page with the Union bar's search open on a slug's words. */
function searchFor(slug: string): string {
  return searchHref(slug.split('-').filter(Boolean).join(' '))
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
 *   - `/play/…`, here or at Play's retired root (ADR-065):
 *     `/play/`                               → `/games/`,
 *     `/play/games/:gameId[/mediate]`        → `/games/:gameId[/mediate]`,
 *     `/play/invite/:token`                  → `/games/invite/:token`,
 *     `/play/pilots/:pilotId`, `/play/:pilotId` → `/pilots/:pilotId/play`,
 *     `/play/game/:gameId`                   → `/games/:gameId/mediate`
 *   - `/invite/:token`                       → `/games/invite/:token`
 *   - `/sheet/:kind/:id`                     → `/<kind>s/:id` (`sheetPath`)
 *   - `/mechs/patterns`                      → `/patterns/`
 *
 * And intheunionnow.com's, once TanStack routes that redirected in the
 * browser; that zone's Redirect Rule sends every path to the same path under
 * salvageunion.io/build:
 *
 *   - `/games`                               → `/games/` (Your Games, at its own root)
 *   - `/games/:gameId`                       → `/games/:gameId`
 *   - `/games/:gameId/view/:kind/:entityId`  → `/<kind>s/:entityId` (the old crew
 *     view; the live read-only sheet takes the same row id)
 *   - `/join/:code`                          → `/games/invite/:code` (an invite's
 *     token is its old join code, so the invite page joins or explains)
 *   - `/dashboard/:pilotId`                  → `/pilots/:pilotId/play` (`PlayGate`
 *     resolves an old mech-keyed id to its pilot)
 *   - `/mediator/:gameId`                    → `/games/:gameId/mediate`
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
  if (first === 'games' && parts.length === 1) return GAMES_HOME
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

/** The collections Play's old addresses named, never a pilot's id. */
const PLAY_COLLECTIONS = new Set(['games', 'game', 'pilots', 'invite'])

/**
 * A Play path (`/play/…` at its retired root, or under the base) where it lives
 * now: the Games' root, or the pilot's own page for a Cockpit (ADR-065).
 */
function playTarget(parts: readonly string[]): string | null {
  const [, second, third, fourth] = parts
  if (parts.length === 1) return GAMES_HOME
  if (parts.length === 2 && second !== undefined && !PLAY_COLLECTIONS.has(second))
    return cockpitPath(second)
  if (second === 'game' && parts.length === 3 && third !== undefined) return mediatePath(third)
  if (second === 'pilots' && parts.length === 3 && third !== undefined) return cockpitPath(third)
  if (second === 'invite' && parts.length === 3 && third !== undefined) return invitePath(third)
  if (parts.length === 2) return GAMES_HOME
  if (second === 'games' && parts.length === 3 && third !== undefined) return gamePath(third)
  if (second === 'games' && parts.length === 4 && third !== undefined && fourth === 'mediate')
    return mediatePath(third)
  return null
}

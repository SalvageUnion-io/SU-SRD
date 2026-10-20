/**
 * The Union bar's app side: its two modes' navs (`components/unionBar/UnionBar.tsx`),
 * which mode and nav item a route is (`unionHere`), and the rules the app
 * applies to the bar (`components/shared/UnionBarSlots.tsx`). The shell's bar
 * is marked for the route it is served on by the same decision
 * (`markUnionRoute`, `worker/shellMeta.ts`), so the right tab and nav item
 * paint first.
 */
import { routeInApp } from './appBase'
import { pageOrigin } from './site'

/** The app's two modes (ruleset §3.11): Build, the Training Bay, and Play, the Cantina. */
export type UnionMode = 'build' | 'play'

/** A nav item the bar can mark as the page you are on. Games is Play's menu, not a link. */
export type UnionNavId = 'hangar' | 'patterns' | 'starter' | 'games' | 'solo'

/** One of the bar's nav links, as a route inside the app; the bar shows it under the base. */
export type UnionNavLink = { id: UnionNavId; label: string; path: string }

/** Build's nav: your assets. */
const BUILD_NAV: readonly UnionNavLink[] = [
  { id: 'hangar', label: 'Training Bay', path: '/' },
  { id: 'patterns', label: 'Patterns', path: '/mechs/patterns/' },
  { id: 'starter', label: 'Starter Set', path: '/starter/' },
]

/**
 * Play's nav links, after its Games menu (the app's control, a slot): Solo,
 * an anchor on the hub (ADR-052 §6), never a page of its own, so never
 * current.
 */
const PLAY_NAV: readonly UnionNavLink[] = [{ id: 'solo', label: 'Solo', path: '/play/#play-solo' }]

/** Each mode's nav links. */
export const UNION_NAV: Record<UnionMode, readonly UnionNavLink[]> = {
  build: BUILD_NAV,
  play: PLAY_NAV,
}

/** Whether a nav route is the page you are on. */
export function isCurrent(path: string, pathname: string): boolean {
  const route = path.replace(/\/+$/, '')
  if (route === '') return pathname === '/' || pathname === ''
  return pathname === route || pathname.startsWith(`${route}/`)
}

/**
 * Whether a route is one of Play's: the hub or anything under it, and an
 * invite link, which joins a Game (ADR-052 §4).
 */
const isPlayRoute = (path: string): boolean =>
  path === '/play' || path.startsWith('/play/') || path.startsWith('/invite/')

/**
 * Whether a route is a Game's: its page in Play, a Mediator's Cockpit, or the
 * old address that redirects to its page. Games ▾ is current on all of them.
 */
const isGameRoute = (path: string): boolean =>
  path.startsWith('/games/') || path.startsWith('/play/games/') || path.startsWith('/play/game/')

/**
 * Where a route (a path inside the app) is in the bar: its mode, and the nav
 * item that is current, if any. Play is the hub and everything under it, an
 * invite link, and every Game's route; everything else in the app is Build. Games ▾ is current
 * on the hub, which lists your Games, and on every Game route (ruleset §3.11).
 */
export function unionHere(path: string): { mode: UnionMode; nav: UnionNavId | null } {
  if (isGameRoute(path) || path === '/play' || path === '/play/') {
    return { mode: 'play', nav: 'games' }
  }
  if (isPlayRoute(path)) return { mode: 'play', nav: null }
  const link = BUILD_NAV.find((item) => isCurrent(item.path, path))
  return { mode: 'build', nav: link?.id ?? null }
}

/**
 * Mark the bar where you are, in place: the mark `markUnionRoute` gives the
 * shell, moved as the app routes. The bar wears the mode (`data-mode`: its
 * colour and its nav), its tab is current, and so is the nav link of the
 * page you are on.
 */
export function markUnionBar(bar: Element, mode: UnionMode, nav: UnionNavId | null): void {
  bar.setAttribute('data-mode', mode)
  for (const tab of bar.querySelectorAll<HTMLElement>('.su-union-bar__tab[data-tool]')) {
    if (tab.dataset.tool === mode) tab.setAttribute('aria-current', 'true')
    else tab.removeAttribute('aria-current')
  }
  for (const link of bar.querySelectorAll<HTMLElement>('.su-union-bar__nav [data-nav]')) {
    if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}

/**
 * The route a click on one of the bar's links should take in place, or null to
 * leave it to the browser: another tool, a new tab, a modified click.
 */
export function inAppRoute(event: MouseEvent, origin: string = pageOrigin()): string | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const link = event.target instanceof Element ? event.target.closest('a') : null
  if (!link || link.target) return null
  const url = new URL(link.getAttribute('href') ?? '', origin)
  if (url.origin !== origin) return null
  const route = routeInApp(url.pathname)
  return route === null ? null : `${route}${url.search}${url.hash}`
}

/**
 * The Union bar's app side: which tab a route is under (`unionHere`), and
 * the rules the app applies to the bar (`components/shared/UnionBarSlots.tsx`).
 * The shell's bar is marked for the route it is served on by the same decision
 * (`markUnionRoute`, `worker/shellMeta.ts`), so the right tab paints first.
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import { routeInApp } from './appBase'
import { pageOrigin } from './site'

/** The app's two tabs (ruleset §3.11), by their `data-tool` key: the Training Bay (`build`) and the Games (`play`). */
export type UnionMode = 'build' | 'play'

/**
 * Which tab a route (a path inside the app) is under: the Games for Your
 * Games, a Game's page and its Mediator's Cockpit, and an invite (which joins a
 * Game); the Training Bay for everything else, a pilot's Play mode among it
 * (ADR-066).
 */
export function unionHere(path: string): UnionMode {
  return path === '/games' || path.startsWith('/games/') ? 'play' : 'build'
}

/**
 * A page that knows better than its path: a pilot in a Game is that Game's, so
 * its sheet and its Play mode sit under the Games tab (glossary §9) though they
 * live at `/pilots/…`. The page says so while it is on screen (`useBarMode`);
 * `UnionBarSlots` reads it ahead of `unionHere`.
 */
export const useBarModeStore = create<{ mode: UnionMode | null }>(() => ({ mode: null }))

/** Hold the bar's tab at `mode` while this page is mounted; `null` leaves the path to decide. */
export function useBarMode(mode: UnionMode | null): void {
  useEffect(() => {
    if (mode === null) return
    useBarModeStore.setState({ mode })
    return () => useBarModeStore.setState({ mode: null })
  }, [mode])
}

/**
 * Mark the bar where you are, in place: the mark `markUnionRoute` gives the
 * shell, moved as the app routes. The bar wears the mode (`data-mode`, its
 * colour) and its tab is current.
 */
export function markUnionBar(bar: Element, mode: UnionMode): void {
  bar.setAttribute('data-mode', mode)
  for (const tab of bar.querySelectorAll<HTMLElement>('.su-union-bar__tab[data-tool]')) {
    if (tab.dataset.tool === mode) tab.setAttribute('aria-current', 'true')
    else tab.removeAttribute('aria-current')
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

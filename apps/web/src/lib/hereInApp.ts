import { routeInApp } from './appBase'

/** This page as a route in the app, query and all: where signing in returns. */
export function hereInApp(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const route = routeInApp(window.location.pathname)
  return route === null ? undefined : `${route}${window.location.search}`
}

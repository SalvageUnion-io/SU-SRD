import { basePathOf, SITE } from '../src/lib/site'

/** ITUN's base, `/build` (ADR-048): every page the specs open lives under it. */
export const BASE = basePathOf(SITE.base)

/**
 * An app route (`/pilots/new`) as the path the browser opens (`/build/pilots/new`).
 * Specs and helpers write routes as the app does, root-relative; this puts the
 * base in front, so `page.goto` resolves it against the origin either way
 * (`baseURL` is the origin: the local server, or `E2E_BASE_URL`).
 */
export function at(route: string): string {
  return `${BASE}${route}`
}

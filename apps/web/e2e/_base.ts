import { APP_BASE, appPath } from '../src/lib/appBase'

/** The app's base, `/build` (ADR-048): every page the specs open lives under it. */
export const BASE = APP_BASE

/**
 * An app route (`/pilots/new`) as the path the browser opens (`/build/pilots/new`,
 * or a Play route's own, `/play/`). Specs and helpers write routes as the app
 * does, root-relative; this puts each on the site (`appPath`), so `page.goto`
 * resolves it against the origin either way (`baseURL` is the origin: the
 * local server, or `E2E_BASE_URL`).
 */
export function at(route: string): string {
  return appPath(route)
}

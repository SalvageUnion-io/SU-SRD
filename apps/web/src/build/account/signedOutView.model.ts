/**
 * Signed-out views: what a screen shows a visitor with no account (the
 * Roster's front door, a `/…/new` route's sign-in panel), and what each needs
 * of the reference data, so that a first visit paints it without waiting for
 * the whole dataset.
 *
 * Signed out, a screen shows its view at once while the session settles when
 * this browser remembers no account (`readAccountHint`): it is almost always
 * what they will see. The build draws every view into the app's shell
 * (`astro/build/signedOutViews.tsx`), the shell's head script marks the one
 * the document opens on (`SIGNED_OUT_VIEW_ATTRIBUTE`), and the app's first
 * render replaces it with the live one (`main.tsx`).
 */

import { readAccountHint } from '../../lib/accountHint'
import { browserStorage } from '../../lib/accountState'
import { routeInApp } from '../../lib/appBase'
import type { SchemaList } from '../../lib/useGameData'
import type { SyncStatus } from '../../replica/sync'
import { FRONT_DOOR_SCHEMAS } from '../roster/frontDoor.model'

/**
 * Each route with a signed-out view, and the schemas that view reads: the
 * front door its proven few (`frontDoor.model.ts`), the sign-in panel none.
 */
export const SIGNED_OUT_VIEWS = {
  '/': FRONT_DOOR_SCHEMAS,
  '/pilots/new': [],
  '/mechs/new': [],
  '/crawlers/new': [],
  '/npcs/new': [],
} as const satisfies Record<string, readonly string[]>

export type SignedOutViewRoute = keyof typeof SIGNED_OUT_VIEWS

const isViewRoute = (route: string | null): route is SignedOutViewRoute =>
  route !== null && Object.hasOwn(SIGNED_OUT_VIEWS, route)

/** Whether a screen with a signed-out view shows it, for this connection. */
export function showsSignedOutView(status: SyncStatus, storage = browserStorage()): boolean {
  return status === 'signedOut' || (status === 'syncing' && readAccountHint(storage) === null)
}

/**
 * What the root holds the app's route (`route`) for (`GameDataReady`): its
 * signed-out view's schemas, else the whole dataset. A screen with such a view
 * waits for the rest itself when it shows anything else (`Roster`,
 * `NewEntityScreen`).
 */
export function routeSchemas(route: string): SchemaList {
  return isViewRoute(route) ? [...SIGNED_OUT_VIEWS[route]] : 'all'
}

/**
 * The signed-out view a document at `pathname` (a site path) opens on: its
 * route's, when it has one and this browser remembers no account; else null.
 */
export function signedOutViewAt(
  pathname: string,
  storage = browserStorage()
): SignedOutViewRoute | null {
  const route = routeInApp(pathname)
  return isViewRoute(route) && readAccountHint(storage) === null ? route : null
}

/**
 * What the app's first render at `pathname` waits on: the signed-out view's
 * schemas when it opens on one, else the whole dataset. The rest loads once
 * the route has (`main.tsx`), not beside it.
 */
export function firstPaintSchemas(pathname: string, storage = browserStorage()): SchemaList {
  const view = signedOutViewAt(pathname, storage)
  return view === null ? 'all' : [...SIGNED_OUT_VIEWS[view]]
}

/** Set on `<html>` by the shell's head script to the signed-out view's route the document opens on. */
export const SIGNED_OUT_VIEW_ATTRIBUTE = 'data-signed-out-view'

/** The class of each view the build draws into the shell, shown by `SIGNED_OUT_VIEW_ATTRIBUTE` (`styles/build/screens.css`). */
export const SIGNED_OUT_STATIC_CLASS = 'su-signed-out-static'

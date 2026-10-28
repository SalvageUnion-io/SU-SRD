/**
 * What the front door (`FrontDoor`) needs of the reference data: the Starter
 * Set's cards read their pilots' classes (with their ability trees) and their
 * mechs' chassis, and nothing else. The app's root holds the front door for
 * these alone, not the whole dataset (`GameDataReady`), so a visitor's first
 * paint waits on ~60 KB of data rather than all of it; the rest follows in the
 * background, for the route they open next.
 *
 * `__tests__/frontDoor.model.test.ts` renders the front door with only these
 * loaded and with everything, and fails when the two differ: a card that reads
 * a schema missing here degrades silently (`readReference`), so the list is
 * proven, not trusted.
 */

import { readAccountHint } from '../../lib/accountHint'
import { browserStorage } from '../../lib/accountState'
import { routeInApp } from '../../lib/appBase'

export const FRONT_DOOR_SCHEMAS: string[] = [
  'abilities',
  'ability-tree-requirements',
  'chassis',
  'classes',
]

/** Whether the app's route (`/`, the Roster) is the front door's. */
export const isRosterRoute = (route: string | null): boolean => route === '/'

/**
 * Whether this browser is likely to see the front door at `pathname` (a site
 * path): the Roster's address, and no account remembered here. Signed in, the
 * Roster is the player's Shelves, which need the whole dataset.
 */
export function expectsFrontDoor(pathname: string, storage = browserStorage()): boolean {
  return isRosterRoute(routeInApp(pathname)) && readAccountHint(storage) === null
}

/**
 * Set on `<html>` by the shell's head script (`FRONT_DOOR_SCRIPT`, `astro/build/frontDoor.tsx`) when the
 * document opens on the front door: it shows the front door the build
 * rendered into the shell (`astro/build/frontDoor.tsx`, `styles/build/screens.css`)
 * until the app's first render replaces it, and holds that render until the
 * front door can draw (`main.tsx`).
 */
export const FRONT_DOOR_ATTRIBUTE = 'data-front-door'

/** The class of the front door the build renders into the shell, shown by `FRONT_DOOR_ATTRIBUTE` (`styles/build/screens.css`). */
export const FRONT_DOOR_STATIC_CLASS = 'su-front-door-static'

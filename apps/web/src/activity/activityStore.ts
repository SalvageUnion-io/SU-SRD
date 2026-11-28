/**
 * The Discord Activity as the app sees it: whether the app runs as the
 * Activity, who signed in, who else is in it, how Discord shows the frame,
 * and the one way out of the frame (`openOutside`). The boot (`./ActivityBoot.tsx`)
 * fills it once the SDK has signed the player in; the root (`routes/__root`)
 * reads it to draw the Activity's shell in place of the site's.
 *
 * A module store, not React context: the shell, the routes and the link
 * handler all read it, and none of them sits inside another's tree.
 */

import { GAMES_ROOT } from 'game-domain/appAddress'
import { useSyncExternalStore } from 'react'
import type { ActivityPerson, LayoutMode } from './activitySession'

/** The Activity's home, where it opens: the Games at this table. */
export const ACTIVITY_HOME = `${GAMES_ROOT}/`

/** The signed-in Activity. */
export type ActivityState = {
  me: ActivityPerson
  people: readonly ActivityPerson[]
  layout: LayoutMode
  /** The channel Discord launched the Activity in; null outside one (or in the stand-in). */
  channelId?: string | null
  /** Discord's id for this run of the Activity, which the Worker checks the channel against. */
  instanceId?: string | null
  /** Opens a page in the player's browser, outside Discord (the SDK's `openExternalLink`). */
  openOutside: (url: string) => void
}

let state: ActivityState | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export const activityStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: (): ActivityState | null => state,
  /** The Activity signed in: the app runs as the Activity from here on. */
  start(next: ActivityState): void {
    state = next
    emit()
  },
  /** The Activity is over: the app is the site again (a test's clean slate). */
  stop(): void {
    state = null
    emit()
  },
  /** Who is in the Activity, or how Discord shows it, changed. */
  update(patch: Partial<Pick<ActivityState, 'people' | 'layout'>>): void {
    if (state === null) return
    state = { ...state, ...patch }
    emit()
  },
}

/** The signed-in Activity, or `null` on the site. */
export function useActivity(): ActivityState | null {
  return useSyncExternalStore(activityStore.subscribe, activityStore.get, activityStore.get)
}

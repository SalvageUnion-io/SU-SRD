/**
 * What crosses rooms, read and written the same way whichever server holds
 * it: public sheets and their previews, invite previews, Homebrew's standing
 * and moderation, and the patterns a crew shares. Each hook stands in for one
 * Convex query or mutation of the same name; the build's feed (`ROOM_FEED`)
 * picks Convex or the Worker's routes (`./paths.ts`), and the cutover deletes
 * the Convex half.
 */

import { useMutation, useQuery } from 'convex/react'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import { gameScope } from '../../replica/replica'
import { ROOM_FEED } from '../../replica/roomSocket'
import { useSharedByLinkRooms, useUnitSharedByLink } from '../../replica/sharedByLink'
import { useTableRead } from '../../replica/useTable'
import { refreshWorkerReads, useWorkerRead, workerWrite } from '../connection/workerRead'
import { SHARED_PATH, sharedPaths } from './paths'

type Answer<Q extends keyof typeof api.publicSheet> = FunctionReturnType<
  (typeof api.publicSheet)[Q]
>
type SheetKind = 'pilot' | 'mech' | 'crawler' | 'npc'

/** `publicSheet.get`: a shared sheet's page, null when it is not shared. */
export const usePublicSheet: (kind: SheetKind, appId: string) => Answer<'get'> | undefined =
  ROOM_FEED
    ? (kind, appId) => useWorkerRead(sharedPaths.sheet(kind, appId))
    : (kind, appId) => useQuery(api.publicSheet.get, { kind, appId })

/** `publicSheet.pattern`: a shared pattern's page. On the rooms, by link only; a crew's is `useCrewPatterns`'. */
export const usePublicPattern: (appId: string) => Answer<'pattern'> | undefined = ROOM_FEED
  ? (appId) => useWorkerRead(sharedPaths.sheet('pattern', appId))
  : (appId) => useQuery(api.publicSheet.pattern, { appId })

/** `publicSheet.preview`: what a shared thing's link preview says. */
export const useSheetPreview: (
  kind: FunctionArgs<typeof api.publicSheet.preview>['kind'],
  appId: string
) => Answer<'preview'> | undefined = ROOM_FEED
  ? (kind, appId) => useWorkerRead(sharedPaths.preview(kind, appId))
  : (kind, appId) => useQuery(api.publicSheet.preview, { kind, appId })

/** `publicSheet.invitePreview`: what an invite's preview may say. */
export const useInvitePreview: (code: string) => Answer<'invitePreview'> | undefined = ROOM_FEED
  ? (code) => useWorkerRead(sharedPaths.invite(code))
  : (code) => useQuery(api.publicSheet.invitePreview, { code })

type Homebrew = typeof api.homebrew

/** `homebrew.status`: one pattern's place in Homebrew, for the reader. */
export const useHomebrewStatus: (
  appId: string
) => FunctionReturnType<Homebrew['status']> | undefined = ROOM_FEED
  ? (appId) => useWorkerRead(sharedPaths.homebrew(appId))
  : (appId) => useQuery(api.homebrew.status, { appId })

/** `homebrew.moderation`: the site admin's queue, null for anyone else. */
export const useHomebrewModeration: () => FunctionReturnType<Homebrew['moderation']> | undefined =
  ROOM_FEED
    ? () => useWorkerRead(sharedPaths.moderation())
    : () => useQuery(api.homebrew.moderation)

/** `shelf.crewPatterns`: the patterns crewmates shared with the reader's Games; skipped with `live` false. */
export const useCrewPatterns: (
  live: boolean
) => FunctionReturnType<typeof api.shelf.crewPatterns> | undefined = ROOM_FEED
  ? (live) => useWorkerRead(live ? sharedPaths.crewPatterns() : null)
  : (live) => useQuery(api.shelf.crewPatterns, live ? {} : 'skip')

/** `shelf.sharedByLink`: which of the reader's sheets anyone with the link may read. */
export const useSharedByLink: () => readonly string[] | undefined = ROOM_FEED
  ? useSharedByLinkRooms
  : () => useQuery(api.shelf.sharedByLink, {})

/**
 * Whether one sheet is shared by link: on Convex, whether `publicSheet.get`
 * serves it; on the rooms, its own room's `publicRead`. Undefined while loading.
 */
export const useSheetIsPublic: (
  kind: SheetKind,
  appId: string,
  gameId: string | null
) => boolean | undefined = ROOM_FEED
  ? (_kind, appId, gameId) =>
      useUnitSharedByLink(gameId === null ? 'account' : gameScope(gameId), appId)
  : (kind, appId) => {
      const published = useQuery(api.publicSheet.get, { kind, appId })
      return published === undefined ? undefined : published !== null
    }

/** `shelf.patternSharing`: who may read each of the reader's patterns. */
export function usePatternSharing() {
  return useTableRead(api.shelf.patternSharing, {})
}

/** After a Homebrew write: every Homebrew read asks again, as Convex's would have re-run. */
function refreshHomebrew(): Promise<void> {
  return Promise.all([
    refreshWorkerReads(`${SHARED_PATH}/homebrew/`),
    refreshWorkerReads(sharedPaths.moderation()),
  ]).then(() => undefined)
}

/** `homebrew.report`. */
export const useHomebrewReport: () => (args: {
  appId: string
  reason: string
}) => Promise<unknown> = ROOM_FEED
  ? () =>
      async ({ appId, reason }) => {
        await workerWrite(sharedPaths.report(appId), { reason })
        await refreshHomebrew()
      }
  : () => useMutation(api.homebrew.report)

/** `homebrew.setHidden`: a site admin's. */
export const useHomebrewSetHidden: () => (args: {
  appId: string
  hidden: boolean
}) => Promise<unknown> = ROOM_FEED
  ? () =>
      async ({ appId, hidden }) => {
        const answer = await workerWrite(sharedPaths.hidden(appId), { hidden })
        await refreshHomebrew()
        return answer
      }
  : () => useMutation(api.homebrew.setHidden)

/** `homebrew.dismissReports`: a site admin's. */
export const useHomebrewDismiss: () => (args: { appId: string }) => Promise<unknown> = ROOM_FEED
  ? () =>
      async ({ appId }) => {
        await workerWrite(sharedPaths.dismiss(appId))
        await refreshHomebrew()
      }
  : () => useMutation(api.homebrew.dismissReports)

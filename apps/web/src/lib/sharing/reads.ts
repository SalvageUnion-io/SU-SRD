/**
 * What crosses rooms, read and written through the Worker's routes
 * (`./paths.ts`, `worker/sharedRoutes.ts`): public sheets and their previews,
 * invite previews, Homebrew's standing and moderation, and the patterns a
 * crew shares. A player's own sharing is their rooms': each sheet's
 * `publicRead`, each pattern's `sharing` record, and the acts that set them.
 */

import { useCallback, useSyncExternalStore } from 'react'
import type { PublicPatternAnswer } from '../../build/mech/Pattern/PublicPattern'
import type { PublicSheetAnswer } from '../../build/sheet/readOnlySheetStore.model'
import { gameScope } from '../../replica/replica'
import { roomOrStandIn } from '../../replica/roomSocket'
import { useSharedByLinkRooms, useUnitSharedByLink } from '../../replica/sharedByLink'
import { WritesBlockedOffline } from '../../replica/sync'
import { readTableState, subscribeTableState } from '../../replica/tableState'
import type { PatternSharing } from '../../rooms/account/sharing'
import type { CrewPattern } from '../../worker/shared/crewPatterns'
import type { Moderated } from '../../worker/shared/homebrew'
import { refreshWorkerReads, useWorkerRead, workerWrite } from '../connection/workerRead'
import type { InvitePreviewAnswer, PreviewAnswer, PreviewKind } from '../linkPreview/previewSummary'
import { SHARED_PATH, sharedPaths } from './paths'

type SheetKind = 'pilot' | 'mech' | 'crawler' | 'npc'

/** A shared sheet's page, as its room published it; null when it is not shared. */
export type PublicSheetPage = PublicSheetAnswer & {
  appId: string
  pilotAbilities?: string[]
  madeBy?: string
}

/** A pattern's page shared by link: its body not yet parsed. */
export type PublicPatternPage = Omit<PublicPatternAnswer, 'pattern'> & {
  appId: string
  body: unknown
}

/** One pattern's place in Homebrew, for the reader (`worker/sharedRoutes.ts`'s `standing`). */
export type HomebrewStatus = {
  listed: boolean
  hidden: boolean
  reported: boolean
  mine: boolean
  admin: boolean
}

/** The site admin's queue. */
export type HomebrewModeration = { reported: Moderated[]; hidden: Moderated[] }

/** A shared sheet's page, null when it is not shared. */
export function usePublicSheet(kind: SheetKind, appId: string): PublicSheetPage | null | undefined {
  return useWorkerRead(sharedPaths.sheet(kind, appId))
}

/** A pattern's page, shared by link; a crew's is `useCrewPatterns`'. */
export function usePublicPattern(appId: string): PublicPatternPage | null | undefined {
  return useWorkerRead(sharedPaths.sheet('pattern', appId))
}

/** What a shared thing's link preview says. */
export function useSheetPreview(
  kind: PreviewKind,
  appId: string
): PreviewAnswer | null | undefined {
  return useWorkerRead(sharedPaths.preview(kind, appId))
}

/** What an invite's preview may say. */
export function useInvitePreview(code: string): InvitePreviewAnswer | null | undefined {
  return useWorkerRead(sharedPaths.invite(code))
}

/** One pattern's place in Homebrew, for the reader. */
export function useHomebrewStatus(appId: string): HomebrewStatus | undefined {
  return useWorkerRead(sharedPaths.homebrew(appId))
}

/** The site admin's queue, null for anyone else. */
export function useHomebrewModeration(): HomebrewModeration | null | undefined {
  return useWorkerRead(sharedPaths.moderation())
}

/** The patterns crewmates shared with the reader's Games; not asked for with `live` false. */
export function useCrewPatterns(live: boolean): CrewPattern[] | undefined {
  return useWorkerRead(live ? sharedPaths.crewPatterns() : null)
}

/** Which of the reader's sheets anyone with the link may read. */
export const useSharedByLink: () => readonly string[] | undefined = useSharedByLinkRooms

/** Whether one sheet is shared by link: its own room's `publicRead`. Undefined while loading. */
export function useSheetIsPublic(appId: string, gameId: string | null): boolean | undefined {
  return useUnitSharedByLink(gameId === null ? 'account' : gameScope(gameId), appId)
}

/** Who may read each of the reader's patterns: their account room's `sharing` records. */
export function usePatternSharing(): (PatternSharing & { appId: string })[] | undefined {
  return useSyncExternalStore(
    subscribeTableState,
    () => readTableState('account', 'sharing') as (PatternSharing & { appId: string })[] | undefined
  )
}

/** One sharing act, sent to `gameId`'s room (the account room for null); refused offline. */
export function useSharingAct<A>(
  name: string,
  gameId: string | null
): (args: A) => Promise<unknown> {
  return useCallback(
    (args: A) => {
      const room = roomOrStandIn(gameId)
      return room === null ? Promise.reject(new WritesBlockedOffline()) : room.act(name, args)
    },
    [name, gameId]
  )
}

/** After a Homebrew write: every Homebrew read asks again, since nothing pushes them. */
function refreshHomebrew(): Promise<void> {
  return Promise.all([
    refreshWorkerReads(`${SHARED_PATH}/homebrew/`),
    refreshWorkerReads(sharedPaths.moderation()),
  ]).then(() => undefined)
}

/** Report a Homebrew listing. */
export function useHomebrewReport(): (args: { appId: string; reason: string }) => Promise<void> {
  return reportHomebrew
}

async function reportHomebrew({ appId, reason }: { appId: string; reason: string }) {
  await workerWrite(sharedPaths.report(appId), { reason })
  await refreshHomebrew()
}

/** Hide or show a Homebrew listing: a site admin's. */
export function useHomebrewSetHidden(): (args: {
  appId: string
  hidden: boolean
}) => Promise<{ hidden: boolean }> {
  return setHomebrewHidden
}

async function setHomebrewHidden({ appId, hidden }: { appId: string; hidden: boolean }) {
  const answer = await workerWrite<{ hidden: boolean }>(sharedPaths.hidden(appId), { hidden })
  await refreshHomebrew()
  return answer
}

/** Dismiss a listing's reports: a site admin's. */
export function useHomebrewDismiss(): (args: { appId: string }) => Promise<void> {
  return dismissHomebrew
}

async function dismissHomebrew({ appId }: { appId: string }) {
  await workerWrite(sharedPaths.dismiss(appId))
  await refreshHomebrew()
}

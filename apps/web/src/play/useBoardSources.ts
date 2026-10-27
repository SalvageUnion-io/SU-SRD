/**
 * useGameBoardSources — what the Board menu reads from the pilot's Game
 * (`boardMenu.model.ts`; play.md §3).
 *
 * The menu lists mechs that are not the viewer's (a crewmate's, an unassigned
 * spare), which never reach this browser's entity store, so it reads the Game
 * the way the roster does: `entities.listForGame` for every mech, its owner
 * and the crawler links, `seats.forGame` for who is aboard what (the same
 * subscription `useSeat` holds), and `useViewerId` for who "yours" is.
 *
 * Until the answers arrive, the menu knows only the assigned mech.
 */

import { useGamesQuery, useViewerId } from '../replica/roomCalls'
import { isSignedIn } from '../replica/sync'
import { useSync } from '../replica/syncContext'
import { useTableRead } from '../replica/useTable'
import type { BoardSources } from './boardMenu.model'

/** One Game's board sources; with no Game, nothing is read. */
export function useGameBoardSources(gameId: string | null): BoardSources {
  const { status } = useSync()
  const signedIn = isSignedIn(status)
  const inGame = signedIn && gameId !== null ? { gameId } : 'skip'

  const viewerId = useViewerId()
  const listing = useGamesQuery(
    'entities.listForGame',
    inGame === 'skip' ? 'skip' : { gameId: inGame.gameId }
  )
  const seats = useTableRead('seats.forGame', inGame)

  return { listing: listing ?? null, seats: seats ?? [], viewerId }
}

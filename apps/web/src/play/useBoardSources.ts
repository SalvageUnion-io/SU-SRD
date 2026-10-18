/**
 * useGameBoardSources — what the Board menu reads from the pilot's Game
 * (`boardMenu.model.ts`; play.md §3).
 *
 * The menu lists mechs that are not the viewer's (a crewmate's, an unclaimed
 * spare), which never reach this browser's entity store, so it reads the Game
 * the way the roster does: `entities.listForGame` for every mech, its owner
 * and the crawler links, `seats.forGame` for who is aboard what (the same
 * subscription `useSeat` holds), and `account.me` for who "yours" is.
 *
 * Until the answers arrive, the menu knows only the assigned mech.
 */

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useConnection } from '../lib/connection/connectionContext'
import type { BoardSources } from './boardMenu.model'

/** One Game's board sources; with no Game, nothing is read. */
export function useGameBoardSources(gameId: Id<'games'> | null): BoardSources {
  const { mode } = useConnection()
  const signedIn = mode === 'connected' || mode === 'disconnected'
  const inGame = signedIn && gameId !== null ? { gameId } : 'skip'

  const me = useQuery(api.account.me, inGame === 'skip' ? 'skip' : {})
  const listing = useQuery(api.entities.listForGame, inGame)
  const seats = useQuery(api.seats.forGame, inGame)

  return { listing: listing ?? null, seats: seats ?? [], viewerId: me?._id ?? null }
}

/**
 * useBoardSources — what the Board menu reads from the pilot's Game
 * (`boardMenu.ts`; docs/architecture/dashboard-redesign.md D4).
 *
 * The menu lists mechs that are not the viewer's (a crewmate's, an unclaimed
 * spare), which never reach this browser's entity store, so it reads the Game
 * the way the roster does: `entities.listForGame` for every mech, its owner
 * and the crawler links, `seats.forGame` for who is aboard what (the same
 * subscription `useSeat` holds), and `account.me` for who "yours" is.
 *
 * Needs a Convex provider, like `useSeat`: call it only when
 * `isConvexConfigured`, and use `NO_BOARD_SOURCES` otherwise. Until the answers
 * arrive, the menu knows only the assigned mech.
 */

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { containerOf } from '../../lib/container'
import type { Pilot } from '../../lib/schemas/pilot'
import type { BoardSources } from './boardMenu'

export function useBoardSources(pilot: Pilot | null): BoardSources {
  const { mode } = useConnection()
  const container = pilot === null ? null : containerOf(pilot)
  const gameId = container?.kind === 'game' ? (container.gameId as Id<'games'>) : null
  const signedIn = mode === 'connected' || mode === 'disconnected'
  const inGame = signedIn && gameId !== null ? { gameId } : 'skip'

  const me = useQuery(api.account.me, signedIn ? {} : 'skip')
  const listing = useQuery(api.entities.listForGame, inGame)
  const seats = useQuery(api.seats.forGame, inGame)

  return { listing: listing ?? null, seats: seats ?? [], viewerId: me?._id ?? null }
}

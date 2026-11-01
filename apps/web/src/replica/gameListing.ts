/**
 * A Game's units and links as its room serves them to the replica: every
 * pilot, mech and NPC with its owner, every crawler, every link between them,
 * and the primary crawler. The Game socket's snapshot is the one source
 * (ADR-064 decision 2), so this is a selector over the Game's scope, not a
 * second copy: undefined until the room's first snapshot.
 *
 * Crewmates' units are held on the device like the player's own, so a Game
 * read offline shows what the last load held (`persist.ts`). The primary
 * crawler is a live table record (`tableState.ts`), so offline it is unknown
 * and the listing waits for the room.
 */

import type { SoftLink } from 'game-domain/schemas/softLink'
import { useSyncExternalStore } from 'react'
import type { ServerCrawler, ServerOwnable } from '../lib/games/gameRoster'
import type { Scope } from './replica'
import { gameScope, getView, rowsOf, subscribe } from './replica'
import { readTableState, subscribeTableState } from './tableState'

/** A Game's units, links and primary crawler, as the screens that list a Game read them. */
export type GameListing = {
  pilots: ServerOwnable[]
  mechs: ServerOwnable[]
  crawlers: ServerCrawler[]
  npcs: ServerOwnable[]
  softLinks: SoftLink[]
  primaryCrawlerId: string | null
}

function owned(scope: Scope, table: 'pilot' | 'mech' | 'npc'): ServerOwnable[] {
  return rowsOf(scope, table).map(({ row, owner }) => ({
    _id: row.id,
    appId: row.id,
    ownerId: owner,
    body: row,
  }))
}

/** The Game's listing from the replica, or undefined before its room's snapshot. */
export function readGameListing(gameId: string): GameListing | undefined {
  const scope = gameScope(gameId)
  const game = readTableState(scope, 'game') as
    | { primaryCrawlerId?: string | null }
    | null
    | undefined
  if (game === undefined) return undefined
  return {
    pilots: owned(scope, 'pilot'),
    mechs: owned(scope, 'mech'),
    npcs: owned(scope, 'npc'),
    crawlers: rowsOf(scope, 'crawler').map(({ row }) => ({
      _id: row.id,
      appId: row.id,
      body: row,
    })),
    softLinks: rowsOf(scope, 'softLink').map(({ row }) => row),
    primaryCrawlerId: game?.primaryCrawlerId ?? null,
  }
}

/** Each Game's listing as last made, with what it was made from: stable between changes. */
const made = new Map<string, { view: object; game: unknown; listing: GameListing | undefined }>()

function stableListing(gameId: string): GameListing | undefined {
  const view = getView()
  const game = readTableState(gameScope(gameId), 'game')
  const last = made.get(gameId)
  if (last !== undefined && last.view === view && last.game === game) return last.listing
  const listing = readGameListing(gameId)
  made.set(gameId, { view, game, listing })
  return listing
}

function subscribeBoth(listener: () => void): () => void {
  const off = subscribe(listener)
  const offState = subscribeTableState(listener)
  return () => {
    off()
    offState()
  }
}

/** The Game's listing (`gameId` null: none asked), live from the replica. */
export function useGameListing(gameId: string | null): GameListing | undefined {
  return useSyncExternalStore(subscribeBoth, () =>
    gameId === null ? undefined : stableListing(gameId)
  )
}

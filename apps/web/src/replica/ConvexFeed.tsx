/**
 * The replica's feed until the cutover: Convex's live queries, each answer
 * served as one scope's snapshot (`replica.serve`). From the cutover the
 * account and Game room sockets send the same snapshots (`rooms/protocol.ts`)
 * and this file goes.
 *
 *  - `entities.listMine` is the `account` scope: what the caller owns.
 *  - `shelf.encounters` is `account` too: the Mediator's own encounters.
 *  - `entities.listWiring` is the `wiring` scope: every link the caller can
 *    see and the crawlers of their Games, each stamped with its row's Game
 *    (the column is the authority; a template-seeded body names none).
 *
 * Every open tab mounts its own feed, so this is also how one tab hears
 * another's writes: the write reaches Convex and each tab's query re-emits.
 * Mounted by `ReplicaSync` while live.
 */

import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'
import type { ServedLink, ServedRow } from '../lib/links/linkSync'
import { rowVersion, softLinkFromServer } from '../lib/links/linkSync'
import type { Served, Table } from './replica'
import { serve } from './replica'

type Versioned = ServedRow & { headSeq?: number }

function served<T extends Table>(table: T, rows: readonly Versioned[]): Served[] {
  return rows.map((r) => ({
    table,
    row: r.body,
    version: rowVersion(r),
    ...(r.headSeq === undefined ? {} : { headSeq: r.headSeq }),
  }))
}

function MineFeed() {
  // `undefined` while in flight: the Convex convention, not a loading flag.
  const mine = useQuery(api.entities.listMine, {})
  useEffect(() => {
    if (mine === undefined) return
    serve(
      'account',
      ['pilot', 'mech', 'crawler', 'npc', 'mechPattern', 'encounterNpc'],
      [
        ...served('pilot', mine.pilots),
        ...served('mech', mine.mechs),
        ...served('crawler', mine.crawlers),
        ...served('npc', mine.npcs),
        ...served('mechPattern', mine.mechPatterns),
        ...served('encounterNpc', mine.encounterNpcs),
      ]
    )
  }, [mine])
  return null
}

function EncounterFeed() {
  const encounters = useQuery(api.shelf.encounters, {})
  useEffect(() => {
    if (encounters === undefined) return
    serve('account', ['encounter'], served('encounter', encounters as Versioned[]))
  }, [encounters])
  return null
}

function WiringFeed() {
  const wiring = useQuery(api.entities.listWiring, {})
  useEffect(() => {
    if (wiring === undefined) return
    serve(
      'wiring',
      ['crawler', 'softLink'],
      [
        ...wiring.crawlers.map((c) => ({
          table: 'crawler' as const,
          row: { ...(c.body as Record<string, unknown>), gameId: c.gameId },
          version: c.updatedAt,
        })),
        ...(wiring.softLinks as ServedLink[]).map((l) => ({
          table: 'softLink' as const,
          row: softLinkFromServer(l),
          version: l._creationTime,
        })),
      ]
    )
  }, [wiring])
  return null
}

export function ConvexFeed() {
  return (
    <>
      <MineFeed />
      <EncounterFeed />
      <WiringFeed />
    </>
  )
}

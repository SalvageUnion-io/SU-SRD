/**
 * A unit's history for its sheet's change log, as `changeLog.forEntity`
 * answered it. While the rooms feed the replica it is an act on the room the
 * unit lives in (its Game's, or the account room's on the Shelf), asked again
 * whenever the unit's head moves; until the room answers it is undefined.
 */

import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { EntityRef } from 'game-domain/schemas/entity'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '../../convex/_generated/api'
import type { Table } from './replica'
import { headSeqOf, row, subscribe, TABLES } from './replica'
import { ROOM_FEED, roomOf } from './roomSocket'

type Entries = FunctionReturnType<typeof api.changeLog.forEntity>
type EntityLog = (entityType: EntityRef['type'], entityId: string) => Entries | undefined

const useConvexEntityLog: EntityLog = (entityType, entityId) =>
  useQuery(api.changeLog.forEntity, { entityType, entityId })

/** Where the unit is and how far its history goes, or null when the replica does not hold it. */
function placeOf(table: Table | null, entityId: string): string | null {
  const held = table === null ? null : row(table, entityId)
  if (table === null || held === null) return null
  const gameId = (held as { gameId?: string | null }).gameId ?? ''
  return `${gameId}\u0000${headSeqOf(table, entityId) ?? 0}`
}

const useRoomEntityLog: EntityLog = (entityType, entityId) => {
  const table = (TABLES as readonly string[]).includes(entityType) ? (entityType as Table) : null
  const place = useSyncExternalStore(subscribe, () => placeOf(table, entityId))
  const [entries, setEntries] = useState<Entries | undefined>(undefined)
  useEffect(() => {
    if (place === null) return setEntries([])
    const room = roomOf(place.split('\u0000')[0] || null)
    if (room === null) return
    let current = true
    room.act('changeLog.forEntity', { entityId }).then(
      (answer) => current && setEntries(answer as Entries),
      () => current && setEntries([])
    )
    return () => {
      current = false
    }
  }, [place, entityId])
  return entries
}

export const useEntityLog: EntityLog = ROOM_FEED ? useRoomEntityLog : useConvexEntityLog

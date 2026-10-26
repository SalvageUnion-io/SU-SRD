/**
 * A unit's history for its sheet's change log (`changeLog.forEntity`): an act
 * on the room the unit lives in (its Game's, or the account room's on the
 * Shelf), asked again whenever the unit's head moves; until the room answers
 * it is undefined, and a unit the replica does not hold has none.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { EntityLogRow } from '../rooms/ops'
import type { Table } from './replica'
import { headSeqOf, row, subscribe, TABLES } from './replica'
import { roomOf } from './roomSocket'

/** Where the unit is and how far its history goes, or null when the replica does not hold it. */
function placeOf(table: Table | null, entityId: string): string | null {
  const held = table === null ? null : row(table, entityId)
  if (table === null || held === null) return null
  const gameId = (held as { gameId?: string | null }).gameId ?? ''
  return `${gameId}\u0000${headSeqOf(table, entityId) ?? 0}`
}

export function useEntityLog(entityType: string, entityId: string): EntityLogRow[] | undefined {
  const table = (TABLES as readonly string[]).includes(entityType) ? (entityType as Table) : null
  const place = useSyncExternalStore(subscribe, () => placeOf(table, entityId))
  const [entries, setEntries] = useState<EntityLogRow[] | undefined>(undefined)
  useEffect(() => {
    if (place === null) return setEntries([])
    const room = roomOf(place.split('\u0000')[0] || null)
    if (room === null) return
    let current = true
    room.act('changeLog.forEntity', { entityId }).then(
      (answer) => current && setEntries(answer as EntityLogRow[]),
      () => current && setEntries([])
    )
    return () => {
      current = false
    }
  }, [place, entityId])
  return entries
}

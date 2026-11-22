/**
 * What a player is told when a pilot or mech in a Game stops being theirs
 * (MD-23): the table runner unassigned it, or assigned it to somebody else
 * (ADR-030 §4). Without it their open sheet just turns read-only.
 *
 * The Game's room serves each unit with who holds it, so this compares one
 * serving of a Game's pilots and mechs with the next (`useAssignmentNotices`,
 * mounted with each Game's feed). One the player handed back themselves
 * (`handedBack`, the roster's Unassign) is not news to them.
 */

import { useEffect, useRef } from 'react'
import { toast } from '../../components/containers/toast'
import { libGamesCopy } from '../../messages/lib-games'
import { gameScope, rowsOf, subscribe } from '../../replica/replica'
import { useViewerId } from '../../replica/roomCalls'

/** A Game's pilot or mech, and who its room says holds it. */
export type HeldUnit = { kind: 'pilot' | 'mech'; id: string; name: string; owner: string | null }

/** Units the player just handed back, on or took themselves: their own doing, so not announced. */
const ownDoing = new Set<string>()

/** The player is unassigning, reassigning or taking `unitId` themselves; call the answer if it did not happen. */
export function handedBack(unitId: string): () => void {
  ownDoing.add(unitId)
  return () => {
    ownDoing.delete(unitId)
  }
}

/**
 * One line for each unit that was `me`'s in `before` and is still here, held
 * by another or nobody; and one for each that was here, not `me`'s, and now
 * is (r3 A4): whoever runs the table assigned it to them.
 */
export function assignmentNotices(
  before: readonly HeldUnit[],
  now: readonly HeldUnit[],
  me: string | null
): string[] {
  if (me === null) return []
  const mine = new Set(before.filter((u) => u.owner === me).map((u) => u.id))
  const others = new Set(before.filter((u) => u.owner !== me).map((u) => u.id))
  return now.flatMap((unit) => {
    if (others.has(unit.id) && unit.owner === me) {
      return ownDoing.delete(unit.id) ? [] : [libGamesCopy('assignedToYou', { name: unit.name })]
    }
    if (!mine.has(unit.id) || unit.owner === me) return []
    if (ownDoing.delete(unit.id)) return []
    return [
      unit.owner === null
        ? libGamesCopy('unassignedFromYou', { name: unit.name })
        : libGamesCopy('assignedToACrewmate', { name: unit.name }),
    ]
  })
}

function heldIn(gameId: string): HeldUnit[] {
  return (['pilot', 'mech'] as const).flatMap((kind) =>
    rowsOf(gameScope(gameId), kind).map(({ row, owner }) => ({
      kind,
      id: row.id,
      name: row.name,
      owner,
    }))
  )
}

/** Toast each assignment the player loses in `gameId` while this is mounted. */
export function useAssignmentNotices(gameId: string): void {
  const me = useViewerId()
  const before = useRef<HeldUnit[] | null>(null)
  useEffect(() => {
    before.current = heldIn(gameId)
    return subscribe(() => {
      const now = heldIn(gameId)
      for (const line of assignmentNotices(before.current ?? [], now, me)) toast.info(line)
      before.current = now
    })
  }, [gameId, me])
}

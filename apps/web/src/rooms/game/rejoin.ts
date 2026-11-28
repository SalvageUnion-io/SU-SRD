/**
 * Rejoining brings your units back (r6 C7, ADR-063 §7): when the Organiser
 * removes a member, the room notes in its change log (a `left` row, the
 * member as its actor) which of their units left with them (`moved`, handed to
 * their Training Bay) and which the Game came with and kept, unassigned
 * (`kept`). When they join again, the Worker hands the moved ones back
 * (`worker/shared/rejoin.ts`), the room assigns them the kept ones still free,
 * and a `returned` row closes the note. No table or column of its own:
 * the newest of a member's `left` and `returned` rows says what is owed.
 */

import type { GameStore } from './store'
import type { GameUnits } from './units'

/** What left the Game with a removed member. */
export type LeftUnits = { moved: string[]; kept: string[] }

const NONE: LeftUnits = { moved: [], kept: [] }

function write(
  store: GameStore,
  field: 'left' | 'returned',
  userId: string,
  after: object,
  at: number
) {
  store.rows(
    'insert into change_log (id, field, after, source, actor_id, ts) values (?, ?, ?, ?, ?, ?)',
    crypto.randomUUID(),
    field,
    JSON.stringify(after),
    'membership',
    userId,
    at
  )
}

/** Note what left the Game with `userId`, removed. */
export function noteLeft(store: GameStore, userId: string, left: LeftUnits, at: number): void {
  if (left.moved.length === 0 && left.kept.length === 0) return
  write(store, 'left', userId, left, at)
}

/** What is owed `userId` on rejoining: their last removal's units, unless already returned. */
export function owedTo(store: GameStore, userId: string): LeftUnits {
  const row = store.rows(
    `select field, after from change_log where field in ('left', 'returned') and actor_id = ?
     order by ts desc, id desc limit 1`,
    userId
  )[0]
  if (row?.field !== 'left') return NONE
  const after = JSON.parse(String(row.after)) as Partial<LeftUnits>
  return { moved: after.moved ?? [], kept: after.kept ?? [] }
}

/**
 * Close the note for `userId`, now a member again: each kept unit still
 * unassigned is theirs again; `moved` are the ones the Worker handed back.
 * Answers every unit that came back, for the table's line.
 */
export function noteReturned(
  store: GameStore,
  units: GameUnits,
  userId: string,
  moved: readonly string[],
  at: number
): string[] {
  return store.sql.transaction(() => {
    if (store.member(userId) === null) return []
    const owed = owedTo(store, userId)
    const kept = owed.kept.flatMap((id) => {
      const unit = store.unit(id)
      if (unit === null || unit.ownerId !== null) return []
      units.reassign(unit, userId, userId, at)
      return [id]
    })
    const back = [...moved.filter((id) => store.unit(id) !== null), ...kept]
    write(store, 'returned', userId, { units: back }, at)
    return back
  })
}

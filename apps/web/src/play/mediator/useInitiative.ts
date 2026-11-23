/**
 * useInitiative — the Group Initiative tracker on Mediate (r6 B4): the room's
 * one record of it (`mediator.initiative`), and the Mediator's moves on it.
 * Each move sends the whole tracker; a refusal is said, and nothing waits on
 * it (a marker, as Give the turn is).
 */

import type { Initiative } from '../../lib/rules/initiative'
import { withActed } from '../../lib/rules/initiative'
import { useTableAct, useTableRead } from '../../replica/useTable'

export type InitiativeTracker = {
  /** The tracker kept; null when none is (or while it loads). */
  initiative: Initiative | null
  /** Keep it as moved, or end it with null. */
  set: (next: Initiative | null) => void
  /** Mark one seat or unit as having acted this round, or not. */
  setActed: (id: string, acted: boolean) => void
}

export function useInitiative(
  gameId: string,
  onFailure: (err: unknown) => void
): InitiativeTracker {
  const initiative = useTableRead('mediator.initiative', { gameId }) ?? null
  const send = useTableAct('mediator.setInitiative', gameId)
  const set = (next: Initiative | null) => {
    send({ initiative: next }).catch(onFailure)
  }
  return {
    initiative,
    set,
    setActed: (id, acted) => {
      if (initiative !== null) set(withActed(initiative, id, acted))
    },
  }
}

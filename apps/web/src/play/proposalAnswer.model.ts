/**
 * A proposal as the player it awaits reads and answers it, wherever that is
 * (the pinned notice, Play's Feed, the Game page's inbox).
 *
 *  - `proposalChange`: "HP 7 → 0", from what the sheet holds now (the room
 *    says, `ops.pending`'s `current`) to what the proposal asks, so a player
 *    sees the size of it before answering (r2 C7). With no current value, only
 *    what it asks ("HP → 0").
 *  - `acceptedUndo`: an accepted proposal says itself with Undo, as every
 *    other change of a live number does (`changeUndoToast`, r2 C6): the player
 *    who accepted it writes back what the sheet held.
 */

import { fieldLabel, proposalValueText } from 'game-domain/games/proposals'
import { changeUndoToast } from '../lib/changeUndoToast'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_UNDO } from '../replica/provenance'
import { useUnits } from '../replica/units'
import type { ProposalRead } from '../rooms/game/proposals'

type Asked = Pick<ProposalRead, 'field' | 'after' | 'current'>

/**
 * A vital accepted down to 0, or back up, says what is due (`zeroVital.model`).
 * Fetched when a proposal is answered: the root's notices read this file, and
 * every page would otherwise carry Play's Feed and tables.
 */
function noticeZero(kind: 'pilot' | 'mech', id: string, field: string, from: number, to: number) {
  void import('./zeroVital.model').then((m) =>
    m.zeroVitalNotice(m.zeroUnit(useUnits.getState(), kind, id), field, from, to)
  )
}

const show = proposalValueText

/** "HP 7 → 0", or "HP → 0" when the room gave no current value. */
export function proposalChange(p: Asked): string {
  const from = typeof p.current === 'number' ? ` ${p.current}` : ''
  return `${fieldLabel(p.field)}${from} → ${show(p.after)}`
}

/**
 * The accepted proposal's line with Undo: "Accepted · HP 7 → 0 · Undo". Only
 * for a number on a pilot or mech the room read a current value for.
 */
export function acceptedUndo(
  p: Pick<ProposalRead, 'entityId' | 'entityType' | 'field' | 'after' | 'current'>
): void {
  const { entityType: kind, entityId: id, field, after, current } = p
  if (kind !== 'pilot' && kind !== 'mech') return
  if (typeof after !== 'number' || typeof current !== 'number') return
  changeUndoToast({
    // The vital's own line (`PlayCockpit`'s key): a step after it replaces this one.
    id: `${kind}:${id}:${field}`,
    label: fieldLabel(field),
    from: current,
    to: after,
    did: playCopy('accepted'),
    undo: (value) => {
      runWrite(() => useUnits.getState().update(kind, id, { [field]: value }, PLAY_UNDO))
      noticeZero(kind, id, field, after, value)
    },
  })
  // Accepted down to 0 SP or 0 HP: what is due next (r4 A5).
  noticeZero(kind, id, field, current, after)
}

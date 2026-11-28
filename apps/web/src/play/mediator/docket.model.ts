/**
 * The Mediator's Docket (ADR-068 §5): what the table is waiting on, as
 * tickets taken in any order. Morale due and To act are the Opposition's
 * (a ticket opens that NPC's box); Awaiting answer is a proposal sent and not
 * yet answered; a seat owes a Heat Check at its Heat Capacity; Asked is a
 * roll the Mediator asked of a seat, with Withdraw. Pure, read off what the
 * Mediator's screen already holds: the room serves it to no one else.
 */

import { groupMoraleDue, moraleDue } from '../../lib/rules/opposition'
import type { RollAsk } from '../../rooms/game/scene'
import type { CrewVitals } from '../useGameFeed'
import type { MediatorSeat } from './mediatorTable.model'
import type { TrayNpc } from './opposition.model'
import { trayEntries } from './opposition.model'
import type { SentProposal } from './proposalLine.model'
import { proposalLine } from './proposalLine.model'

export type DocketTicket =
  /** An NPC, or a group, whose Morale check the book calls for (Core Book p.268). */
  | { kind: 'morale'; key: string; name: string; npcId: string }
  /** An NPC still to act this round, while Group Initiative is kept. */
  | { kind: 'toAct'; key: string; name: string; npcId: string }
  /** A proposal sent, waiting on its player's answer. */
  | { kind: 'awaiting'; key: string; line: string }
  /** A seat's Heat Check, due at its Mech's Heat Capacity. */
  | { kind: 'owes'; key: string; seat: string }
  /** A roll the Mediator asked of a seat. */
  | { kind: 'asked'; key: string; seat: string; pilotId: string; table: string }

export function docketOf({
  npcs,
  acted,
  sent,
  crew,
  seats,
  asks,
  grouping,
}: {
  npcs: readonly TrayNpc[]
  /** Who has acted this round; null while no Group Initiative is kept. */
  acted: readonly string[] | null
  sent: readonly SentProposal[]
  crew: CrewVitals | null
  seats: readonly Pick<MediatorSeat, 'pilotId' | 'name'>[]
  asks: readonly RollAsk[]
  /** The encounter sheet's groups and Morale (`encounterSheet`). */
  grouping: boolean
}): DocketTicket[] {
  const morale: DocketTicket[] = []
  if (grouping) {
    for (const entry of trayEntries(npcs)) {
      if (entry.kind === 'alone') {
        if (moraleDue(entry.npc)) {
          morale.push({
            kind: 'morale',
            key: `morale:${entry.npc.id}`,
            name: entry.npc.name,
            npcId: entry.npc.id,
          })
        }
        continue
      }
      const standing = entry.members.find((m) => !m.down)
      if (standing !== undefined && groupMoraleDue(entry.members)) {
        morale.push({
          kind: 'morale',
          key: `morale:${entry.id}`,
          name: entry.name,
          npcId: standing.id,
        })
      }
    }
  }
  const toAct: DocketTicket[] =
    acted === null
      ? []
      : npcs
          .filter((npc) => !npc.down && !acted.includes(npc.id))
          .map((npc) => ({ kind: 'toAct', key: `act:${npc.id}`, name: npc.name, npcId: npc.id }))
  const awaiting: DocketTicket[] = sent
    .filter((p) => p.state === 'proposed')
    .map((p) => ({ kind: 'awaiting', key: `op:${p._id}`, line: proposalLine(p) }))
  const named = new Map(seats.map((s) => [s.pilotId, s.name]))
  return [...morale, ...toAct, ...awaiting, ...owedHeat(crew, named), ...asked(asks, named)]
}

/** Each boarded seat whose Mech stands at its Heat Capacity. */
function owedHeat(crew: CrewVitals | null, named: ReadonlyMap<string, string>): DocketTicket[] {
  if (crew === null) return []
  const mechs = new Map(crew.mechs.map((m) => [m.linkId, m]))
  return crew.pilots.flatMap((pilot) => {
    const seat = pilot.linkId === null ? undefined : named.get(pilot.linkId)
    const mech = pilot.mechId === null ? undefined : mechs.get(pilot.mechId)
    if (seat === undefined || !pilot.boarded || mech === undefined) return []
    if (mech.status?.overheating !== true) return []
    return [{ kind: 'owes' as const, key: `heat:${pilot.linkId}`, seat }]
  })
}

function asked(asks: readonly RollAsk[], named: ReadonlyMap<string, string>): DocketTicket[] {
  return asks.map((ask) => ({
    kind: 'asked',
    key: `ask:${ask.pilotId}`,
    seat: named.get(ask.pilotId) ?? '',
    pilotId: ask.pilotId,
    table: ask.table,
  }))
}

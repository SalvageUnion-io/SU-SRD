/**
 * Mediate's Group Initiative sides (r6 B4), read off the screen's own state:
 * its seats, then the tray's units standing (`initiativeSides`). The groups
 * are the encounter sheet's (`encounterSheet`): without it the opposition is
 * one side.
 */

import { flagOn } from '../../lib/flags'
import type { InitiativeSide } from '../../lib/rules/initiative'
import { initiativeSides } from '../../lib/rules/initiative'
import { mediatorCopy } from '../../messages/play-mediator'
import type { PlayMediator } from './usePlayMediator'

export function mediatorSides(mediator: Pick<PlayMediator, 'seats' | 'npcs'>): InitiativeSide[] {
  const grouping = flagOn('encounterSheet')
  return initiativeSides(
    mediator.seats.map((seat) => ({ id: seat.pilotId, name: seat.name })),
    (mediator.npcs ?? []).map((npc) => ({ ...npc, group: grouping ? npc.group : null })),
    { pilots: mediatorCopy('pilotsSide'), opposition: mediatorCopy('oppositionSide') }
  )
}

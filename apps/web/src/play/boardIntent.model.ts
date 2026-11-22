/**
 * The board a door asks for (r6 A10): Play solo from a Mech's sheet opens with
 * that Mech boarded. The door records it (`askToBoard`) and goes to the
 * pilot's Play; the Cockpit boards it once it can (`useBoardOnArrival`), and
 * the ask is spent then, or when it cannot be kept (someone else's Mech, a
 * Downtime running, no writes).
 */

import { useEffect } from 'react'
import type { Play } from './situation.model'

let asked: { pilotId: string; mechId: string } | null = null

/** Ask Play to open on this pilot boarded in this Mech. */
export function askToBoard(pilotId: string, mechId: string): void {
  asked = { pilotId, mechId }
}

/** Board the Mech a door asked for, once, when the Cockpit can. */
export function useBoardOnArrival(play: Play): void {
  const pilotId = play.pilot?.id ?? null
  const option =
    asked === null || asked.pilotId !== pilotId
      ? null
      : (play.mechs.find((mech) => mech.mechId === asked?.mechId) ?? null)
  const boardedId = play.situation === 'boarded' ? (play.boardedMech?.id ?? null) : null
  const running = play.downtime.downtime.running
  useEffect(() => {
    if (asked === null || pilotId === null) return
    if (asked.pilotId !== pilotId) {
      asked = null
      return
    }
    if (option === null) return
    asked = null
    if (boardedId === option.mechId) return
    if (option.state === 'yours' && play.canWrite && !running) play.board(option.mechId)
  }, [pilotId, option, boardedId, running, play])
}

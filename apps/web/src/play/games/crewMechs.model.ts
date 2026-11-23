/**
 * Which Mech each Pilot of a Game is listed with (r8 C5, LG8-09), the one
 * rule the Game page's Crew and the Games card read: a Mech is listed once,
 * under one Pilot. A Pilot aboard a Mech has it. Otherwise a Pilot has its
 * assigned Mech (`mech-to-pilot`) only while nobody else is aboard it and
 * both are held alike, so a pregen's spare taken by another player (Assign
 * and board, which draws no link: ADR-038 §5) leaves its old Pilot's line.
 */

/** A Pilot's place: whose it is, the Mech it is aboard, else the one assigned to it. */
export type PilotMechSource = {
  id: string
  ownerId: string | null
  boarded: boolean
  /** Aboard: that Mech; on foot: the one assigned to it; null for none. */
  mechId: string | null
}

/**
 * Each Pilot's listed Mech by its id, null for none. `ownerOfMech` is the
 * Mech's holder (null for free), undefined for a Mech the Game does not hold.
 */
export function pilotMechs(
  pilots: readonly PilotMechSource[],
  ownerOfMech: (mechId: string) => string | null | undefined
): Map<string, string | null> {
  const aboard = new Set(pilots.flatMap((p) => (p.boarded && p.mechId !== null ? [p.mechId] : [])))
  const out = new Map<string, string | null>()
  for (const p of pilots) {
    if (p.mechId === null) out.set(p.id, null)
    else if (p.boarded) out.set(p.id, p.mechId)
    else {
      const owner = ownerOfMech(p.mechId)
      const theirs = !aboard.has(p.mechId) && (owner === undefined || owner === p.ownerId)
      out.set(p.id, theirs ? p.mechId : null)
    }
  }
  return out
}

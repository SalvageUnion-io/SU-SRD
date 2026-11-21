/**
 * The pilot a new mech in a Game is plainly for: the member's one pilot there
 * with no mech. Two such pilots, or none, and nobody can say whose it is, so
 * nothing is assumed (the Crew's "Assign to a Pilot…" asks instead).
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { useUnits } from '../../replica/units'
import { assignLink } from './assignLink'

type Held = { id: string; gameId?: string | null | undefined }

/** Your pilots in `gameId` (this browser holds only yours) that no mech is assigned to. */
function mechlessPilots<P extends Held>(
  pilots: readonly P[],
  softLinks: readonly Pick<SoftLink, 'type' | 'to'>[],
  gameId: string
): P[] {
  const flying = new Set(softLinks.filter((l) => l.type === 'mech-to-pilot').map((l) => l.to.id))
  return pilots.filter((p) => p.gameId === gameId && !flying.has(p.id))
}

/** The one mech-less pilot of yours in the Game, or null when there is none or more than one. */
export function soleMechlessPilot<P extends Held>(
  pilots: readonly P[],
  softLinks: readonly Pick<SoftLink, 'type' | 'to'>[],
  gameId: string
): P | null {
  const [only, ...rest] = mechlessPilots(pilots, softLinks, gameId)
  return only !== undefined && rest.length === 0 ? only : null
}

/**
 * Give a mech just made in a Game to the pilot it is plainly for. Resolves to
 * that pilot and the way back (the link deleted again), or null when nobody
 * is (`soleMechlessPilot`) and nothing was assigned.
 */
export async function pairNewMechInGame(
  mechId: string,
  gameId: string
): Promise<{ pilot: Pilot; undo: () => Promise<void> } | null> {
  const { pilots, softLinks } = useUnits.getState()
  const pilot = soleMechlessPilot(pilots, softLinks, gameId)
  if (pilot === null) return null
  const link = await assignLink({ type: 'mech', id: mechId }, { type: 'pilot', id: pilot.id })
  return { pilot, undo: () => useUnits.getState().delete('softLink', link.id) }
}

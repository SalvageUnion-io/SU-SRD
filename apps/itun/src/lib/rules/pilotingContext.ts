import { resolveChassisRef } from 'salvageunion-reference/rules'
import type { Mech } from '../schemas/mech'

/**
 * The piloting context a mech's derived maxima need (ADR-029).
 *
 * Beefcake is a PILOT ability that raises the piloted MECH, and its Max SP is
 * "3+X (where X is the Mech's Tech Level)" — so BOTH the ability refs and the
 * chassis tech level are required to resolve it. Supplying only the abilities
 * silently resolves 3+X to a flat 3.
 *
 * This exists because that mistake was made three times in one change: the
 * Dashboard band and the condensed strip each built a context with no tech
 * level, so they under-counted against the body sheet without failing. The
 * context is optional at the derivation boundary — which is what lets a missing
 * piece degrade quietly — so it is assembled in exactly one place instead.
 *
 * Non-numeric tech levels ('B'/'N' — Bio-Titan, Nanite) have no numeric scale
 * and resolve to the flat part rather than a guess.
 */
export function pilotingContext(
  mech: Pick<Mech, 'chassisRef'>,
  abilities: string[] | undefined
): { abilities?: string[]; techLevel?: number } {
  const chassis = resolveChassisRef(mech.chassisRef)
  const techLevel = typeof chassis?.techLevel === 'number' ? chassis.techLevel : undefined
  return { abilities, techLevel }
}

/**
 * Pure utility functions for mech shutdown and activation.
 *
 * No React, no Supabase — pure transforms for use in components and tests.
 *
 * Rules reference:
 * - Shutdown resets heat to 0 and EP to max.
 * - Activation costs 1 AP (pilot resource).
 * - A mech cannot be activated without at least 1 AP.
 */

import type { MechRow } from '../types/common'
import type { PilotRow } from '../types/common'

type MechForShutdown = Pick<MechRow, 'current_heat' | 'current_ep' | 'max_ep' | 'active'>
type PilotForActivation = Pick<PilotRow, 'ap'>

/**
 * Compute the DB fields to write when shutting down a mech.
 * Shutdown resets heat to 0 and restores EP to max.
 */
export function computeShutdown(mech: MechForShutdown): { current_heat: 0; current_ep: number } {
  return { current_heat: 0, current_ep: mech.max_ep }
}

/**
 * Compute the DB fields to write to the pilot when activating a mech.
 * Activation costs 1 AP.
 */
export function computeActivation(pilot: PilotForActivation): { ap: number } {
  return { ap: pilot.ap - 1 }
}

/**
 * Returns true if the mech can be activated:
 * - mech must currently be inactive (active === false)
 * - pilot must have at least 1 AP
 */
export function canActivate(mech: MechForShutdown, pilot: PilotForActivation): boolean {
  return mech.active === false && pilot.ap >= 1
}

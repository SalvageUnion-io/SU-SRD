/**
 * Pure utility functions for the Push mechanic.
 *
 * Push: spend 2 Heat to reroll any d20. No new DB columns — reuses the
 * existing heat pipeline (clampHeat, shouldTriggerHeatCheck).
 *
 * No React, no Supabase — pure transforms for use in components and tests.
 */

import { shouldTriggerHeatCheck } from 'salvageunion-reference'
import { clampHeat } from './heatUtils'

/** Fixed heat cost for a Push action (rules p.234). */
const PUSH_HEAT_COST = 2

/**
 * Whether the pilot can push.
 *
 * Returns `true` when `currentHeat < heatCap`.
 * Pushing is available whenever heat is below cap; already at cap = blocked.
 * Pushing to exactly the cap is allowed and will trigger a heat check.
 */
export function canPush(currentHeat: number, heatCap: number): boolean {
  return currentHeat < heatCap
}

/**
 * Compute the result of a Push action.
 *
 * Adds 2 heat, clamps to the heat cap, and determines whether a
 * heat check is triggered (i.e. whether the new heat reaches or
 * exceeds the cap).
 *
 * @param currentHeat - Mech's current heat value before pushing.
 * @param heatCap - Mech's heat capacity.
 * @returns `{ newHeat, heatCheckTriggered }`
 */
export function computePush(
  currentHeat: number,
  heatCap: number
): { newHeat: number; heatCheckTriggered: boolean } {
  const newHeat = clampHeat(currentHeat + PUSH_HEAT_COST, heatCap)
  const heatCheckTriggered = shouldTriggerHeatCheck(currentHeat, PUSH_HEAT_COST, heatCap)
  return { newHeat, heatCheckTriggered }
}

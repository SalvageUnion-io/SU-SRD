/**
 * abilityCost — resolve the AP (activation) cost of a pilot ability for
 * live-play (Slice D).
 *
 * Abilities in salvageunion-reference carry their cost on their referenced
 * actions (`actions: string[]` → resolved Action objects), not on the ability
 * record directly. Each action's `activationCost` is `number | 'X'` (where 'X'
 * is a variable cost like "XAP"). This helper resolves the ability's actions
 * and returns the first FIXED non-negative numeric cost found.
 *
 * Returns `null` when there is no fixed numeric cost — i.e. no actions resolve,
 * every cost is variable ('X'), or the costs are all zero/absent. A `null`
 * result means "no spend affordance" so the UI must degrade gracefully (show
 * the cost as variable / hide the spend button) rather than spending an
 * undefined amount.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility, SURefMetaEntity } from 'salvageunion-reference'

/**
 * Resolve the fixed AP cost of an ability, or null if there is no fixed numeric
 * cost (variable 'X' cost, zero cost, or no resolvable actions).
 */
export function resolveAbilityApCost(ability: SURefAbility): number | null {
  const actions = SalvageUnionReference.resolveActions(ability as unknown as SURefMetaEntity)
  if (!actions || actions.length === 0) return null

  for (const action of actions) {
    const cost = action.activationCost
    if (typeof cost === 'number' && Number.isFinite(cost) && cost > 0) {
      return cost
    }
  }
  return null
}

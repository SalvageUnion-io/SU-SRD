/**
 * Training — what an ability costs to train in Training Points (Core Book
 * p.224): a Core ability 1, an Advanced or Hybrid one 2, a Legendary one 3.
 * The Live Sheet shows the cost and offers to pay it; it never demands it
 * (Free Edit, surfaces §1).
 */

import { enrichPilotSnapshot } from 'salvageunion-reference/rules'

const TRAINING_COST = { core: 1, advanced: 2, legendary: 3 } as const

/** The Training Points `slug` costs, or null for an ability no tree prices (a generic one). */
export function abilityTrainingCost(slug: string): number | null {
  const tier = enrichPilotSnapshot({ abilities: [slug] }).abilities[0]?.tier
  return tier ? TRAINING_COST[tier] : null
}

/**
 * Training — what an ability costs to train in Training Points (Core Book
 * p.224): a Core ability 1, an Advanced or Hybrid one 2, a Legendary one 3.
 * The Live Sheet shows the cost and offers to pay it; it never demands it
 * (Free Edit, surfaces §1). It also says what the book asks before an ability
 * is trained that the pilot has not met (Core Book p.23): shown before the
 * add and confirmed once on it, never a gate.
 */

import { enrichPilotSnapshot, evaluateSoftWarnings } from 'salvageunion-reference/rules'

const TRAINING_COST = { core: 1, advanced: 2, legendary: 3 } as const

/** The Training Points `slug` costs, or null for an ability no tree prices (a generic one). */
export function abilityTrainingCost(slug: string): number | null {
  const tier = enrichPilotSnapshot({ abilities: [slug] }).abilities[0]?.tier
  return tier ? TRAINING_COST[tier] : null
}

/**
 * What the book asks before `slug` is trained that this pilot has not met:
 * the advisory lines adding it would newly raise (tree order, the Advanced and
 * Legendary bars, the ability cap), in the words the confirm uses. Empty when
 * the add breaks nothing, or the pilot already has it.
 */
export function abilityRequirementsUnmet(
  pilot: { abilities: string[]; classRef?: string },
  slug: string
): string[] {
  if (pilot.abilities.includes(slug)) return []
  const before = enrichPilotSnapshot(pilot)
  const after = enrichPilotSnapshot({ ...pilot, abilities: [...pilot.abilities, slug] })
  const context = { entityType: 'pilot' as const }
  const already = new Set(evaluateSoftWarnings(before, before, context).map((w) => w.message))
  return evaluateSoftWarnings(before, after, context)
    .map((w) => w.message)
    .filter((message) => !already.has(message))
}

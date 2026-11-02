/**
 * Crawler-type mutations: the rule modifiers a Union Crawler's type applies
 * (the Battle crawler's extra weapon slot and SP bonus, the Engineering
 * crawler's cheaper Upkeep and free Upgrade Pool Scrap each Downtime).
 */

import { z } from '../../zod'

/** Mutation type for crawler type bonuses. */
const CrawlerMutationTypeSchema = z.enum([
  'weapon_slots',
  'max_sp_bonus',
  'upkeep_reduction',
  'downtime_upgrade_pool',
])

/**
 * A mutation applied by a crawler type that modifies game rules
 */
export const CrawlerMutationSchema = z
  .object({
    type: CrawlerMutationTypeSchema.describe('Type of mutation'),
    value: z.number().int().describe('Numeric value of the mutation modifier'),
  })
  .strict()
  .describe('A mutation applied by a crawler type that modifies game rules')

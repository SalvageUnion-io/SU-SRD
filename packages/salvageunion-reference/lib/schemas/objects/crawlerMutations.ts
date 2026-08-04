/**
 * Crawler-type mutations: the rule modifiers a Union Crawler's type applies
 * (e.g. the Battle crawler's extra weapon slot and SP bonus).
 */

import { z } from '../../zod.js'

/**
 * Mutation type for crawler type bonuses (e.g. Battle crawler's extra weapon slot + SP)
 */
const CrawlerMutationTypeSchema = z.enum(['weapon_slots', 'max_sp_bonus'])

/**
 * A mutation applied by a crawler type that modifies game rules
 */
export const CrawlerMutationSchema = z
  .object({
    type: CrawlerMutationTypeSchema.describe('Type of mutation (weapon_slots or max_sp_bonus)'),
    value: z.number().int().describe('Numeric value of the mutation modifier'),
  })
  .strict()
  .describe('A mutation applied by a crawler type that modifies game rules')

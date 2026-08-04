/**
 * Systems and Modules — the one installable-item shape. Systems and Modules
 * share this schema; only the stamped `schemaName` tells them apart.
 */

import { z } from '../../zod.js'
import { NonNegativeIntegerSchema, TechLevelSchema } from '../common.js'
import { StatsSchema } from './primitives.js'
import { ContributionSchema } from './contributions.js'
import { ChoiceEffectSchema } from './effects.js'

/**
 * A system or module that can be installed on a mech
 */
export const SystemModuleSchema = StatsSchema.extend({
  name: z.string().min(1).describe('Display name (used by custom system options)').optional(),
  techLevel: TechLevelSchema,
  slotsRequired: NonNegativeIntegerSchema.describe('Number of slots this system/module occupies'),
  salvageValue: NonNegativeIntegerSchema.describe('Scrap value when salvaged'),
  recommended: z
    .boolean()
    .describe('Whether this is a recommended starting system/module')
    .optional(),
  count: NonNegativeIntegerSchema.describe('Number of this system/module installed').optional(),
  contributions: z
    .array(ContributionSchema)
    .describe(
      'Every flat mechanical change this item makes to a stat (ADR-029). This is ' +
        'the ONE numeric encoding: the older `statBonus` shape — a bare per-copy ' +
        'map with no target, duration or expression amounts — was a strict subset ' +
        'of it, and two encodings summed independently by the same derivation is a ' +
        'double-count waiting to be authored.'
    )
    .optional(),
  appliedEffects: z
    .array(ChoiceEffectSchema)
    .describe(
      'Trait/damage/range effects this item applies unconditionally (ADR-029). ' +
        'Same vocabulary as a choice option’s `effects`, declared directly on ' +
        'the record for grants that are not a choice. Named `appliedEffects`, not ' +
        '`effects`: that key is already taken on meta entities with a different ' +
        '`{ label, value }` shape (see getEffects), and one field name meaning two ' +
        'things is how a schema rots.'
    )
    .optional(),
  actions: z.array(z.string()).describe('Action names this system/module provides'),
}).describe('A system or module that can be installed on a mech')

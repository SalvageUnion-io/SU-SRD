/**
 * Actions — the record every entity's `actions: string[]` resolves to. The one
 * place damage, range, activation cost, traits and embedded tables live.
 */

import { z } from '../../zod.js'
import {
  ActivationCostSchema,
  IdSchema,
  NameSchema,
  PositiveIntegerSchema,
  TechLevelSchema,
} from '../common.js'
import { ActionTypeSchema, RangeSchema, SchemaNameSchema, SourceSchema } from '../enums.js'
import { ContentSchema } from './content.js'
import { DamageSchema, TraitSchema } from './primitives.js'
import { ChoiceSchema } from './choices.js'
import { TableSchema } from './tables.js'

/**
 * Activation currency enum
 */
const ActivationCurrencySchema = z.enum(['EP or AP', 'SP or HP', 'Variable'])

/**
 * Action schema (z.lazy() defers building the shape; the type is inferred, never
 * hand-annotated — see ContentBlockSchema for why).
 */
export const ActionSchema = z
  .lazy(() =>
    z
      .object({
        id: IdSchema.describe('Unique identifier for this action'),
        name: NameSchema.describe('Display name of this action'),
        content: ContentSchema.describe('Descriptive content for this action').optional(),
        structurePoints: z.number().describe('SP modifier from this action').optional(),
        energyPoints: z.number().describe('EP modifier from this action').optional(),
        heatCapacity: z.number().describe('Heat capacity modifier from this action').optional(),
        systemSlots: z.number().describe('System slot modifier from this action').optional(),
        moduleSlots: z.number().describe('Module slot modifier from this action').optional(),
        cargoCapacity: z.number().describe('Cargo capacity modifier from this action').optional(),
        techLevel: TechLevelSchema.optional(),
        salvageValue: z.number().describe('Scrap value when salvaged').optional(),
        displayName: NameSchema.describe('Alternative display name for this action').optional(),
        activationCost: ActivationCostSchema.describe('AP cost to activate this action').optional(),
        range: RangeSchema.describe('Range bands for this action').optional(),
        actionType: ActionTypeSchema.describe(
          'Type of action (Turn, Free, Reaction, etc.)'
        ).optional(),
        traits: z.array(TraitSchema).describe('Traits applied by this action').optional(),
        damage: DamageSchema.describe('Damage dealt by this action').optional(),
        choices: z.array(ChoiceSchema).describe('Choices presented by this action').optional(),
        table: TableSchema.describe('Embedded roll table for this action').optional(),
        tableName: z.string().describe('Reference to a roll table name').optional(),
        hidden: z
          .boolean()
          .describe('If true, this action will not affect the rendering of the entity display')
          .optional(),
        activationCurrency: ActivationCurrencySchema.describe(
          'Currency type used for activation (EP or AP, SP or HP, Variable)'
        ).optional(),
        source: SourceSchema.describe('Source book for this action').optional(),
        page: PositiveIntegerSchema.describe('Page number in the source book').optional(),
        actionSource: SchemaNameSchema.describe('Schema this action originates from').optional(),
        drone: z.string().describe('Drone name this action is associated with').optional(),
      })
      .strict()
  )
  .describe('An action, ability, or attack that can be performed')

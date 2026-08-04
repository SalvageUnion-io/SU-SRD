/**
 * Cross-record references — the shapes one record uses to point at another:
 * an ability's grant, a faction formation member, and the schema-name
 * vocabulary that admits `actions` alongside the entity schemas.
 */

import { z } from '../../zod.js'
import { NameSchema, PositiveIntegerSchema } from '../common.js'
import { SchemaNameSchema, SourceSchema } from '../enums.js'

/**
 * Formation member schema
 * Supports chassis+pattern combos and standalone entities (vehicles, drones, squads, npcs)
 */
export const FormationMechSchema = z
  .object({
    chassis: z.string().describe('Chassis name for this formation member'),
    pattern: z.string().describe('Pattern name for this formation member').optional(),
    schema: SchemaNameSchema.describe(
      'Schema type if not a chassis (vehicle, drone, etc.)'
    ).optional(),
    source: SourceSchema.describe('Source book for this formation entry'),
    page: PositiveIntegerSchema.describe('Page number in the source book'),
    quantity: z
      .number()
      .int()
      .positive()
      .describe('Number of this unit in the formation')
      .optional(),
  })
  .strict()
  .describe('A member of a faction formation (chassis+pattern combo or standalone entity)')

/**
 * Grant schema
 */
export const GrantSchema = z
  .object({
    schema: z
      .union([SchemaNameSchema, z.literal('choice')])
      .describe("Schema collection the granted entity belongs to, or 'choice' for a choice grant"),
    name: NameSchema.describe('Name of the granted entity or choice'),
  })
  .strict()
  .describe('An entity or choice granted by an ability')

/**
 * Schema name (includes 'actions' as special case)
 */
export const SchemaNameWithActionsSchema = z.union([SchemaNameSchema, z.literal('actions')])

/**
 * Object-schema primitives: the small, widely-reused shapes other object
 * schemas compose out of — a trait, a stat block, a labelled data value, a
 * damage figure.
 *
 * Nothing here references another object family, which is what makes it the
 * bottom of the objects dependency graph.
 */

import { z } from '../../zod.js'
import { NonNegativeIntegerSchema, TechLevelSchema } from '../common.js'
import { DamageTypeSchema } from '../enums.js'

/**
 * Special traits and properties of items, systems, or abilities
 */
export const TraitSchema = z
  .object({
    amount: z
      .union([NonNegativeIntegerSchema, z.string()])
      .describe('Numeric or variable amount for this trait')
      .optional(),
    type: z.string().describe('Trait type identifier'),
  })
  .strict()
  .describe('Special traits and properties of items, systems, or abilities')

/**
 * Structure Points on a stat block — the ONE declaration, composed everywhere.
 *
 * It was previously spelled four ways for the same concept: `NonNegativeInteger`
 * here, `PositiveInteger` on `MechanicalEntitySchema` (same field, same
 * `describe()`), and two inline `z.number().int()` copies in `entities.ts`, one
 * positive and one not. So whether a stat block could carry 0 depended on which
 * schema happened to validate it.
 *
 * It can. A destroyed or fully-salvaged chassis at 0 SP is a real game state,
 * and the derived-stat code already clamps to 0 rather than treating it as
 * impossible — so `positive()` was the outlier, not the rule. No shipped record
 * carries 0 today (checked), which is why widening is purely permissive.
 *
 * NOT for the SP *modifier* on an action: that is signed (`-2 SP` is a normal
 * effect) and is declared separately in `objects/actions.ts`.
 */
export const StructurePointsSchema = NonNegativeIntegerSchema.describe(
  'Structure points (mech health)'
)

/**
 * Statistics for mechs, chassis, and vehicles
 */
export const StatsSchema = z
  .object({
    structurePoints: StructurePointsSchema.optional(),
    energyPoints: NonNegativeIntegerSchema.describe(
      'Energy points for powering systems'
    ).optional(),
    heatCapacity: NonNegativeIntegerSchema.describe('Maximum heat before overheating').optional(),
    systemSlots: NonNegativeIntegerSchema.describe('Number of system slots available').optional(),
    moduleSlots: NonNegativeIntegerSchema.describe('Number of module slots available').optional(),
    cargoCapacity: NonNegativeIntegerSchema.describe('Cargo carrying capacity').optional(),
    techLevel: TechLevelSchema.optional(),
    salvageValue: NonNegativeIntegerSchema.describe('Scrap value when salvaged').optional(),
  })
  .describe('Statistics for mechs, chassis, and vehicles')

/**
 * Statistics specific to chassis — all stats required
 */
export const ChassisStatsSchema = StatsSchema.required({
  structurePoints: true,
  energyPoints: true,
  heatCapacity: true,
  systemSlots: true,
  moduleSlots: true,
  cargoCapacity: true,
  techLevel: true,
  salvageValue: true,
}).describe('Statistics specific to chassis — all stats required')

/**
 * Entity that can perform actions and has traits
 */
export const CombatEntitySchema = z
  .object({
    actions: z.array(z.string()).describe('Action names this entity can perform').optional(),
    traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
  })
  .describe('Entity that can perform actions and has traits')

/**
 * Mechanical entity with structure points and equipment stats
 */
export const MechanicalEntitySchema = z
  .object({
    structurePoints: StructurePointsSchema.optional(),
    techLevel: TechLevelSchema.optional(),
    salvageValue: NonNegativeIntegerSchema.describe('Scrap value when salvaged').optional(),
    systems: z.array(z.string()).describe('Installed system names').optional(),
    traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
    energyPoints: NonNegativeIntegerSchema.describe(
      'Energy points for powering systems'
    ).optional(),
    heatCapacity: NonNegativeIntegerSchema.describe('Maximum heat before overheating').optional(),
    systemSlots: NonNegativeIntegerSchema.describe('Number of system slots available').optional(),
    moduleSlots: NonNegativeIntegerSchema.describe('Number of module slots available').optional(),
    cargoCapacity: NonNegativeIntegerSchema.describe('Cargo carrying capacity').optional(),
  })
  .describe('Mechanical entity with structure points and equipment stats')

/**
 * A data value with label, optional value, and optional type
 */
export const DataValueSchema = z
  .object({
    label: z.union([z.string(), z.number()]).describe('Display label for this data value'),
    value: z.union([z.string(), z.number()]).describe('The data value').optional(),
    type: z
      .enum(['keyword', 'trait', 'cost'])
      .describe('Type classification for this data value')
      .optional(),
    unit: z
      .string()
      .describe('Optional unit shown after the value (e.g. damage type "SP")')
      .optional(),
    perTechLevel: z
      .number()
      .describe(
        'When set, this numeric value scales with the entity\'s effective tech level: it increases by this amount for each tech level above the first (e.g. Custom Sniper Rifle damage "+1 SP per Tech Level after the first")'
      )
      .optional(),
  })
  .strict()
  .describe(
    'A data value with label, optional value, optional type, optional unit, and optional per-tech-level scaling'
  )

/**
 * Damage schema
 */
export const DamageSchema = z
  .object({
    damageType: DamageTypeSchema.describe('Whether this damages HP or SP'),
    amount: z
      .union([NonNegativeIntegerSchema, z.string()])
      .describe('Damage amount (number or variable expression)'),
  })
  .strict()
  .describe('Damage dealt by an action or ability')

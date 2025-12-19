/**
 * Zod entity schemas - all 24 entity types
 */

import { z } from 'zod'
import {
  BaseEntitySchema,
  ContentSchema,
  PatternSchema,
  NpcSchema,
  TableSchema,
  ChoicesSchema,
  GrantSchema,
  ActionSchema,
  FormationMechSchema,
  TraitSchema,
  SystemModuleSchema,
  ChassisStatsSchema,
  StatsSchema,
  CombatEntitySchema,
  MechanicalEntitySchema,
  AdvancedClassSchema,
} from './objects.js'
import { TreeSchema, ActionTypeSchema, DamageTypeSchema } from './enums.js'
import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  HitPointsSchema,
  TechLevelSchema,
} from './common.js'

/**
 * Ability level can be number 1-3 or 'L' (Legendary) or 'G' (Generic)
 */
const AbilityLevelSchema = z.union([z.number().int().min(1).max(3), z.literal('L'), z.literal('G')])

/**
 * Activation currency enum
 */
const ActivationCurrencySchema = z.enum(['Variable', 'EP or AP', 'SP or HP'])

/**
 * Pilot abilities and skills in Salvage Union
 */
export const AbilitySchema = BaseEntitySchema.extend({
  description: z.string().optional(),
  tree: TreeSchema,
  level: AbilityLevelSchema,
  mechActionType: ActionTypeSchema.optional(),
  grants: z.array(GrantSchema).optional(),
  activationCurrency: ActivationCurrencySchema.optional(),
  actions: z.array(z.string()).optional(),
}).strict()

/**
 * Requirements for ability trees in Salvage Union
 */
export const AbilityTreeRequirementSchema = BaseEntitySchema.extend({
  requirement: z
    .array(TreeSchema)
    .describe('List of ability tree names required to access this tree'),
}).strict()

/**
 * Actions, abilities, and attacks that can be performed in Salvage Union
 */
export const MetaActionSchema = ActionSchema.and(
  z.object({
    displayName: z.string().min(1).optional(),
    activationCurrency: ActivationCurrencySchema.optional(),
  })
)

/**
 * Massive bio-engineered titan creatures in Salvage Union
 */
export const BioTitanSchema = BaseEntitySchema.extend({
  structurePoints: PositiveIntegerSchema,
  actions: z.array(z.string()),
  traits: z.array(TraitSchema).optional(),
}).strict()

/**
 * Mech chassis definitions in Salvage Union
 */
export const ChassisSchema = BaseEntitySchema.merge(ChassisStatsSchema)
  .extend({
    chassisAbilities: z
      .array(z.string())
      .describe('Array of chassis ability names that reference actions.json'),
    patterns: z.array(PatternSchema),
    npc: NpcSchema.optional(),
  })
  .strict()

/**
 * Base class schema
 */
const BaseClassSchema = BaseEntitySchema.extend({
  maxAbilities: z
    .number()
    .int()
    .positive()
    .describe('Maximum number of abilities this class can have'),
  advanceable: z.boolean().describe('Whether this class can advance to hybrid classes'),
  coreTrees: z.array(TreeSchema).describe('Core ability trees available to this class'),
  advancedTree: TreeSchema.optional().describe(
    'Advanced ability tree for this class (only for advanceable base classes)'
  ),
  legendaryTree: TreeSchema.optional().describe(
    'Legendary ability tree for this class (only for advanceable base classes)'
  ),
}).strict()

/**
 * Character classes in Salvage Union (base, advanced, and hybrid)
 */
export const ClassSchema = z.union([BaseClassSchema, AdvancedClassSchema])

/**
 * Bays and facilities on Union Crawlers in Salvage Union
 */
export const CrawlerBaySchema = BaseEntitySchema.extend({
  damagedEffect: z.string().describe('Effect when this bay is damaged'),
  npc: NpcSchema,
  choices: ChoicesSchema.optional().describe(
    'Choices available to the player when interacting with the NPC'
  ),
  table: TableSchema.optional(),
  tableName: z.string().optional().describe('Reference to a roll table name'),
}).strict()

/**
 * Tech levels for Union Crawlers in Salvage Union
 */
export const CrawlerTechLevelSchema = BaseEntitySchema.extend({
  techLevel: z.number().int().positive().describe('Tech level (1-6)'),
  structurePoints: z.number().int().nonnegative(),
  populationMin: z.number().int().nonnegative().describe('Minimum approximate population'),
  populationMax: z
    .number()
    .int()
    .nonnegative()
    .describe('Maximum approximate population (0 means unlimited/25,000+)'),
}).strict()

/**
 * Crawler vehicles in Salvage Union
 */
export const CrawlerSchema = BaseEntitySchema.extend({
  npc: NpcSchema,
  actions: z.array(z.string()),
}).strict()

/**
 * Creatures and wildlife in Salvage Union
 */
export const CreatureSchema = BaseEntitySchema.merge(CombatEntitySchema)
  .extend({
    hitPoints: HitPointsSchema,
  })
  .strict()

/**
 * Distances in Salvage Union
 */
export const DistanceSchema = BaseEntitySchema.extend({
  content: ContentSchema.optional(),
}).strict()

/**
 * Autonomous drones in Salvage Union
 */
export const DroneSchema = BaseEntitySchema.merge(MechanicalEntitySchema).strict()

/**
 * Pilot equipment and gear in Salvage Union
 */
export const EquipmentSchema = BaseEntitySchema.merge(StatsSchema)
  .extend({
    techLevel: TechLevelSchema,
    actions: z.array(z.string()),
    bonusPerTechLevel: StatsSchema.optional(),
    choices: ChoicesSchema.optional(),
  })
  .strict()

/**
 * Faction groups and organizations in Salvage Union
 */
export const FactionSchema = BaseEntitySchema.extend({
  goals: z.string().describe('The goals and motivations of this faction'),
  assets: z.string().describe('The assets and resources controlled by this faction'),
  weaknesses: z.string().describe('The weaknesses and vulnerabilities of this faction'),
  formation: z
    .array(FormationMechSchema)
    .describe('The mechs that make up this faction formation')
    .optional(),
  content: ContentSchema.optional(),
}).strict()

/**
 * Game keywords and terminology in Salvage Union
 */
export const KeywordSchema = BaseEntitySchema.extend({
  content: ContentSchema.optional(),
}).strict()

/**
 * Meld-infected creatures in Salvage Union
 */
export const MeldSchema = BaseEntitySchema.extend({
  actions: z.array(z.string()),
  traits: z.array(TraitSchema).optional(),
  salvageValue: z.number().int().nonnegative().optional(),
  hitPoints: z.number().int().nonnegative().optional(),
  structurePoints: z.number().int().positive().optional(),
}).strict()

/**
 * Mech modules in Salvage Union
 */
export const ModuleSchema = BaseEntitySchema.merge(SystemModuleSchema).strict()

/**
 * Non-player characters and people in Salvage Union
 */
export const NPCSchema = BaseEntitySchema.merge(CombatEntitySchema)
  .extend({
    hitPoints: HitPointsSchema,
    bioSalvageValue: NonNegativeIntegerSchema.optional().describe(
      'Bio-salvage value for Chimerium mutants'
    ),
  })
  .strict()

/**
 * Random tables and roll tables in Salvage Union
 * Note: page is optional since some roll tables are generated from actions
 */
export const RollTableSchema = BaseEntitySchema.extend({
  page: z.number().int().positive().optional(),
  table: TableSchema,
  content: ContentSchema.optional(),
}).strict()

/**
 * NPC squads and groups in Salvage Union
 */
export const SquadSchema = BaseEntitySchema.extend({
  hitPoints: HitPointsSchema.optional(),
  actions: z.array(z.string()),
  traits: z.array(TraitSchema).optional(),
  damageType: DamageTypeSchema.optional(),
}).strict()

/**
 * Mech systems in Salvage Union
 */
export const SystemSchema = BaseEntitySchema.merge(SystemModuleSchema).strict()

/**
 * Traits and special properties in Salvage Union
 */
export const TraitEntitySchema = BaseEntitySchema.extend({
  content: ContentSchema.optional(),
}).strict()

/**
 * Conventional vehicles in Salvage Union
 */
export const VehicleSchema = BaseEntitySchema.merge(MechanicalEntitySchema).strict()

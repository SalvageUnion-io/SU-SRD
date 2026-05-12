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
  GuideStepSchema,
  GuideTypeSchema,
  CrawlerMutationSchema,
} from './objects.js'
import { TreeSchema, ActionTypeSchema, DamageTypeSchema, SchemaNameSchema } from './enums.js'
import {
  IdSchema,
  NameSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
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
  description: z.string().describe('Short description of the ability').optional(),
  tree: TreeSchema.describe('Ability tree this ability belongs to'),
  level: AbilityLevelSchema.describe('Ability level (1-3, L for Legendary, G for Generic)'),
  mechActionType: ActionTypeSchema.describe('Action type when used as a mech action').optional(),
  grants: z.array(GrantSchema).describe('Entities or choices granted by this ability').optional(),
  activationCurrency: ActivationCurrencySchema.describe(
    'Currency type used for activation'
  ).optional(),
  actions: z.array(z.string()).describe('Action names this ability provides'),
})
  .strict()
  .describe('Pilot abilities and skills in Salvage Union')

/**
 * Requirements for ability trees in Salvage Union
 */
export const AbilityTreeRequirementSchema = BaseEntitySchema.extend({
  requirement: z
    .array(TreeSchema)
    .describe('List of ability tree names required to access this tree'),
})
  .strict()
  .describe('Requirements for unlocking ability trees in Salvage Union')

/**
 * Actions, abilities, and attacks that can be performed in Salvage Union
 */
export const MetaActionSchema = ActionSchema.and(
  z.object({
    displayName: z.string().min(1).describe('Alternative display name for this action').optional(),
    activationCurrency: ActivationCurrencySchema.describe(
      'Currency type used for activation'
    ).optional(),
  })
).describe('Actions, abilities, and attacks that can be performed in Salvage Union')

/**
 * Mech-scale single-threat enemies in Salvage Union (monsters and bosses).
 *
 * `kind` distinguishes:
 * - `monster`: instinctual creatures (e.g. Scylla, Typhon, Chrysalis)
 * - `boss`: named antagonists with goals and motivations (e.g. The Iron Lady)
 *
 * Both share the same statblock shape: structurePoints + actions (often
 * including a "Titanic Actions" entry) and optional traits.
 */
export const TitanSchema = BaseEntitySchema.extend({
  kind: z
    .enum(['monster', 'boss'])
    .describe(
      'Monster (instinctual creature) or Boss (named antagonist with goals and motivations)'
    ),
  structurePoints: PositiveIntegerSchema.describe('Structure points of this titan'),
  actions: z.array(z.string()).describe('Action names this titan can perform'),
  traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
})
  .strict()
  .describe('Mech-scale single-threat enemies in Salvage Union (monsters and bosses)')

/**
 * Mech chassis definitions in Salvage Union
 */
export const ChassisSchema = BaseEntitySchema.extend({ ...ChassisStatsSchema.shape })
  .extend({
    chassisAbilities: z
      .array(z.string())
      .describe('Array of chassis ability names that reference actions.json'),
    patterns: z.array(PatternSchema).describe('Available mech patterns for this chassis'),
    npc: NpcSchema.describe('NPC crew member associated with this chassis').optional(),
  })
  .strict()
  .describe('Mech chassis definitions in Salvage Union')

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
export const ClassSchema = z
  .union([BaseClassSchema, AdvancedClassSchema])
  .describe('Character classes in Salvage Union (base, advanced, and hybrid)')

/**
 * Bays and facilities on Union Crawlers in Salvage Union
 */
export const CrawlerBaySchema = BaseEntitySchema.extend({
  damagedEffect: z.string().describe('Effect when this bay is damaged'),
  npc: NpcSchema.describe('NPC crew member who operates this bay'),
  choices: ChoicesSchema.describe(
    'Choices available to the player when interacting with the NPC'
  ).optional(),
  table: TableSchema.describe('Roll table associated with this bay').optional(),
  tableName: z.string().describe('Reference to a roll table name').optional(),
})
  .strict()
  .describe('Bays and facilities on Union Crawlers in Salvage Union')

/**
 * Tech levels for Union Crawlers in Salvage Union
 */
export const CrawlerTechLevelSchema = BaseEntitySchema.extend({
  techLevel: z.number().int().positive().describe('Tech level (1-6)'),
  structurePoints: z.number().int().nonnegative().describe('Structure points at this tech level'),
  upkeepCost: z
    .number()
    .int()
    .positive()
    .describe('Scrap multiplier for upkeep (e.g. 5 means 5× Tech N Scrap)'),
  upgradeCost: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe(
      'Scrap multiplier for upgrade (e.g. 30 means 30× Tech N Scrap), null if max tech level'
    ),
  populationMin: z.number().int().nonnegative().describe('Minimum approximate population'),
  populationMax: z
    .number()
    .int()
    .nonnegative()
    .describe('Maximum approximate population (0 means unlimited/25,000+)'),
})
  .strict()
  .describe('Tech level progression for Union Crawlers in Salvage Union')

/**
 * Crawler vehicles in Salvage Union
 */
export const CrawlerSchema = BaseEntitySchema.extend({
  npc: NpcSchema.describe('NPC commander of this crawler'),
  actions: z.array(z.string()).describe('Action names this crawler can perform'),
  mutations: z
    .array(CrawlerMutationSchema)
    .describe('Rule mutations applied by this crawler type')
    .optional(),
})
  .strict()
  .describe('Union Crawler mobile bases in Salvage Union')

/**
 * Creatures and wildlife in Salvage Union
 */
export const CreatureSchema = BaseEntitySchema.extend({ ...CombatEntitySchema.shape })
  .extend({
    hitPoints: NonNegativeIntegerSchema.describe('Hit points of this creature'),
  })
  .strict()
  .describe('Creatures and wildlife in Salvage Union')

/**
 * Distances in Salvage Union
 */
export const DistanceSchema = BaseEntitySchema.extend({
  content: ContentSchema.describe('Descriptive content for this distance band').optional(),
})
  .strict()
  .describe('Distance bands and ranges in Salvage Union')

/**
 * Tech level descriptions for Salvage Union
 */
export const TechLevelEntitySchema = BaseEntitySchema.extend({
  techLevel: PositiveIntegerSchema.describe('Numeric tech level value'),
  content: ContentSchema.describe('Descriptive content for this tech level').optional(),
})
  .strict()
  .describe('Tech level descriptions for Salvage Union')

/**
 * Autonomous drones in Salvage Union
 */
export const DroneSchema = BaseEntitySchema.extend({ ...MechanicalEntitySchema.shape })
  .extend({
    choices: ChoicesSchema.describe('Configuration choices for this drone').optional(),
  })
  .strict()
  .describe('Autonomous drones in Salvage Union')

/**
 * Pilot equipment and gear in Salvage Union
 */
export const EquipmentSchema = BaseEntitySchema.extend({ ...StatsSchema.shape })
  .extend({
    techLevel: TechLevelSchema,
    actions: z.array(z.string()).describe('Action names this equipment provides'),
    traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
    bonusPerTechLevel: StatsSchema.describe('Stat bonuses gained per tech level').optional(),
    choices: ChoicesSchema.describe('Configuration choices for this equipment').optional(),
  })
  .strict()
  .describe('Pilot equipment and gear in Salvage Union')

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
  content: ContentSchema.describe('Descriptive content for this faction').optional(),
})
  .strict()
  .describe('Faction groups and organizations in Salvage Union')

/**
 * Game keywords and terminology in Salvage Union
 */
export const KeywordSchema = BaseEntitySchema.extend({
  content: ContentSchema.describe('Definition and explanation of this keyword').optional(),
})
  .strict()
  .describe('Game keywords and terminology in Salvage Union')

/**
 * Meld-infected creatures in Salvage Union
 */
export const MeldSchema = BaseEntitySchema.extend({
  actions: z.array(z.string()).describe('Action names this meld creature can perform'),
  traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
  salvageValue: z.number().int().nonnegative().describe('Scrap value when salvaged').optional(),
  hitPoints: z.number().int().nonnegative().describe('Hit points of this meld creature').optional(),
  structurePoints: z
    .number()
    .int()
    .positive()
    .describe('Structure points of this meld creature')
    .optional(),
})
  .strict()
  .describe('Meld-infected creatures in Salvage Union')

/**
 * Mech modules in Salvage Union
 */
export const ModuleSchema = BaseEntitySchema.extend({ ...SystemModuleSchema.shape })
  .strict()
  .describe('Mech modules in Salvage Union')

/**
 * Non-player characters and people in Salvage Union
 */
export const NPCSchema = BaseEntitySchema.extend({ ...CombatEntitySchema.shape })
  .extend({
    hitPoints: NonNegativeIntegerSchema.describe(
      'Hit points (HP) or structure points (SP) of this NPC; see damageType to disambiguate.'
    ),
    damageType: DamageTypeSchema.describe(
      'Whether this NPC tracks HP (organic) or SP (mechanical/cybernetic). Defaults to HP when omitted.'
    ).optional(),
    structurePoints: NonNegativeIntegerSchema.describe(
      'Structure points for mech-scale NPCs. Use instead of hitPoints when the NPC is mech-scale.'
    ).optional(),
    bioSalvageValue: NonNegativeIntegerSchema.describe(
      'Bio-salvage value for Chimerium mutants'
    ).optional(),
  })
  .strict()
  .describe('Non-player characters and people in Salvage Union')

/**
 * Random tables and roll tables in Salvage Union
 */
export const RollTableSchema = BaseEntitySchema.extend({
  table: TableSchema.describe('The roll table data with outcomes keyed by roll ranges'),
  content: ContentSchema.describe('Descriptive content for this roll table').optional(),
})
  .strict()
  .describe('Random tables and roll tables in Salvage Union')

/**
 * NPC squads and groups in Salvage Union
 */
export const SquadSchema = BaseEntitySchema.extend({
  hitPoints: NonNegativeIntegerSchema.describe('Hit points of this squad').optional(),
  actions: z.array(z.string()).describe('Action names this squad can perform'),
  traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
  damageType: DamageTypeSchema.describe('Type of damage this squad deals').optional(),
})
  .strict()
  .describe('NPC squads and groups in Salvage Union')

/**
 * Mech systems in Salvage Union
 */
export const SystemSchema = BaseEntitySchema.extend({ ...SystemModuleSchema.shape })
  .strict()
  .describe('Mech systems (weapons and utilities) in Salvage Union')

/**
 * Traits and special properties in Salvage Union
 */
export const TraitEntitySchema = BaseEntitySchema.extend({
  content: ContentSchema.describe('Definition and rules for this trait').optional(),
})
  .strict()
  .describe('Traits and special properties in Salvage Union')

/**
 * Conventional vehicles in Salvage Union
 */
export const VehicleSchema = BaseEntitySchema.extend({ ...MechanicalEntitySchema.shape })
  .strict()
  .describe('Conventional vehicles in Salvage Union')

/**
 * Player-facing guides and processes in Salvage Union (character creation, progression, downtime)
 */
export const GuideSchema = BaseEntitySchema.extend({
  guideType: GuideTypeSchema.describe('Category of this guide'),
  guideColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#000000')
    .describe('Hex color for entity display header/footer'),
  steps: z.array(GuideStepSchema).describe('Ordered sequence of steps'),
  repeatable: z.boolean().optional().describe('Whether this guide can be executed multiple times'),
})
  .strict()
  .describe('Player-facing guides and processes in Salvage Union')

/**
 * Source books and expansions for Salvage Union content
 */
export const SourceEntitySchema = BaseEntitySchema.extend({
  purchaseLink: z.string().url().describe('URL where this source can be purchased').optional(),
})
  .strict()
  .describe('Source books and expansions for Salvage Union content')

/**
 * Pre-made player characters bundled with starter sets
 */
export const PreMadeCharacterSchema = BaseEntitySchema.extend({
  pilotClass: z.string().min(1).describe('Pilot class name (e.g. "Engineer")'),
  background: z.string().min(1).describe('Pilot background'),
  motto: z.string().min(1).describe('Pilot motto'),
  keepsake: z.string().min(1).describe('Pilot keepsake'),
  hitPoints: PositiveIntegerSchema.describe('Pilot hit points'),
  actionPoints: PositiveIntegerSchema.describe('Pilot action points'),
  equipment: z.array(z.string()).describe('Pilot equipment names'),
  mech: z
    .object({
      chassis: z.string().min(1).describe('Chassis name'),
      pattern: z.string().min(1).describe('Pattern name'),
      name: z.string().min(1).describe("Mech's individual name").optional(),
    })
    .strict()
    .describe('Pre-built mech for this pilot'),
  systems: z.array(z.string()).describe('Mech system names'),
  modules: z.array(z.string()).describe('Mech module names'),
})
  .strict()
  .describe('Pre-made player characters bundled with starter sets')

/**
 * Catalog categories for organizing schemas in the UI (meta schema, not a game entity)
 */
export const CatalogCategorySchema = z
  .object({
    id: IdSchema.describe('Unique identifier for this catalog category'),
    name: NameSchema.describe('Display name of this catalog category'),
    schemas: z.array(SchemaNameSchema).describe('Schema collections included in this category'),
    flat: z.boolean().default(false).describe('Whether to display schemas in a flat list'),
  })
  .strict()
  .describe('Catalog categories for organizing schemas in the UI')

/**
 * Zod entity schemas - all 24 entity types
 */

import { z } from '../zod.js'
import {
  BaseEntitySchema,
  ContributionSchema,
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
 * Pilot abilities and skills
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
  contributions: z
    .array(ContributionSchema)
    .describe(
      'Flat stat changes this ability makes (ADR-029). An ability could previously ' +
        'declare no mechanical change at all, so Beefcake, Bionic Arms, Bionic Legs ' +
        'and Modular Face Implant were inert prose.'
    )
    .optional(),
})
  .strict()
  .describe('Pilot abilities and skills')

/**
 * Requirements for ability trees
 */
export const AbilityTreeRequirementSchema = BaseEntitySchema.extend({
  requirement: z
    .array(TreeSchema)
    .describe('List of ability tree names required to access this tree'),
})
  .strict()
  .describe('Requirements for unlocking ability trees')

/**
 * Actions, abilities, and attacks that can be performed
 */
export const MetaActionSchema = ActionSchema.describe(
  'Actions, abilities, and attacks that can be performed'
)

/**
 * Bio-Titans: mech-scale biological monsters.
 *
 * Instinctual, mech-scale creatures (e.g. Scylla, Typhon, Chrysalis) with a
 * structurePoints + actions statblock — actions often include a "Titanic
 * Actions" entry. Bio-salvage extracted from a Bio-Titan equals its starting
 * Structure Points (derived at the display layer).
 */
export const BioTitanSchema = BaseEntitySchema.extend({
  structurePoints: PositiveIntegerSchema.describe('Structure points of this bio-titan'),
  actions: z.array(z.string()).describe('Action names this bio-titan can perform'),
  traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
})
  .strict()
  .describe('Mech-scale biological monsters')

/**
 * Mech chassis definitions
 */
export const ChassisSchema = BaseEntitySchema.extend({
  ...ChassisStatsSchema.shape,
})
  .extend({
    chassisAbilities: z
      .array(z.string())
      .describe('Array of chassis ability names that reference actions.json'),
    patterns: z.array(PatternSchema).describe('Available mech patterns for this chassis'),
  })
  .strict()
  .describe('Mech chassis definitions')

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
 * Pilot Classes (Base and Hybrid)
 */
export const ClassSchema = z
  .union([BaseClassSchema, AdvancedClassSchema])
  .describe('Pilot Classes (Base and Hybrid)')

/**
 * Resource cost to build or add an upgrade bay to a Union Crawler.
 * Expansion "upgrade" bays (e.g. Bio-Mech Bay, Nanite Processing Bay) are
 * bought with a mix of Scrap (at a given Tech level) and/or Bio-Salvage.
 */
export const CrawlerBayCostSchema = z
  .object({
    scrap: NonNegativeIntegerSchema.describe(
      'Amount of Scrap required to build this bay'
    ).optional(),
    scrapTechLevel: TechLevelSchema.describe('Tech level of the Scrap required').optional(),
    bioSalvage: NonNegativeIntegerSchema.describe(
      'Amount of Bio-Salvage required to build this bay'
    ).optional(),
  })
  .strict()
  .describe('Resource cost to build or add this bay to a Union Crawler')

/**
 * Bays and facilities on Union Crawlers.
 *
 * Two shapes are supported:
 * - Core fixed facilities (Workshop Manual / Starter Set) have a crew `npc`
 *   and a `damagedEffect`.
 * - Expansion "upgrade" / found bays (e.g. Bio-Mech Bay, Nanite Processing Bay,
 *   Training Bay) are player-addable or scenario facilities with a build `cost`
 *   and/or `techLevel`, and typically no crew NPC or damaged effect.
 */
export const CrawlerBaySchema = BaseEntitySchema.extend({
  expansion: z
    .boolean()
    .describe(
      'True for expansion "upgrade"/found bays acquired during play (built for a resource cost or found as a scenario facility); absent/false for base facilities pre-installed on every Union Crawler. A stored data tag (mirrors the legalStarting convention) — never computed from source/cost/techLevel.'
    )
    .optional(),
  damagedEffect: z.string().describe('Effect when this bay is damaged').optional(),
  npc: NpcSchema.describe('NPC crew member who operates this bay').optional(),
  techLevel: TechLevelSchema.describe('Tech level of this bay').optional(),
  salvageValue: NonNegativeIntegerSchema.describe(
    'Scrap value when this bay is salvaged'
  ).optional(),
  cost: CrawlerBayCostSchema.describe(
    'Resource cost to build or add this bay to a Union Crawler'
  ).optional(),
  choices: ChoicesSchema.describe(
    'Choices available to the player when interacting with the NPC'
  ).optional(),
  tableName: z.string().describe('Reference to a roll table name').optional(),
})
  .strict()
  .describe('Bays and facilities on Union Crawlers')

/**
 * Tech levels for Union Crawlers
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
    .nullable()
    .describe('Maximum approximate population (null means unbounded — 25,000+)'),
})
  .strict()
  .describe('Tech level progression for Union Crawlers')

/**
 * Crawler vehicles
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
  .describe('Union Crawler mobile bases')

/**
 * Creatures and wildlife
 */
export const CreatureSchema = BaseEntitySchema.extend({
  ...CombatEntitySchema.shape,
})
  .extend({
    hitPoints: NonNegativeIntegerSchema.describe('Hit points of this creature'),
  })
  .strict()
  .describe('Creatures and wildlife')

/**
 * Distances
 */
export const DistanceSchema = BaseEntitySchema.extend({
  content: ContentSchema.describe('Descriptive content for this distance band').optional(),
})
  .strict()
  .describe('Distance bands and ranges')

/**
 * Tech level descriptions
 */
export const TechLevelEntitySchema = BaseEntitySchema.extend({
  techLevel: PositiveIntegerSchema.describe('Numeric tech level value'),
  content: ContentSchema.describe('Descriptive content for this tech level').optional(),
})
  .strict()
  .describe('Tech level descriptions')

/**
 * Autonomous drones.
 *
 * Most drones are configured from `systems`, but some drone-class threats
 * (e.g. The Iron Lady) carry named `actions` — sometimes including a "Titanic
 * Actions" entry — and equipped `modules`, mirroring a mech statblock.
 */
export const DroneSchema = BaseEntitySchema.extend({
  ...MechanicalEntitySchema.shape,
})
  .extend({
    actions: z.array(z.string()).describe('Action names this drone can perform').optional(),
    modules: z
      .array(z.string())
      .describe('Mech module names this drone is equipped with')
      .optional(),
    /**
     * Present only on a drone that UPGRADES with its owner. Mirrors the field of
     * the same name on `EquipmentSchema` so the two files that can supply a
     * player-facing companion describe scaling the same way: its ABSENCE is the
     * statement "this stat block is flat", rather than a fact the consuming app
     * has to know by which file the record came out of.
     *
     * Every drone in the book is flat today (Sestra Drone is Tech 3, Big Brother
     * Drone Tech 5, neither scales), so this is currently unpopulated — the
     * uniformity is the point.
     */
    bonusPerTechLevel: StatsSchema.describe('Stat bonuses gained per tech level').optional(),
    choices: ChoicesSchema.describe('Configuration choices for this drone').optional(),
  })
  .strict()
  .describe('Autonomous drones')

/**
 * Pilot equipment and gear
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
  .describe('Pilot equipment and gear')

/**
 * Faction groups and organizations
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
  .describe('Faction groups and organizations')

/**
 * Game keywords and terminology
 */
export const KeywordSchema = BaseEntitySchema.extend({
  content: ContentSchema.describe('Definition and explanation of this keyword').optional(),
})
  .strict()
  .describe('Game keywords and terminology')

/**
 * Meld-infected creatures
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
  .describe('Meld-infected creatures')

/**
 * Mech modules
 */
export const ModuleSchema = BaseEntitySchema.extend({
  ...SystemModuleSchema.shape,
  // Re-assert required name: SystemModuleSchema's optional `name` (for custom
  // system options) must not weaken the entity-level required name.
  name: BaseEntitySchema.shape.name,
})
  .strict()
  .describe('Mech modules')

/**
 * Non-player characters and people
 */
export const NPCSchema = BaseEntitySchema.extend({
  ...CombatEntitySchema.shape,
})
  .extend({
    hitPoints: NonNegativeIntegerSchema.describe(
      'Hit points (HP) or structure points (SP) of this NPC; see damageType to disambiguate.'
    ),
    damageType: DamageTypeSchema.describe(
      'Whether this NPC tracks HP (organic) or SP (mechanical/cybernetic). Defaults to HP when omitted.'
    ).optional(),
    bioSalvageValue: NonNegativeIntegerSchema.describe(
      'Bio-salvage value for Chimerium mutants'
    ).optional(),
  })
  .strict()
  .describe('Non-player characters and people')

/**
 * Random tables and roll tables
 */
export const RollTableSchema = BaseEntitySchema.extend({
  table: TableSchema.describe('The roll table data with outcomes keyed by roll ranges'),
  content: ContentSchema.describe('Descriptive content for this roll table').optional(),
})
  .strict()
  .describe('Random tables and roll tables')

/**
 * NPC squads and groups
 */
export const SquadSchema = BaseEntitySchema.extend({
  hitPoints: NonNegativeIntegerSchema.describe('Hit points of this squad').optional(),
  actions: z.array(z.string()).describe('Action names this squad can perform'),
  traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
  damageType: DamageTypeSchema.describe('Type of damage this squad deals').optional(),
})
  .strict()
  .describe('NPC squads and groups')

/**
 * Mech systems
 */
export const SystemSchema = BaseEntitySchema.extend({
  ...SystemModuleSchema.shape,
  // Re-assert required name: SystemModuleSchema's optional `name` (for custom
  // system options) must not weaken the entity-level required name.
  name: BaseEntitySchema.shape.name,
  // Traits printed on the system's own statline (e.g. the Salvaging Drill's
  // "Reliable // Salvaging") — distinct from its actions' traits, which are
  // not inherited from the containing system.
  traits: z.array(TraitSchema).describe('Traits and special properties').optional(),
})
  .strict()
  .describe('Mech systems (weapons and utilities)')

/**
 * Traits and special properties
 */
export const TraitEntitySchema = BaseEntitySchema.extend({
  content: ContentSchema.describe('Definition and rules for this trait').optional(),
})
  .strict()
  .describe('Traits and special properties')

/**
 * Conventional vehicles.
 *
 * Unlike mechs, vehicles are not built from the system/module install economy:
 * their capabilities are expressed directly as named `actions`. The `systems`
 * field inherited from MechanicalEntitySchema is omitted here, and there is no
 * `modules` field — a vehicle carries neither (the schema is strict).
 */
export const VehicleSchema = BaseEntitySchema.extend({ ...MechanicalEntitySchema.shape })
  .omit({ systems: true })
  .extend({
    actions: z.array(z.string()).describe('Action names this vehicle can perform').optional(),
  })
  .strict()
  .describe('Conventional vehicles')

/**
 * Player-facing guides and processes (character creation, progression, downtime)
 */
export const GuideSchema = BaseEntitySchema.extend({
  guideType: GuideTypeSchema.describe('Category of this guide'),
  guideColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    // #282019 IS `--color-ink`, spelled as a literal because this validates
    // DATA, not styling: the field's contract is a 6-digit hex (see the regex
    // above), so `var(--color-ink)` is not a legal value here. The default was
    // pure black, which the warm palette retired.
    //
    // It is a FALLBACK, not a shipped value. Every guide in `data/guides.json`
    // carries its own explicit hue and none of them is `#282019`, so nothing
    // currently renders on this default; it exists so a guide added without a
    // colour still parses and still gets an ink band rather than a blank one.
    //
    // The previous version of this note asserted the opposite — "load-bearing,
    // not decorative: 64 of the 79 guides omit `guideColor` and render on it".
    // That was never true of this schema: the file has held 15 guides, every one
    // with an explicit colour, since before the note was written. It is recorded
    // rather than silently deleted because the false claim pointed the wrong way
    // for a reader deciding how much this field matters — the card layer now
    // resolves a guide's whole tone from it (`entityCardTone.ts`, matching the
    // SRD index tile), and "most guides just use the default" would have been a
    // materially wrong thing to believe while touching that.
    .default('#282019')
    .describe('Hex color for entity display header/footer'),
  steps: z.array(GuideStepSchema).describe('Ordered sequence of steps'),
  repeatable: z.boolean().optional().describe('Whether this guide can be executed multiple times'),
})
  .strict()
  .describe('Player-facing guides and processes')

/**
 * Source books and expansions
 */
export const SourceEntitySchema = BaseEntitySchema.extend({
  purchaseLink: z.string().url().describe('URL where this source can be purchased').optional(),
  version: z
    .string()
    .describe('Printing/edition of the source this dataset reflects (e.g. "1.5")')
    .optional(),
  verifiedAgainst: z
    .string()
    .describe('ISO date the dataset was last verified against this printing')
    .optional(),
})
  .strict()
  .describe('Source books and expansions')

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

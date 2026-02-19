/**
 * Zod object schemas from objects.schema.json
 */

import { z } from 'zod'
import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  TechLevelSchema,
  SalvageValueSchema,
  HitPointsSchema,
  NameSchema,
  IdSchema,
  AssetUrlSchema,
  ActivationCostSchema,
} from './common.js'
import {
  SourceSchema,
  ContentTypeSchema,
  RangeSchema,
  ActionTypeSchema,
  DamageTypeSchema,
  SchemaNameSchema,
  TreeSchema,
} from './enums.js'

/**
 * Special traits and properties of items, systems, or abilities
 */
export const TraitSchema = z
  .object({
    amount: z.union([NonNegativeIntegerSchema, z.string()]).optional(),
    type: z.string(),
  })
  .strict()

/**
 * Statistics for mechs, chassis, and vehicles
 */
export const StatsSchema = z.object({
  structurePoints: NonNegativeIntegerSchema.optional(),
  energyPoints: NonNegativeIntegerSchema.optional(),
  heatCapacity: NonNegativeIntegerSchema.optional(),
  systemSlots: NonNegativeIntegerSchema.optional(),
  moduleSlots: NonNegativeIntegerSchema.optional(),
  cargoCapacity: NonNegativeIntegerSchema.optional(),
  techLevel: TechLevelSchema.optional(),
  salvageValue: SalvageValueSchema.optional(),
})

/**
 * Statistics specific to chassis
 */
export const ChassisStatsSchema = z.object({
  structurePoints: NonNegativeIntegerSchema.optional(),
  energyPoints: NonNegativeIntegerSchema.optional(),
  heatCapacity: NonNegativeIntegerSchema.optional(),
  systemSlots: NonNegativeIntegerSchema.optional(),
  moduleSlots: NonNegativeIntegerSchema.optional(),
  cargoCapacity: NonNegativeIntegerSchema.optional(),
  techLevel: TechLevelSchema.optional(),
  salvageValue: SalvageValueSchema.optional(),
})

/**
 * Statistics for equipment (systems and modules)
 */
export const EquipmentStatsSchema = z.object({
  techLevel: TechLevelSchema.optional(),
  salvageValue: SalvageValueSchema.optional(),
})

/**
 * Entity that can perform actions and has traits
 */
export const CombatEntitySchema = z.object({
  actions: z.array(z.string()).optional(),
  traits: z.array(TraitSchema).optional(),
})

/**
 * Mechanical entity with structure points and equipment stats
 */
export const MechanicalEntitySchema = z.object({
  structurePoints: PositiveIntegerSchema.optional(),
  techLevel: TechLevelSchema.optional(),
  salvageValue: SalvageValueSchema.optional(),
  systems: z.array(z.string()).optional(),
  traits: z.array(TraitSchema).optional(),
  energyPoints: NonNegativeIntegerSchema.optional(),
  heatCapacity: NonNegativeIntegerSchema.optional(),
  systemSlots: NonNegativeIntegerSchema.optional(),
  moduleSlots: NonNegativeIntegerSchema.optional(),
  cargoCapacity: NonNegativeIntegerSchema.optional(),
})

/**
 * A data value with label, optional value, and optional type
 */
export const DataValueSchema = z
  .object({
    label: z.union([z.string(), z.number()]),
    value: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
  })
  .strict()

/**
 * Block of structured content for rendering (paragraph, heading, list item, etc.)
 * Note: Using z.lazy() for recursive structure
 */
export const ContentBlockSchema: z.ZodType<{
  type?: z.infer<typeof ContentTypeSchema>
  value?: string | z.infer<typeof DataValueSchema>[]
  label?: string
  level?: number
  items?: Array<{
    type?: z.infer<typeof ContentTypeSchema>
    value?: string | z.infer<typeof DataValueSchema>[]
    label?: string
    level?: number
  }>
}> = z.lazy(() =>
  z
    .object({
      type: ContentTypeSchema.optional().default('paragraph'),
      value: z
        .union([
          z.string(),
          z.array(DataValueSchema).describe("Array of data values when type is 'datavalues'"),
        ])
        .optional(),
      label: z.string().optional(),
      level: z.number().int().min(1).max(6).optional(),
      items: z
        .array(
          z
            .object({
              type: ContentTypeSchema.optional().default('paragraph'),
              value: z
                .union([
                  z.string(),
                  z
                    .array(DataValueSchema)
                    .describe("Array of data values when type is 'datavalues'"),
                ])
                .optional(),
              label: z.string().optional(),
              level: z.number().int().min(1).max(6).optional(),
            })
            .strict()
        )
        .optional(),
    })
    .strict()
)

/**
 * Array of content blocks
 */
export const ContentSchema = z.array(ContentBlockSchema)

/**
 * Table content with label and value
 */
export const TableContentSchema = z
  .object({
    label: z.string().optional(),
    value: z.string(),
  })
  .strict()

/**
 * Column entries: flat 1-20 mapping used in multi-column roll tables (e.g. Callsign Table)
 */
const ColumnEntriesSchema = z
  .object({
    '1': TableContentSchema,
    '2': TableContentSchema,
    '3': TableContentSchema,
    '4': TableContentSchema,
    '5': TableContentSchema,
    '6': TableContentSchema,
    '7': TableContentSchema,
    '8': TableContentSchema,
    '9': TableContentSchema,
    '10': TableContentSchema,
    '11': TableContentSchema,
    '12': TableContentSchema,
    '13': TableContentSchema,
    '14': TableContentSchema,
    '15': TableContentSchema,
    '16': TableContentSchema,
    '17': TableContentSchema,
    '18': TableContentSchema,
    '19': TableContentSchema,
    '20': TableContentSchema,
  })
  .strict()

/**
 * Roll table discriminated union for random outcomes based on d20 rolls
 */
export const TableSchema = z.discriminatedUnion('type', [
  // Standard roll table
  z
    .object({
      type: z.literal('standard'),
      '1': TableContentSchema,
      '20': TableContentSchema,
      '11-19': TableContentSchema,
      '6-10': TableContentSchema,
      '2-5': TableContentSchema,
    })
    .strict(),
  // Alternate roll table
  z
    .object({
      type: z.literal('alternate'),
      '1': TableContentSchema,
      '19-20': TableContentSchema,
      '11-18': TableContentSchema,
      '6-10': TableContentSchema,
      '2-5': TableContentSchema,
    })
    .strict(),
  // Flat roll table with individual outcomes
  z
    .object({
      type: z.literal('flat'),
      '1': TableContentSchema,
      '2': TableContentSchema,
      '3': TableContentSchema,
      '4': TableContentSchema,
      '5': TableContentSchema,
      '6': TableContentSchema,
      '7': TableContentSchema,
      '8': TableContentSchema,
      '9': TableContentSchema,
      '10': TableContentSchema,
      '11': TableContentSchema,
      '12': TableContentSchema,
      '13': TableContentSchema,
      '14': TableContentSchema,
      '15': TableContentSchema,
      '16': TableContentSchema,
      '17': TableContentSchema,
      '18': TableContentSchema,
      '19': TableContentSchema,
      '20': TableContentSchema,
    })
    .strict(),
  // Dramatic roll table
  z
    .object({
      type: z.literal('dramatic'),
      '20': TableContentSchema,
    })
    .strict(),
  // Duos roll table
  z
    .object({
      type: z.literal('duos'),
      '1-2': TableContentSchema,
      '3-4': TableContentSchema,
      '5-6': TableContentSchema,
      '7-8': TableContentSchema,
      '9-10': TableContentSchema,
      '11-12': TableContentSchema,
      '13-14': TableContentSchema,
      '15-16': TableContentSchema,
      '17-18': TableContentSchema,
      '19-20': TableContentSchema,
    })
    .strict(),
  // Bio-chassis roll table
  z
    .object({
      type: z.literal('bio-chassis'),
      '1': TableContentSchema,
      '2-3': TableContentSchema,
      '4-5': TableContentSchema,
      '6-8': TableContentSchema,
      '9-10': TableContentSchema,
      '11-19': TableContentSchema,
      '20': TableContentSchema,
    })
    .strict(),
  // Multi-column roll table (two d20 rolls: column then entry)
  z
    .object({
      type: z.literal('columns'),
      '1-4': ColumnEntriesSchema,
      '5-8': ColumnEntriesSchema,
      '9-12': ColumnEntriesSchema,
      '13-16': ColumnEntriesSchema,
      '17-20': ColumnEntriesSchema,
    })
    .strict(),
])

/**
 * Pattern system/module configuration
 */
export const PatternSystemModuleSchema = z
  .object({
    name: NameSchema,
    count: NonNegativeIntegerSchema.optional(),
    preselectedChoices: z
      .record(z.string(), NameSchema)
      .describe('Preselected choices for this system or module, keyed by choice ID')
      .optional(),
  })
  .strict()

/**
 * A system or module that can be installed on a mech
 */
export const SystemModuleSchema = StatsSchema.extend({
  techLevel: TechLevelSchema,
  slotsRequired: NonNegativeIntegerSchema,
  salvageValue: SalvageValueSchema,
  recommended: z.boolean().optional(),
  count: NonNegativeIntegerSchema.optional(),
  actions: z.array(z.string()),
})

/**
 * Choice options schema
 */
const ChoiceOptionSchema = z
  .object({
    label: z.string(),
    value: z.string(),
    description: z.string().optional(),
  })
  .strict()

/**
 * Choice constraints schema
 */
const ChoiceConstraintsSchema = z
  .object({
    field: z.string().optional(),
    min: NonNegativeIntegerSchema.optional(),
    max: NonNegativeIntegerSchema.optional(),
    scalesWithField: z
      .string()
      .describe('Dynamic max: resolve this field name from the parent entity to use as max')
      .optional(),
  })
  .strict()
  .refine((data) => data.min === undefined || data.max === undefined || data.min <= data.max, {
    message: 'min must be less than or equal to max',
    path: ['min'],
  })

/**
 * Choice type enum
 */
const ChoiceTypeSchema = z.enum(['permanent', 'session', 'freeform'])

/**
 * Choice schema (using z.lazy() for recursive reference to ContentSchema)
 */
export const ChoiceSchema: z.ZodType<{
  id: string
  name: string
  choiceType?: 'permanent' | 'session' | 'freeform'
  content?: z.infer<typeof ContentSchema>
  rollTable?: string
  schemaEntities?: string[]
  schema?: z.infer<typeof SchemaNameSchema>[]
  customSystemOptions?: z.infer<typeof SystemModuleSchema>[]
  setIndexable?: boolean
  multiSelect?: boolean
  choiceOptions?: z.infer<typeof ChoiceOptionSchema>[]
  constraints?: z.infer<typeof ChoiceConstraintsSchema>
}> = z.lazy(() =>
  z
    .object({
      id: IdSchema,
      name: NameSchema,
      choiceType: ChoiceTypeSchema.describe(
        'permanent: recorded on sheet; session: made during gameplay; freeform: arbitrary text'
      ).optional(),
      content: ContentSchema.optional(),
      rollTable: z.string().optional(),
      schemaEntities: z.array(z.string()).optional(),
      schema: z.array(SchemaNameSchema).optional(),
      customSystemOptions: z.array(SystemModuleSchema).optional(),
      setIndexable: z.boolean().optional(),
      multiSelect: z
        .boolean()
        .describe('If true, this choice can be selected multiple times')
        .optional(),
      choiceOptions: z
        .array(ChoiceOptionSchema)
        .describe('Structured options for this choice (similar to actionOptions)')
        .optional(),
      constraints: ChoiceConstraintsSchema.optional(),
    })
    .strict()
)

/**
 * Array of choices
 */
export const ChoicesSchema = z.array(ChoiceSchema)

/**
 * NPC associated with an entity
 */
export const NpcSchema: z.ZodType<{
  position: string
  content?: z.infer<typeof ContentSchema>
  hitPoints: z.infer<typeof HitPointsSchema>
  choices?: z.infer<typeof ChoicesSchema>
}> = z.lazy(() =>
  z
    .object({
      position: NameSchema,
      content: ContentSchema.optional(),
      hitPoints: HitPointsSchema,
      choices: ChoicesSchema.optional(),
    })
    .strict()
)

/**
 * Pattern schema (using z.lazy() for recursive reference)
 */
export const PatternSchema: z.ZodType<{
  name: string
  content?: z.infer<typeof ContentSchema>
  legalStarting?: boolean
  source?: z.infer<typeof SourceSchema>
  page?: z.infer<typeof PositiveIntegerSchema>
  systems: z.infer<typeof PatternSystemModuleSchema>[]
  modules: z.infer<typeof PatternSystemModuleSchema>[]
  drone?: {
    systems: string[]
    modules: string[]
  }
}> = z.lazy(() =>
  z
    .object({
      name: NameSchema,
      content: ContentSchema.optional(),
      legalStarting: z.boolean().optional(),
      source: SourceSchema.optional(),
      page: PositiveIntegerSchema.optional(),
      systems: z.array(PatternSystemModuleSchema),
      modules: z.array(PatternSystemModuleSchema),
      drone: z
        .object({
          systems: z.array(z.string()),
          modules: z.array(z.string()),
        })
        .strict()
        .optional(),
    })
    .strict()
)

/**
 * Damage schema
 */
export const DamageSchema = z
  .object({
    damageType: DamageTypeSchema,
    amount: z.union([NonNegativeIntegerSchema, z.string()]),
  })
  .strict()

/**
 * Activation currency enum
 */
const ActivationCurrencySchema = z.enum(['EP or AP', 'SP or HP', 'Variable'])

/**
 * Action schema (using z.lazy() for recursive references)
 */
export const ActionSchema: z.ZodType<{
  id: string
  name: string
  content?: z.infer<typeof ContentSchema>
  structurePoints?: number
  energyPoints?: number
  heatCapacity?: number
  systemSlots?: number
  moduleSlots?: number
  cargoCapacity?: number
  techLevel?: z.infer<typeof TechLevelSchema>
  salvageValue?: number
  displayName?: string
  activationCost?: z.infer<typeof ActivationCostSchema>
  range?: z.infer<typeof RangeSchema>
  actionType?: z.infer<typeof ActionTypeSchema>
  traits?: z.infer<typeof TraitSchema>[]
  damage?: z.infer<typeof DamageSchema>
  choices?: z.infer<typeof ChoiceSchema>[]
  table?: z.infer<typeof TableSchema>
  tableName?: string
  hidden?: boolean
  activationCurrency?: z.infer<typeof ActivationCurrencySchema>
  source?: z.infer<typeof SourceSchema>
  page?: z.infer<typeof PositiveIntegerSchema>
  actionSource?: z.infer<typeof SchemaNameSchema>
  drone?: string
  requiredTraits?: string[]
}> = z.lazy(() =>
  z.object({
    id: IdSchema,
    name: NameSchema,
    content: ContentSchema.optional(),
    structurePoints: z.number().optional(),
    energyPoints: z.number().optional(),
    heatCapacity: z.number().optional(),
    systemSlots: z.number().optional(),
    moduleSlots: z.number().optional(),
    cargoCapacity: z.number().optional(),
    techLevel: TechLevelSchema.optional(),
    salvageValue: z.number().optional(),
    displayName: NameSchema.optional(),
    activationCost: ActivationCostSchema.optional(),
    range: RangeSchema.optional(),
    actionType: ActionTypeSchema.optional(),
    traits: z.array(TraitSchema).optional(),
    damage: DamageSchema.optional(),
    choices: z.array(ChoiceSchema).optional(),
    table: TableSchema.optional(),
    tableName: z.string().optional().describe('Reference to a roll table name'),
    hidden: z
      .boolean()
      .describe('If true, this action will not affect the rendering of the entity display')
      .optional(),
    activationCurrency: ActivationCurrencySchema.optional(),
    source: SourceSchema.optional(),
    page: PositiveIntegerSchema.optional(),
    actionSource: SchemaNameSchema.optional(),
    drone: z.string().optional(),
    requiredTraits: z.array(z.string()).optional(),
  })
)

/**
 * Basic entity with name, content, source, and page reference
 */
export const BaseEntitySchema = z.object({
  asset_url: AssetUrlSchema.optional(),
  content: ContentSchema.optional(),
  id: IdSchema,
  indexable: z.boolean().default(true),
  blackMarket: z.boolean().default(false),
  name: NameSchema,
  source: SourceSchema,
  page: PositiveIntegerSchema,
})

/**
 * Bonus values that increase with tech level
 */
export const BonusPerTechLevelSchema = StatsSchema

/**
 * Advanced or hybrid character class
 */
export const AdvancedClassSchema = BaseEntitySchema.extend({
  hybrid: z
    .boolean()
    .describe('Whether this is a hybrid class (cannot be selected as initial class)')
    .optional(),
  advancedTree: TreeSchema,
  legendaryTree: TreeSchema,
}).strict()

/**
 * Formation member schema
 * Supports chassis+pattern combos and standalone entities (vehicles, drones, squads, npcs)
 */
export const FormationMechSchema = z
  .object({
    chassis: z.string(),
    pattern: z.string().optional(),
    schema: SchemaNameSchema.optional(),
    source: SourceSchema,
    page: PositiveIntegerSchema,
    quantity: z.number().int().positive().optional(),
  })
  .strict()

/**
 * Grant schema
 */
export const GrantSchema = z
  .object({
    schema: z.union([SchemaNameSchema, z.literal('choice')]),
    name: NameSchema,
  })
  .strict()

/**
 * Mutation type for crawler type bonuses (e.g. Battle crawler's extra weapon slot + SP)
 */
const CrawlerMutationTypeSchema = z.enum(['weapon_slots', 'max_sp_bonus'])

/**
 * A mutation applied by a crawler type that modifies game rules
 */
export const CrawlerMutationSchema = z
  .object({
    type: CrawlerMutationTypeSchema,
    value: z.number().int(),
  })
  .strict()

/**
 * Schema name (includes 'actions' as special case)
 */
export const SchemaNameWithActionsSchema = z.union([SchemaNameSchema, z.literal('actions')])

/**
 * Filter criteria for selecting entities in a guide step
 */
const GuideStepFilterSchema = z
  .object({
    field: z.string().describe('Field name on the target entity to filter by'),
    operator: z
      .enum(['eq', 'ne'])
      .optional()
      .describe('Comparison operator: eq (default) or ne (not equal)'),
    value: z
      .union([z.string(), z.number(), z.boolean()])
      .describe('Value to compare the field against')
      .optional(),
    min: NonNegativeIntegerSchema.optional(),
    max: NonNegativeIntegerSchema.optional(),
  })
  .strict()

/**
 * Type of decision a guide step represents
 */
const GuideStepTypeSchema = z.enum([
  'select-one',
  'select-many',
  'freeform',
  'roll-table',
  'info',
  'sub-guide',
])

/**
 * A single step in a guide
 */
export const GuideStepSchema: z.ZodType<{
  id: string
  name: string
  stepType: z.infer<typeof GuideStepTypeSchema>
  section?: string
  content?: z.infer<typeof ContentSchema>
  schema?: z.infer<typeof SchemaNameWithActionsSchema>[]
  schemaEntities?: string[]
  schemaField?: string
  rollTable?: string
  choiceOptions?: z.infer<typeof ChoiceOptionSchema>[]
  filters?: z.infer<typeof GuideStepFilterSchema>[]
  constraints?: z.infer<typeof ChoiceConstraintsSchema>
  dependsOn?: string[]
  contextFrom?: string
  guideRef?: string
  optional?: boolean
  paperOnly?: boolean
  entityLayout?: 'sidebar'
}> = z.lazy(() =>
  z
    .object({
      id: IdSchema,
      name: NameSchema,
      stepType: GuideStepTypeSchema,
      section: z
        .string()
        .describe('Section label; starts a new numbered group when present')
        .optional(),
      content: ContentSchema.optional(),
      schema: z.array(SchemaNameWithActionsSchema).describe('Schema(s) to select from').optional(),
      schemaEntities: z
        .array(z.string())
        .describe('Specific entity names within the schema')
        .optional(),
      schemaField: z
        .string()
        .describe(
          'Field on the parent entity whose values are the options (e.g., "patterns" on chassis)'
        )
        .optional(),
      rollTable: z.string().describe('Roll table name to use').optional(),
      choiceOptions: z
        .array(ChoiceOptionSchema)
        .describe('Static options for this step')
        .optional(),
      filters: z.array(GuideStepFilterSchema).optional(),
      constraints: ChoiceConstraintsSchema.optional(),
      dependsOn: z
        .array(z.string())
        .describe('Step IDs that must be completed before this step')
        .optional(),
      contextFrom: z
        .string()
        .describe(
          'Step ID whose result provides context (e.g., chassis selection provides patterns)'
        )
        .optional(),
      guideRef: z.string().describe('ID of another guide to execute as a sub-guide').optional(),
      optional: z.boolean().optional(),
      paperOnly: z
        .boolean()
        .describe('Step only applies to paper play (e.g. writing down stats on a character sheet)')
        .optional(),
      entityLayout: z
        .enum(['sidebar'])
        .describe('Layout for entity displays: sidebar places entities in a left column')
        .optional(),
    })
    .strict()
)

/**
 * Category of a guide
 */
export const GuideTypeSchema = z.enum([
  'character-creation',
  'mech-creation',
  'crawler-creation',
  'progression',
  'downtime',
  'gameplay',
])

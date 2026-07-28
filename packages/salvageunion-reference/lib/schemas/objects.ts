/**
 * Zod object schemas from objects.schema.json
 */

import { z } from '../zod.js'
import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  TechLevelSchema,
  NameSchema,
  IdSchema,
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
    amount: z
      .union([NonNegativeIntegerSchema, z.string()])
      .describe('Numeric or variable amount for this trait')
      .optional(),
    type: z.string().describe('Trait type identifier'),
  })
  .strict()
  .describe('Special traits and properties of items, systems, or abilities')

/**
 * Statistics for mechs, chassis, and vehicles
 */
export const StatsSchema = z
  .object({
    structurePoints: NonNegativeIntegerSchema.describe('Structure points (mech health)').optional(),
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
 * Statistics for equipment (systems and modules)
 */
export const EquipmentStatsSchema = z
  .object({
    techLevel: TechLevelSchema.optional(),
    salvageValue: NonNegativeIntegerSchema.describe('Scrap value when salvaged').optional(),
  })
  .describe('Statistics for equipment (systems and modules)')

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
    structurePoints: PositiveIntegerSchema.describe('Structure points (mech health)').optional(),
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
 * Block of structured content for rendering (paragraph, heading, list item, etc.)
 * Note: Using z.lazy() for recursive structure
 */
export const ContentBlockSchema: z.ZodType<{
  type?: z.infer<typeof ContentTypeSchema>
  value?: string | z.infer<typeof DataValueSchema>[]
  label?: string
  level?: number
  lead?: boolean
  choiceId?: string
  items?: Array<{
    type?: z.infer<typeof ContentTypeSchema>
    value?: string | z.infer<typeof DataValueSchema>[]
    label?: string
    level?: number
  }>
}> = z
  .lazy(() =>
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
        lead: z.boolean().optional(),
        choiceId: z
          .string()
          .describe(
            'When type is "choice": the id of the entity choice to render inline at this position'
          )
          .optional(),
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
  .describe('Block of structured content for rendering (paragraph, heading, list item, etc.)')

/**
 * Array of content blocks
 */
export const ContentSchema = z
  .array(ContentBlockSchema)
  .describe('Array of structured content blocks')

/**
 * Table content with label and value
 */
export const TableContentSchema = z
  .object({
    label: z.string().describe('Optional label for this table entry').optional(),
    value: z.string().describe('Result text for this table entry'),
  })
  .strict()
  .describe('Table content with label and value for roll table entries')

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
export const TableSchema = z
  .discriminatedUnion('type', [
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
    // Salvage cache roll table (singletons at 1 and 20, paired buckets in between)
    z
      .object({
        type: z.literal('salvage-cache'),
        '1': TableContentSchema,
        '2-3': TableContentSchema,
        '4-5': TableContentSchema,
        '6-7': TableContentSchema,
        '8-9': TableContentSchema,
        '10-11': TableContentSchema,
        '12-13': TableContentSchema,
        '14-15': TableContentSchema,
        '16-17': TableContentSchema,
        '18-19': TableContentSchema,
        '20': TableContentSchema,
      })
      .strict(),
    // Octet roll table (singletons at 1 and 20, six 3-wide buckets in between)
    z
      .object({
        type: z.literal('octet'),
        '1': TableContentSchema,
        '2-4': TableContentSchema,
        '5-7': TableContentSchema,
        '8-10': TableContentSchema,
        '11-13': TableContentSchema,
        '14-16': TableContentSchema,
        '17-19': TableContentSchema,
        '20': TableContentSchema,
      })
      .strict(),
  ])
  .describe('Roll table for random outcomes based on d20 rolls')

/**
 * Pattern system/module configuration
 */
export const PatternSystemModuleSchema = z
  .object({
    name: NameSchema.describe('Name of the system or module'),
    count: NonNegativeIntegerSchema.describe(
      'Number of this system/module in the pattern'
    ).optional(),
    preselectedChoices: z
      .record(z.string(), NameSchema)
      .describe('Preselected choices for this system or module, keyed by choice ID')
      .optional(),
  })
  .strict()
  .describe('System or module configuration within a pattern')

/**
 * Explicit, per-installed-item bonuses a system/module applies to a mech's
 * derived core maxima. Each field is the FLAT amount this one installed item
 * adds to the corresponding mech maximum; consumers sum (bonus × installed
 * count) across all installed systems/modules.
 *
 * This is deliberately distinct from the absolute-stat fields in StatsSchema
 * (which describe an entity's own stats): these are signed modifiers applied to
 * the host mech. Only populate items whose rule text states a flat numeric
 * core-stat change (e.g. Cargo Pod +1 Cargo Capacity, Heat Sink +1 Max Heat,
 * Capacitance Bank +2 EP). Items with prose-only or conditional benefits get
 * no bonus data — never infer a number from prose.
 */
export const MechStatBonusSchema = z
  .object({
    structurePoints: z
      .number()
      .int()
      .describe('Flat bonus to the mech max Structure Points per installed item')
      .optional(),
    energyPoints: z
      .number()
      .int()
      .describe('Flat bonus to the mech max Energy Points per installed item')
      .optional(),
    heatCapacity: z
      .number()
      .int()
      .describe('Flat bonus to the mech max Heat Capacity per installed item')
      .optional(),
    cargoCapacity: z
      .number()
      .int()
      .describe('Flat bonus to the mech Cargo Capacity per installed item')
      .optional(),
  })
  .strict()
  .describe('Flat per-installed-item bonuses this system/module applies to a mech’s derived maxima')

/**
 * The stats a contribution may raise or lower (ADR-029).
 *
 * A superset of `MechStatBonusSchema`'s four keys: an ability can change a
 * PILOT stat (Bionic Legs "+2 Max HP", Beefcake "+4 Inventory Capacity") or a
 * slot COUNT (Modular Face Implant "your Pilot gains a Module Slot"), neither of
 * which the mech-only shape could express.
 */
export const ContributionStatSchema = z.enum([
  // mech
  'structurePoints',
  'energyPoints',
  'heatCapacity',
  'cargoCapacity',
  'systemSlots',
  'moduleSlots',
  // pilot
  'maxHp',
  'maxAp',
  'inventorySlots',
])

/**
 * Whose stat a contribution changes.
 *
 * `self` is the host the contribution is declared on (a system contributing to
 * its own mech). The others exist because Beefcake is a PILOT ability that
 * raises the piloted MECH's Max SP and Cargo while also raising the pilot's own
 * Max HP and Inventory — one record, two targets, which no single-target shape
 * could express.
 */
export const ContributionTargetSchema = z.enum(['self', 'pilot', 'pilotedMech', 'crawler'])

/**
 * How much a contribution is worth.
 *
 * A plain integer covers most records. `perTechLevel` exists for Beefcake —
 * "increases its Max Structure Points by 3+X (where X is the Mech's Tech
 * Level)" — where the amount is `flat + perTechLevel × techLevel`. Rendering the
 * amount needs the target's tech level, so a consumer that cannot supply one
 * resolves `perTechLevel` to 0 rather than guessing.
 */
export const ContributionAmountSchema = z.union([
  z.number().int(),
  z
    .object({
      flat: z.number().int().describe('The constant part').optional(),
      perTechLevel: z.number().int().describe("Multiplied by the target's tech level"),
    })
    .strict(),
])

/**
 * A single mechanical contribution a piece of content makes to a stat
 * (ADR-029).
 *
 * This is the numeric half of the converged model. The trait/damage/range half
 * already exists as `ChoiceEffectSchema` and is applied by `resolveChoiceView`;
 * the two are declared side by side rather than merged into one union, because
 * they are resolved at different layers — stats at derivation time, effects at
 * dataview time.
 *
 * **Never infer a contribution from prose.** Populate it only where the rules
 * text states a flat mechanical change; anything conditional, prose-only, or
 * duration-bound stays undeclared and is answered to the parity audit with an
 * explicit exemption instead.
 */
export const ContributionSchema = z
  .object({
    stat: ContributionStatSchema,
    amount: ContributionAmountSchema,
    target: ContributionTargetSchema.describe('Defaults to `self` when absent').optional(),
    stacks: z
      .boolean()
      .describe('Applies once per installed copy (default true for installable items)')
      .optional(),
    voidWhen: z
      .enum(['damaged', 'destroyed'])
      .describe('Condition at which this contribution stops applying')
      .optional(),
    note: z.string().describe('Why this is encoded the way it is').optional(),
  })
  .strict()
  .describe('A flat mechanical contribution this content makes to a stat')

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
  statBonus: MechStatBonusSchema.describe(
    'Explicit flat bonuses this item applies to the host mech’s derived maxima, summed per installed copy'
  ).optional(),
  actions: z.array(z.string()).describe('Action names this system/module provides'),
}).describe('A system or module that can be installed on a mech')

/**
 * Choice effect schema — describes a mechanical effect applied when a choice option is selected
 */
/**
 * A single mechanical effect of a choice option, discriminated by `op` so each
 * operation only permits the fields it actually uses (no `removeTrait` with an
 * `amount`, no `addDamage` with an `amount`, etc.):
 *
 * - `addTrait`    — add a trait by name; optional `amount` is its magnitude
 *                   (e.g. Burn 1). Adding a trait that already exists upgrades it.
 * - `removeTrait` — strip a trait by name.
 * - `setRange`    — replace the Range datavalue.
 * - `addDamage`   — increase the Damage datavalue; optional `unit` (e.g. "SP").
 */
export const ChoiceEffectSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('addTrait'),
      value: z.string(),
      amount: z.union([z.string(), z.number()]).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('removeTrait'),
      value: z.string(),
    })
    .strict(),
  z
    .object({
      op: z.literal('setRange'),
      value: z.union([z.string(), z.number()]),
    })
    .strict(),
  z
    .object({
      op: z.literal('addDamage'),
      value: z.union([z.string(), z.number()]),
      unit: z.string().optional(),
    })
    .strict(),
])

/**
 * Choice options schema
 */
const ChoiceOptionSchema = z
  .object({
    label: z.string(),
    value: z.string(),
    description: z.string().optional(),
    effects: z.array(ChoiceEffectSchema).optional(),
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
 * Choice cardinality — how many picks a choice grants.
 * `max` is either a fixed number or `{ scalesWith }`, a field name resolved on
 * the parent entity (e.g. `techLevel`). Replaces `multiSelect` +
 * `constraints.min/max` + `constraints.scalesWithField`.
 */
const CardinalitySchema = z
  .object({
    min: NonNegativeIntegerSchema,
    max: z.union([NonNegativeIntegerSchema, z.object({ scalesWith: z.string() }).strict()]),
  })
  .strict()

/**
 * Choice source — the discriminated "where do the options come from" axis
 * ([ADR ref] the unified choice model). Exactly one `kind`; the renderer
 * switches on it and never probes optional fields.
 *
 * - `text`          — a free-text field (was: no option source).
 * - `table`         — roll on a named table, or choose your own.
 * - `options`       — an inline structured option list (was: choiceOptions).
 * - `catalog`       — pick a card-bearing entity from schema collection(s),
 *                     optionally a named shortlist and/or a filter (a numeric
 *                     `field` range, or `damageType` — keep only systems whose
 *                     actions deal that damage type, i.e. Weapons Systems);
 *                     `reveals` flips index visibility.
 *                     Schema-only (no shortlist) → resolved to an entity listing.
 * - `systemVariant` — pick from inline custom System/Module variants.
 */
const ChoiceSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), multiline: z.boolean().optional() }).strict(),
  z
    .object({
      kind: z.literal('table'),
      rollTable: z.string(),
      orChooseOwn: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal('options'), options: z.array(ChoiceOptionSchema) }).strict(),
  z
    .object({
      kind: z.literal('catalog'),
      schema: z.array(SchemaNameSchema).optional(),
      entities: z.array(z.string()).optional(),
      filter: z
        .object({
          field: z.string().optional(),
          min: NonNegativeIntegerSchema.optional(),
          max: NonNegativeIntegerSchema.optional(),
          damageType: DamageTypeSchema.optional(),
        })
        .strict()
        .optional(),
      reveals: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal('systemVariant'), options: z.array(SystemModuleSchema) }).strict(),
])

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
  multiSelect?: boolean
  choiceOptions?: z.infer<typeof ChoiceOptionSchema>[]
  constraints?: z.infer<typeof ChoiceConstraintsSchema>
  source?: z.infer<typeof ChoiceSourceSchema>
  cardinality?: z.infer<typeof CardinalitySchema>
  lifetime?: 'permanent' | 'session'
}> = z
  .lazy(() =>
    z
      .object({
        id: IdSchema.describe('Unique identifier for this choice'),
        name: NameSchema.describe('Display name for this choice'),
        choiceType: ChoiceTypeSchema.describe(
          'permanent: recorded on sheet; session: made during gameplay; freeform: arbitrary text'
        ).optional(),
        content: ContentSchema.describe('Descriptive content for this choice').optional(),
        rollTable: z.string().describe('Roll table name to use for random selection').optional(),
        schemaEntities: z
          .array(z.string())
          .describe('Specific entity names to choose from')
          .optional(),
        schema: z.array(SchemaNameSchema).describe('Schema collections to choose from').optional(),
        customSystemOptions: z
          .array(SystemModuleSchema)
          .describe('Custom system/module options for this choice')
          .optional(),
        multiSelect: z
          .boolean()
          .describe('If true, this choice can be selected multiple times')
          .optional(),
        choiceOptions: z
          .array(ChoiceOptionSchema)
          .describe('Structured options for this choice (similar to actionOptions)')
          .optional(),
        constraints: ChoiceConstraintsSchema.describe('Constraints on selection count').optional(),
        source: ChoiceSourceSchema.describe(
          'Discriminated option source (text/table/options/catalog/systemVariant) — the unified axis'
        ).optional(),
        cardinality: CardinalitySchema.describe(
          'How many picks this choice grants (replaces multiSelect + constraints)'
        ).optional(),
        lifetime: z
          .enum(['permanent', 'session'])
          .describe('permanent: recorded on sheet; session: made during gameplay')
          .optional(),
      })
      .strict()
  )
  .describe('A player-facing choice with options to select from')

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
  hitPoints: z.infer<typeof NonNegativeIntegerSchema>
  choices?: z.infer<typeof ChoicesSchema>
}> = z
  .lazy(() =>
    z
      .object({
        position: NameSchema.describe('Role or position title of this NPC'),
        content: ContentSchema.describe('Descriptive content about this NPC').optional(),
        hitPoints: NonNegativeIntegerSchema.describe('Hit points of this NPC'),
        choices: ChoicesSchema.describe(
          'Choices available when interacting with this NPC'
        ).optional(),
      })
      .strict()
  )
  .describe('NPC associated with an entity (e.g., crawler bay crew member)')

/**
 * Named drone configuration for patterns with multiple drones
 */
export const PatternDroneConfigSchema = z
  .object({
    name: NameSchema.describe('Name of this drone configuration'),
    /**
     * The `drones` entry this configuration instantiates. Absent means `name`
     * IS the stat block (Little Sestra's "Sestra Drone"); present means `name`
     * is an INSTANCE name over a shared stat block — Big Brother's DronTek
     * pattern fields four differently-kitted "Big Brother Drone"s called Shield
     * Drone, Anti-Missile Drone, Fire Support Drone and Minelayer Drone, none
     * of which exist as their own `drones` records.
     */
    ref: z
      .string()
      .optional()
      .describe('Name of the drones entry this configuration instantiates (defaults to `name`)'),
    systems: z.array(z.string()).describe('System names installed on this drone'),
    modules: z.array(z.string()).describe('Module names installed on this drone'),
  })
  .strict()
  .describe('Named drone configuration for patterns with multiple drones')

/**
 * Pattern schema (using z.lazy() for recursive reference)
 */
export const PatternSchema: z.ZodType<{
  name: string
  content?: z.infer<typeof ContentSchema>
  legalStarting?: boolean
  hidden?: boolean
  source?: z.infer<typeof SourceSchema>
  page?: z.infer<typeof PositiveIntegerSchema>
  booklet?: string
  additionalSources?: z.infer<typeof AdditionalSourceSchema>[]
  systems: z.infer<typeof PatternSystemModuleSchema>[]
  modules: z.infer<typeof PatternSystemModuleSchema>[]
  drones?: z.infer<typeof PatternDroneConfigSchema>[]
}> = z
  .lazy(() =>
    z
      .object({
        name: NameSchema.describe('Name of this mech pattern'),
        content: ContentSchema.describe('Descriptive content for this pattern').optional(),
        legalStarting: z.boolean().describe('Whether this is a valid starting pattern').optional(),
        hidden: z
          .boolean()
          .describe(
            'Withhold this pattern from every rendered surface while keeping the record in the dataset. A stored data tag (mirrors the legalStarting convention) — never computed from source. Set on the community-designed "Mech Monday" patterns, which are not rulebook-PDF-sourced.'
          )
          .optional(),
        source: SourceSchema.describe('Source book for this pattern').optional(),
        page: PositiveIntegerSchema.describe('Page number in the source book').optional(),
        booklet: z
          .string()
          .min(1)
          .describe(
            'Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources.'
          )
          .optional(),
        additionalSources: z
          .array(AdditionalSourceSchema)
          .describe('Other source books where this pattern is reprinted')
          .optional(),
        systems: z.array(PatternSystemModuleSchema).describe('Systems included in this pattern'),
        modules: z.array(PatternSystemModuleSchema).describe('Modules included in this pattern'),
        drones: z
          .array(PatternDroneConfigSchema)
          .describe('Named drone configurations for this pattern')
          .optional(),
      })
      .strict()
  )
  .describe('A preset mech loadout defining systems and modules for a chassis')

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
}> = z
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
        requiredTraits: z
          .array(z.string())
          .describe('Trait names required to use this action')
          .optional(),
      })
      .strict()
  )
  .describe('An action, ability, or attack that can be performed')

/**
 * Reprint of an entity in a secondary source book
 *
 * `booklet` is optional and used when a source is a multi-booklet product
 * (e.g. the Salvage Union Starter Set, which uses CR / PH / PC / RR / AP codes
 * for its Core Rulebook / Pilots Handbook / Parts Catalogue / Rules Reference / Asset Pack).
 * Single-volume sources omit it.
 */
export const AdditionalSourceSchema = z
  .object({
    source: SourceSchema.describe('Secondary source book this entity also appears in'),
    booklet: z
      .string()
      .min(1)
      .describe(
        'Booklet code within a multi-booklet source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set — Core Rulebook / Pilots Handbook / Parts Catalogue / Rules Reference / Asset Pack). Omit for single-volume sources.'
      )
      .optional(),
    page: PositiveIntegerSchema.describe('Page number in the secondary source book'),
  })
  .strict()
  .describe('A secondary source where this entity is reprinted (e.g. condensed in a Starter Set)')

/**
 * Basic entity with name, content, source, and page reference
 */
export const BaseEntitySchema = z
  .object({
    hasArtwork: z
      .boolean()
      .describe('Whether this entity has artwork; the .webp URL is derived from schema + slug')
      .optional(),
    content: ContentSchema.describe('Descriptive content blocks for this entity').optional(),
    id: IdSchema.describe('Unique identifier for this entity'),
    blackMarket: z
      .boolean()
      .default(false)
      .describe('Whether this entity is only available on the black market'),
    name: NameSchema.describe('Display name of this entity'),
    source: SourceSchema.describe('Primary source book this entity appears in'),
    page: PositiveIntegerSchema.describe('Page number in the primary source book'),
    booklet: z
      .string()
      .min(1)
      .describe(
        'Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources.'
      )
      .optional(),
    additionalSources: z
      .array(AdditionalSourceSchema)
      .describe('Other source books where this entity is reprinted')
      .optional(),
  })
  .describe('Base entity with name, content, source, and page reference')

/**
 * Advanced or hybrid character class
 */
export const AdvancedClassSchema = BaseEntitySchema.extend({
  hybrid: z
    .boolean()
    .describe('Whether this is a hybrid class (cannot be selected as initial class)')
    .optional(),
  advancedTree: TreeSchema.describe('Advanced ability tree for this class'),
  legendaryTree: TreeSchema.describe('Legendary ability tree for this class'),
})
  .strict()
  .describe('Advanced or hybrid character class')

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
}> = z
  .lazy(() =>
    z
      .object({
        id: IdSchema.describe('Unique identifier for this guide step'),
        name: NameSchema.describe('Display name of this guide step'),
        stepType: GuideStepTypeSchema.describe(
          'Type of decision this step represents (select-one, select-many, freeform, etc.)'
        ),
        section: z
          .string()
          .describe('Section label; starts a new numbered group when present')
          .optional(),
        content: ContentSchema.describe('Descriptive content for this step').optional(),
        schema: z
          .array(SchemaNameWithActionsSchema)
          .describe('Schema(s) to select from')
          .optional(),
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
          .describe(
            'Step only applies to paper play (e.g. writing down stats on a character sheet)'
          )
          .optional(),
        entityLayout: z
          .enum(['sidebar'])
          .describe('Layout for entity displays: sidebar places entities in a left column')
          .optional(),
      })
      .strict()
  )
  .describe('A single step in a guide process')

/**
 * Category of a guide
 */
export const GuideTypeSchema = z
  .enum([
    'character-creation',
    'mech-creation',
    'crawler-creation',
    'progression',
    'downtime',
    'gameplay',
  ])
  .describe('Category of a guide (character creation, mech creation, etc.)')

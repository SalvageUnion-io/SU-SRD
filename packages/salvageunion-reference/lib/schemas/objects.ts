/**
 * Zod object schemas — the shapes that appear INSIDE entity records, as opposed
 * to the entity records themselves (`entities.ts`).
 *
 * This module is now a RE-EXPORT BARREL. It used to be a single 1100-line file
 * holding eight unrelated schema families; each now lives in `./objects/`, named
 * for what it describes:
 *
 * - `objects/primitives.ts`       — traits, stat blocks, data values, damage.
 * - `objects/content.ts`          — structured content blocks.
 * - `objects/tables.ts`           — d20 roll tables (the 9-variant union).
 * - `objects/sources.ts`          — reprint provenance.
 * - `objects/contributions.ts`    — the numeric half of ADR-029.
 * - `objects/effects.ts`          — the trait/damage/range half of ADR-029.
 * - `objects/systemModule.ts`     — the installable System/Module shape.
 * - `objects/choices.ts`          — choices, their options and their sources.
 * - `objects/npc.ts`              — NPCs embedded in another record.
 * - `objects/patterns.ts`         — mech patterns and their contents.
 * - `objects/actions.ts`          — the action record.
 * - `objects/entityBase.ts`       — the shared entity head.
 * - `objects/references.ts`       — grants, formation members, schema refs.
 * - `objects/crawlerMutations.ts` — crawler-type rule modifiers.
 * - `objects/guides.ts`           — guide steps and guide categories.
 *
 * The export list below is EXPLICIT, not `export *`, and is exactly the set this
 * file exported before the split: a few schemas that were module-private are now
 * exported from their own module so a sibling can import them
 * (`ChoiceOptionSchema` / `ChoiceConstraintsSchema`, needed by `guides.ts`), and
 * naming the re-exports keeps those from leaking into the package's surface.
 */

export {
  TraitSchema,
  StatsSchema,
  ChassisStatsSchema,
  CombatEntitySchema,
  MechanicalEntitySchema,
  DataValueSchema,
  DamageSchema,
} from './objects/primitives.js'

export { ContentBlockSchema, ContentSchema } from './objects/content.js'

export { TableContentSchema, TableSchema } from './objects/tables.js'

export { AdditionalSourceSchema } from './objects/sources.js'

export {
  ContributionStatSchema,
  ContributionTargetSchema,
  ContributionAmountSchema,
  ContributionSchema,
} from './objects/contributions.js'

export { EffectTargetSchema, ChoiceEffectSchema } from './objects/effects.js'

export { SystemModuleSchema } from './objects/systemModule.js'

export { ChoiceSchema, ChoicesSchema } from './objects/choices.js'

export { NpcSchema } from './objects/npc.js'

export {
  PatternSystemModuleSchema,
  PatternDroneConfigSchema,
  PatternSchema,
} from './objects/patterns.js'

export { ActionSchema } from './objects/actions.js'

export { BaseEntitySchema, AdvancedClassSchema } from './objects/entityBase.js'

export {
  FormationMechSchema,
  GrantSchema,
  SchemaNameWithActionsSchema,
} from './objects/references.js'

export { CrawlerMutationSchema } from './objects/crawlerMutations.js'

export { GuideStepSchema, GuideTypeSchema } from './objects/guides.js'

/**
 * Player-facing choices: the option shapes, the cardinality/constraint
 * vocabulary, the discriminated "where do the options come from" source axis,
 * and the choice record itself.
 *
 * `ChoiceOptionSchema` and `ChoiceConstraintsSchema` are exported because
 * `guides.ts` reuses them for guide steps. They are NOT re-exported from the
 * `objects` barrel — they were module-private before this split and stay
 * package-internal.
 */

import { z } from '../../zod.js'
import { IdSchema, NameSchema, NonNegativeIntegerSchema } from '../common.js'
import { DamageTypeSchema, SchemaNameSchema } from '../enums.js'
import { ContentSchema } from './content.js'
import { ChoiceEffectSchema } from './effects.js'
import { SystemModuleSchema } from './systemModule.js'

/**
 * Choice options schema
 */
export const ChoiceOptionSchema = z
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
export const ChoiceConstraintsSchema = z
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
 * Choice cardinality — how many picks a choice grants.
 * `max` is either a fixed number or `{ scalesWith }`, a field name resolved on
 * the parent entity (e.g. `techLevel`).
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
 * - `text`          — a free-text field.
 * - `table`         — roll on a named table, or choose your own.
 * - `options`       — an inline structured option list.
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
 * Choice schema (z.lazy() defers building the shape; the type is inferred, never
 * hand-annotated — see ContentBlockSchema for why).
 */
export const ChoiceSchema = z
  .lazy(() =>
    z
      .object({
        id: IdSchema.describe('Unique identifier for this choice'),
        name: NameSchema.describe('Display name for this choice'),
        content: ContentSchema.describe('Descriptive content for this choice').optional(),
        source: ChoiceSourceSchema.describe(
          'Discriminated option source (text/table/options/catalog/systemVariant)'
        ).optional(),
        cardinality: CardinalitySchema.describe('How many picks this choice grants').optional(),
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
export const ChoicesSchema = z.array(ChoiceSchema).describe('Array of choices offered by an entity')

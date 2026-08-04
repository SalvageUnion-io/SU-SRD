/**
 * Guides — the read-only, step-by-step transcriptions of the book's creation
 * and downtime procedures (ADR-021: a guide is never a wizard).
 */

import { z } from '../../zod.js'
import { IdSchema, NameSchema, NonNegativeIntegerSchema } from '../common.js'
import { ChoiceConstraintsSchema, ChoiceOptionSchema } from './choices.js'
import { ContentSchema } from './content.js'
import { SchemaNameWithActionsSchema } from './references.js'

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
export const GuideStepSchema = z
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

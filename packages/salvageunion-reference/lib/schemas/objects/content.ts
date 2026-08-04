/**
 * Structured content blocks — the renderable prose/list/datavalue payload that
 * hangs off almost every entity.
 */

import { z } from '../../zod.js'
import { ContentTypeSchema } from '../enums.js'
import { DataValueSchema } from './primitives.js'

/**
 * Block of structured content for rendering (paragraph, heading, list item, etc.)
 *
 * Wrapped in `z.lazy()` so the shape is only built on first use. The type is
 * deliberately INFERRED — a hand-written `z.ZodType<…>` annotation here silently
 * erases any key it forgets from `z.infer`, so the field parses and lands in the
 * generated JSON Schema while being invisible to every TypeScript consumer.
 */
export const ContentBlockSchema = z
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

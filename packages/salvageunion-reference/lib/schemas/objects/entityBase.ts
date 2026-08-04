/**
 * The shared entity head — id, name, source, page, artwork flag, content — and
 * the one entity variant declared here rather than in `entities.ts` because it
 * is embedded inside a class record.
 */

import { z } from '../../zod.js'
import { IdSchema, NameSchema, PositiveIntegerSchema } from '../common.js'
import { SourceSchema, TreeSchema } from '../enums.js'
import { ContentSchema } from './content.js'
import { AdditionalSourceSchema } from './sources.js'

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

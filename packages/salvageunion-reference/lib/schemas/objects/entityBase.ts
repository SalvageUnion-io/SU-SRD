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
    // `.optional()`, not `.default(false)`, so it matches every other stored
    // data tag (`hidden`, `legalStarting`, and ~15 more): an ABSENT tag means
    // untagged, and only the 5 records that ARE black-market carry the field.
    // The default was the odd one out — it materialised `blackMarket: false`
    // onto every parsed entity and typed the field as required, so the tag read
    // differently from its siblings depending on which one you were holding.
    // Safe to relax: the sole reader, `getBlackMarket`, already returns
    // `boolean | undefined`, and its sole consumer already tests `=== true`.
    blackMarket: z
      .boolean()
      .describe('Whether this entity is only available on the black market')
      .optional(),
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
  // REQUIRED, not optional. While it was optional, "is this a hybrid?" was
  // `hybrid === true` — a question answered by a field's ABSENCE, which is how
  // a type guard came to test `!('hybridTree' in entity)` for a field that
  // exists in no schema and no data file, and so returned true for every hybrid
  // it was meant to exclude. Every class record now carries the flag.
  hybrid: z
    .boolean()
    .describe('Whether this is a hybrid class (cannot be selected as initial class)'),
  // A Hybrid has already advanced, and "cannot advance into any other Hybrid
  // Class or Advanced Tree" (p. 321) — so this is always false here. Stated
  // rather than implied, so nothing has to know that absence means no.
  advanceable: z.boolean().describe('Whether this class can advance into another class'),
  maxAbilities: z
    .number()
    .int()
    .positive()
    .describe('Maximum number of abilities this class can have'),
  advancedTree: TreeSchema.describe('Advanced ability tree for this class'),
  legendaryTree: TreeSchema.describe('Legendary ability tree for this class'),
})
  .strict()
  .describe('Advanced or hybrid character class')

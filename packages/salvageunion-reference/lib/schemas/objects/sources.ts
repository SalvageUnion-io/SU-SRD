/**
 * Reprint provenance: where else a record appears besides its primary source.
 */

import { z } from '../../zod.js'
import { PositiveIntegerSchema } from '../common.js'
import { SourceSchema } from '../enums.js'

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

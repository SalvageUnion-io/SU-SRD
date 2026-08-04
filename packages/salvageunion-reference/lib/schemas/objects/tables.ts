/**
 * d20 roll tables — one entry shape, and the nine-variant discriminated union
 * of bucket layouts the books actually print.
 */

import { z } from '../../zod.js'

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
 *
 * Also spread into the `flat` table variant below, which is the same 1–20
 * mapping plus a discriminant — it used to re-list all twenty keys by hand.
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
    // Flat roll table with individual outcomes: the discriminant plus the same
    // 1–20 mapping as a column.
    z
      .object({
        type: z.literal('flat'),
        ...ColumnEntriesSchema.shape,
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

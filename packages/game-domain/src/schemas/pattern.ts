/**
 * ADR (inline) — MechPattern as a separate entity type
 *
 * Decision: patterns live in a dedicated `mechPatterns` store and table.
 *
 * Rejected:
 *   - Storing patterns as a flag/boolean on Mech records: would require a
 *     WHERE-like filter on every mech list query. Couples two
 *     logically separate concerns: "live mech" vs "reusable template".
 *
 * Accepted:
 *   - Separate store: mech queries stay clean (no filter overhead). Patterns
 *     can evolve their own schema independently (e.g., adding tags,
 *     description, version history in a later wave). Follows the same
 *     STORE_NAMES + makeStore pattern already established in Wave 1.
 *
 * schemaVersion: literal(1) follows the same convention as MechSchema,
 * PilotSchema, etc. — enables future incremental migrations.
 *
 * Item arrays (systems, modules): mirror the fields in MechSchema verbatim.
 * A mech built from a pattern starts fresh: cargo, Damage and Heat stay on
 * the mech a pattern was saved from.
 */

import { z } from 'salvageunion-reference/zod'
import { photoFields } from './photo'
import { withoutRetired } from './retired'

export const MechPatternSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    /** Human-readable name for this pattern template. */
    name: z.string().min(1),
    /** Slug reference to a Chassis in salvageunion-reference. */
    chassisRef: z.string(),
    /** Slugs of mech system items — mirrors MechSchema.systems. */
    systems: z.array(z.string()),
    /** Slugs of mech module items — mirrors MechSchema.modules. */
    modules: z.array(z.string()),
    /**
     * The maker's notes for whoever builds it. Shown on the
     * pattern page in a dashed box: the maker's words, not the book's.
     */
    notes: z.string().optional(),
    /** The pattern's own picture, in place of its chassis art; see `PhotoSchema`. */
    ...photoFields,
    createdAt: z.string().datetime(),
  })
  .strict()

export type MechPattern = z.infer<typeof MechPatternSchema>

/** Parse a stored pattern, after dropping the fields patterns no longer store (`RETIRED_FIELDS`). */
export function parseMechPattern(body: unknown) {
  return MechPatternSchema.safeParse(withoutRetired('pattern', body))
}

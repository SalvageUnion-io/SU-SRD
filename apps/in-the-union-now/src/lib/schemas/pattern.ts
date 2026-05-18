/**
 * ADR (inline) — MechPattern as a separate entity type
 *
 * Decision: patterns live in a dedicated `mechPatterns` IndexedDB object store.
 *
 * Rejected:
 *   - Storing patterns as a flag/boolean on Mech records: would require a
 *     WHERE-like filter on every mech list query (IDB has no native index on
 *     boolean columns without an explicit index creation step). Couples two
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
 * Item arrays (systems, modules, cargo): mirror the slug-string arrays in
 * MechSchema verbatim. The intent is that a MechPattern can be instantiated
 * into a Mech without any data transformation beyond assigning a new id and
 * fresh timestamps.
 */

import { z } from 'zod'

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
    /** Slugs or custom names of cargo items — mirrors MechSchema.cargo. */
    cargo: z.array(z.string()),
    createdAt: z.string().datetime(),
  })
  .strict()

export type MechPattern = z.infer<typeof MechPatternSchema>

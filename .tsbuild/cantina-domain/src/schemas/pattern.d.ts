/**
 * ADR (inline) — MechPattern as a separate entity type
 *
 * Decision: patterns live in a dedicated `mechPatterns` store and Convex table.
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
 * Item arrays (systems, modules, cargoLots): mirror the fields in MechSchema
 * verbatim. The intent is that a MechPattern can be instantiated into a Mech
 * without any data transformation beyond assigning a new id, fresh cargo-lot
 * ids, fresh timestamps, and seeding live stats (currentHeat 0, full SP/EP).
 */
import { z } from 'salvageunion-reference/zod';
export declare const MechPatternSchema: z.ZodObject<{
    photo: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"upload">;
        storageId: z.ZodString;
        url: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"asset">;
        path: z.ZodString;
    }, z.core.$strict>], "kind">>;
    id: z.ZodString;
    schemaVersion: z.ZodLiteral<1>;
    name: z.ZodString;
    chassisRef: z.ZodString;
    systems: z.ZodArray<z.ZodString>;
    modules: z.ZodArray<z.ZodString>;
    cargoLots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            bulk: "bulk";
            unit: "unit";
        }>;
        name: z.ZodString;
        cat: z.ZodEnum<{
            POWER: "POWER";
            SCRAP: "SCRAP";
            SEALED: "SEALED";
            SYSTEM: "SYSTEM";
        }>;
        tl: z.ZodOptional<z.ZodNumber>;
        qty: z.ZodOptional<z.ZodNumber>;
        units: z.ZodNumber;
        code: z.ZodString;
    }, z.core.$strict>>;
    notes: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strict>;
export type MechPattern = z.infer<typeof MechPatternSchema>;

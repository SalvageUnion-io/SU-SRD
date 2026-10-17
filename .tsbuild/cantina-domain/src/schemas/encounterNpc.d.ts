import { z } from 'salvageunion-reference/zod';
/**
 * EncounterNpc — one tracked NPC instance on the GM encounter tray.
 * Persisted like every entity: the `encounterNpcs` Convex
 * table when signed in, nowhere when not;
 * container-scoped via the nullable `gameId` (ADR-030 §2).
 *
 * The record stores a SLUG reference into salvageunion-reference (data
 * conventions: slugs, never UUIDs) plus the frozen add-time stats it needs to
 * run live (maxHp/statKind), so the tray keeps working even if the reference
 * lookup drifts. Multiple instances of the same reference NPC are expected —
 * each instance is its own record with its own name/HP/conditions.
 */
/** The reference schemas an encounter-tray NPC can be drawn from. */
export declare const ENCOUNTER_REF_SCHEMAS: readonly ['npcs', 'chassis', 'squads', 'creatures', 'bio-titans', 'vehicles', 'meld'];
/**
 * Recorded result of a Mediator table roll (Reaction / Morale / Retreat).
 * Snapshot-safe plain data — same shape discipline as the mech's
 * HeatCheckResult. `label`/`value` are copied verbatim from the reference
 * roll-table entry at roll time.
 */
export declare const MediatorRollResultSchema: z.ZodObject<{
    table: z.ZodEnum<{
        morale: "morale";
        reaction: "reaction";
        retreat: "retreat";
    }>;
    roll: z.ZodNumber;
    label: z.ZodOptional<z.ZodString>;
    value: z.ZodString;
    rolledAt: z.ZodString;
}, z.core.$strict>;
export declare const EncounterNpcSchema: z.ZodObject<{
    gameId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    id: z.ZodString;
    schemaVersion: z.ZodLiteral<1>;
    refSchema: z.ZodEnum<{
        "bio-titans": "bio-titans";
        chassis: "chassis";
        creatures: "creatures";
        meld: "meld";
        npcs: "npcs";
        squads: "squads";
        vehicles: "vehicles";
    }>;
    refSlug: z.ZodString;
    refName: z.ZodString;
    refPattern: z.ZodOptional<z.ZodString>;
    userPattern: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        systems: z.ZodArray<z.ZodString>;
        modules: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    name: z.ZodString;
    currentHp: z.ZodNumber;
    maxHp: z.ZodNumber;
    statKind: z.ZodEnum<{
        hp: "hp";
        sp: "sp";
    }>;
    conditions: z.ZodArray<z.ZodString>;
    lastMediatorRoll: z.ZodOptional<z.ZodObject<{
        table: z.ZodEnum<{
            morale: "morale";
            reaction: "reaction";
            retreat: "retreat";
        }>;
        roll: z.ZodNumber;
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
        rolledAt: z.ZodString;
    }, z.core.$strict>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strict>;
export type EncounterNpc = z.infer<typeof EncounterNpcSchema>;

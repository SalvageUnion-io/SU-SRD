/**
 * Partner — a statted Drone / Companion owned by a pilot or a mech.
 *
 * A Partner is any granted entity carrying a MECH-SHAPED stat block: energy and
 * heat alongside `systemSlots`/`moduleSlots`. The Core Book states the same
 * formula four separate times (Auto-Turret p. 29, Survey Drone p. 48, Mecha
 * Companion p. 68, Sestra Drone p. 128):
 *
 *   "…uses the same rules as Mechs for attaching Systems and Modules; taking
 *    damage and being repaired; as well as Heat and Heat Checks. Your [partner]
 *    cannot Push."
 *
 * so a partner is modelled as a mech minus Push, minus a chassis/pattern.
 *
 * TWO grant paths, which is why this schema is not simply a field on the pilot:
 *
 *   - PILOT-granted, from a pilot ability's `grants` → an `equipment` record
 *     with slots (Auto-Turret, Survey Drone, Mecha Companion).
 *   - MECH-granted, from a chassis ability's `drone` field → a `drones` record
 *     (Sestra Drone via Little Sestra, Big Brother Drone via Big Brother).
 *
 * `hostSchema` is what lets one shape serve both — and it is load-bearing
 * beyond taste: "Survey Drone" exists in BOTH `equipment.json` (the player's
 * partner, SP 2 / EP 4 / 3 sys) and `drones.json` (an opposition stat block,
 * SP 1 and nothing else). Resolving `hostRef` without it picks the wrong record.
 *
 * OWNERSHIP IS INTRINSIC. A partner lives in an array on its host rather than in
 * its own store, so deleting a pilot or mech removes its partners with no orphan
 * cleanup, and it rides through snapshots and export bundles with that host. A
 * partner has no independent existence — it is granted by an ability and cannot
 * outlive the thing that grants it. This is also why partners get no index
 * route: they are not roster citizens.
 *
 * Superseded [ADR-023](../../../../docs/ARCHITECTURE.md#decisions),
 * whose `Pilot.equipmentLoadouts` was keyed by equipment SLUG. That collapsed
 * multiples of one partner into a single shared entry — a live bug, because
 * Mecha Packmaster grants TWO Mecha Companions and Big Brother's DronTek pattern
 * fields FOUR drones. Every partner here carries its own `id`.
 */
import { z } from 'salvageunion-reference/zod';
export declare const PartnerInstanceSchema: z.ZodObject<{
    id: z.ZodString;
    hostRef: z.ZodString;
    hostSchema: z.ZodEnum<{
        drones: "drones";
        equipment: "equipment";
    }>;
    name: z.ZodOptional<z.ZodString>;
    appearance: z.ZodOptional<z.ZodString>;
    aiPersonality: z.ZodOptional<z.ZodString>;
    techLevelOverride: z.ZodOptional<z.ZodNumber>;
    currentSP: z.ZodOptional<z.ZodNumber>;
    currentEP: z.ZodOptional<z.ZodNumber>;
    currentHeat: z.ZodOptional<z.ZodNumber>;
    systems: z.ZodDefault<z.ZodArray<z.ZodString>>;
    modules: z.ZodDefault<z.ZodArray<z.ZodString>>;
    systemConditions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<{
        damaged: "damaged";
        destroyed: "destroyed";
        intact: "intact";
    }>>>;
    moduleConditions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<{
        damaged: "damaged";
        destroyed: "destroyed";
        intact: "intact";
    }>>>;
    itemUses: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    conditions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    cargoLots: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>>;
}, z.core.$strict>;
export type PartnerInstance = z.infer<typeof PartnerInstanceSchema>;

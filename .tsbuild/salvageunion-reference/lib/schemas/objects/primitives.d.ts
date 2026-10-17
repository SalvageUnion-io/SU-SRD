/**
 * Object-schema primitives: the small, widely-reused shapes other object
 * schemas compose out of — a trait, a stat block, a labelled data value, a
 * damage figure.
 *
 * Nothing here references another object family, which is what makes it the
 * bottom of the objects dependency graph.
 */
import { z } from '../../zod';
/**
 * Special traits and properties of items, systems, or abilities
 */
export declare const TraitSchema: z.ZodObject<{
    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    type: z.ZodString;
}, z.core.$strict>;
/**
 * Structure Points on a stat block — the ONE declaration, composed everywhere.
 *
 * One declaration, so whether a stat block may carry 0 never depends on which
 * schema happens to validate it. It may: a destroyed or fully-salvaged chassis
 * at 0 SP is a real game state, and the derived-stat code clamps to 0 rather
 * than treating it as impossible.
 *
 * NOT for the SP *modifier* on an action: that is signed (`-2 SP` is a normal
 * effect) and is declared separately in `objects/actions.ts`.
 */
export declare const StructurePointsSchema: z.ZodNumber;
/**
 * Statistics for mechs, chassis, and vehicles
 */
export declare const StatsSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Statistics specific to chassis — all stats required
 */
export declare const ChassisStatsSchema: z.ZodObject<{
    structurePoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    energyPoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    heatCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    systemSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    moduleSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    cargoCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    techLevel: z.ZodNonOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>>;
    salvageValue: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
/**
 * A head of a multi-headed chassis — its own full stat block, crafted and
 * repaired separately and mounting its own Systems and Modules (the Cerberus,
 * Rainmaker p.72–74). A pattern places an item on a head with
 * `PatternSystemModuleSchema.head`; an item with no head sits on the chassis.
 */
export declare const ChassisHeadSchema: z.ZodObject<{
    structurePoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    energyPoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    heatCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    systemSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    moduleSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    cargoCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    techLevel: z.ZodNonOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>>;
    salvageValue: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    name: z.ZodString;
}, z.core.$strict>;
/**
 * Entity that can perform actions and has traits
 */
export declare const CombatEntitySchema: z.ZodObject<{
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strip>;
/**
 * Mechanical entity with structure points and equipment stats
 */
export declare const MechanicalEntitySchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    systems: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * A data value with label, optional value, and optional type
 */
export declare const DataValueSchema: z.ZodObject<{
    label: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    type: z.ZodOptional<z.ZodEnum<{
        cost: "cost";
        keyword: "keyword";
        trait: "trait";
    }>>;
    unit: z.ZodOptional<z.ZodString>;
    perTechLevel: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Damage schema
 */
export declare const DamageSchema: z.ZodObject<{
    damageType: z.ZodEnum<{
        HP: "HP";
        SP: "SP";
    }>;
    amount: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
}, z.core.$strict>;

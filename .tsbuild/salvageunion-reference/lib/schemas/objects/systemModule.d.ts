/**
 * Systems and Modules — the one installable-item shape. Systems and Modules
 * share this schema; only the stamped `schemaName` tells them apart.
 */
import { z } from '../../zod';
/**
 * A system or module that can be installed on a mech
 */
export declare const SystemModuleSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
    slotsRequired: z.ZodNumber;
    salvageValue: z.ZodNumber;
    recommended: z.ZodOptional<z.ZodBoolean>;
    count: z.ZodOptional<z.ZodNumber>;
    contributions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        stat: z.ZodEnum<{
            cargoCapacity: "cargoCapacity";
            energyPoints: "energyPoints";
            heatCapacity: "heatCapacity";
            inventorySlots: "inventorySlots";
            maxAp: "maxAp";
            maxHp: "maxHp";
            moduleSlots: "moduleSlots";
            structurePoints: "structurePoints";
            systemSlots: "systemSlots";
        }>;
        amount: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
            flat: z.ZodOptional<z.ZodNumber>;
            perTechLevel: z.ZodNumber;
        }, z.core.$strict>, z.ZodObject<{
            fromStat: z.ZodEnum<{
                cargoCapacity: "cargoCapacity";
                energyPoints: "energyPoints";
                heatCapacity: "heatCapacity";
                inventorySlots: "inventorySlots";
                maxAp: "maxAp";
                maxHp: "maxHp";
                moduleSlots: "moduleSlots";
                structurePoints: "structurePoints";
                systemSlots: "systemSlots";
            }>;
        }, z.core.$strict>]>;
        target: z.ZodOptional<z.ZodEnum<{
            crawler: "crawler";
            pilot: "pilot";
            pilotedMech: "pilotedMech";
            self: "self";
        }>>;
        stacks: z.ZodOptional<z.ZodBoolean>;
        voidWhen: z.ZodOptional<z.ZodEnum<{
            damaged: "damaged";
            destroyed: "destroyed";
        }>>;
        duration: z.ZodOptional<z.ZodEnum<{
            activated: "activated";
            permanent: "permanent";
        }>>;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    appliedEffects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        op: z.ZodLiteral<"addTrait">;
        value: z.ZodString;
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        target: z.ZodOptional<z.ZodEnum<{
            hostMech: "hostMech";
            self: "self";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"removeTrait">;
        value: z.ZodString;
        target: z.ZodOptional<z.ZodEnum<{
            hostMech: "hostMech";
            self: "self";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"setRange">;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"addDamage">;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        unit: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>], "op">>>;
    actions: z.ZodArray<z.ZodString>;
}, z.core.$strip>;

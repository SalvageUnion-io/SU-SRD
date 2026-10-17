import { z } from 'salvageunion-reference/zod';
/**
 * chassisRef / systems / modules store SLUG references into
 * salvageunion-reference (e.g. "ghost-chassis"), the same convention as
 * encounter `refSlug`. They resolve through `salvageunion-reference/rules`
 * (`resolveChassisRef`, `resolveSystemRef`, `resolveModuleRef`) at the
 * rules/presentation layer.
 *
 * Optional fields read as their documented default when absent, so records
 * written before a field existed still parse.
 */
export declare const MechSchema: z.ZodObject<{
    gameId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
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
    patternName: z.ZodOptional<z.ZodString>;
    quirk: z.ZodOptional<z.ZodString>;
    appearance: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    conditions: z.ZodArray<z.ZodString>;
    maxSpModifier: z.ZodOptional<z.ZodNumber>;
    maxEpModifier: z.ZodOptional<z.ZodNumber>;
    maxHeatModifier: z.ZodOptional<z.ZodNumber>;
    maxCargoModifier: z.ZodOptional<z.ZodNumber>;
    maxSpOverride: z.ZodOptional<z.ZodNumber>;
    maxEpOverride: z.ZodOptional<z.ZodNumber>;
    maxHeatOverride: z.ZodOptional<z.ZodNumber>;
    maxCargoOverride: z.ZodOptional<z.ZodNumber>;
    seedRef: z.ZodOptional<z.ZodString>;
    sourcePattern: z.ZodOptional<z.ZodString>;
    currentHP: z.ZodOptional<z.ZodNumber>;
    currentAP: z.ZodOptional<z.ZodNumber>;
    currentTP: z.ZodOptional<z.ZodNumber>;
    currentSP: z.ZodOptional<z.ZodNumber>;
    currentEP: z.ZodOptional<z.ZodNumber>;
    currentHeat: z.ZodOptional<z.ZodNumber>;
    partners: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>>;
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
    shutdown: z.ZodOptional<z.ZodBoolean>;
    vulnerable: z.ZodOptional<z.ZodBoolean>;
    destroyed: z.ZodOptional<z.ZodBoolean>;
    lastHeatCheck: z.ZodOptional<z.ZodObject<{
        heatCheckRoll: z.ZodNumber;
        heatAtCheck: z.ZodNumber;
        overloaded: z.ZodBoolean;
        overloadRoll: z.ZodOptional<z.ZodNumber>;
        outcome: z.ZodOptional<z.ZodPreprocess<z.ZodEnum<{
            meltdown: "meltdown";
            "module-destroyed": "module-destroyed";
            overdrive: "overdrive";
            overheat: "overheat";
            "system-destroyed": "system-destroyed";
        }>>>;
        rolledAt: z.ZodString;
    }, z.core.$strict>>;
    lastCriticalDamage: z.ZodOptional<z.ZodObject<{
        roll: z.ZodNumber;
        outcome: z.ZodEnum<{
            catastrophic: "catastrophic";
            "core-damage": "core-damage";
            "miraculous-survival": "miraculous-survival";
            "module-destruction": "module-destruction";
            "system-destruction": "system-destruction";
        }>;
        rolledAt: z.ZodString;
    }, z.core.$strict>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strict>;
export type Mech = z.infer<typeof MechSchema>;

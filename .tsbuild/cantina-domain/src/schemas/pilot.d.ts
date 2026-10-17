import { z } from 'salvageunion-reference/zod';
/**
 * Persisted choice selections for an entity that carries `choices`
 * (e.g. granted equipment with permanent/multi-select picks).
 *
 * Mirrors the UI library's `ChoiceSelections` type exactly:
 *   Record<choiceId, selectedOptionValues[]>
 * so it can be passed straight into ReferenceEntityCard's controlled
 * `selections` prop. Free-text choices store their value as a single-element array.
 */
export declare const ChoiceSelectionsSchema: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
/**
 * A free-form inventory entry with an explicit slot cost. Used for
 * anything the pilot carries that is not a reference equipment slug — most
 * importantly Scrap (3 slots each). Slot math at the display
 * layer sums `slotCost` truthfully alongside reference equipment.
 */
declare const GenericInventoryEntrySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    slotCost: z.ZodNumber;
    qty: z.ZodOptional<z.ZodNumber>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type GenericInventoryEntry = z.infer<typeof GenericInventoryEntrySchema>;
/**
 * classRef: slug reference to a class in salvageunion-reference.
 * Resolution against game data is handled at the presentation/query layer.
 *
 * Optional fields read as their documented default when absent, so records
 * written before a field existed still parse.
 */
export declare const PilotSchema: z.ZodObject<{
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
    callsign: z.ZodString;
    pronouns: z.ZodOptional<z.ZodString>;
    classRef: z.ZodString;
    originClassRef: z.ZodOptional<z.ZodString>;
    abilities: z.ZodArray<z.ZodString>;
    equipment: z.ZodArray<z.ZodString>;
    motto: z.ZodString;
    keepsake: z.ZodString;
    appearance: z.ZodString;
    background: z.ZodDefault<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    conditions: z.ZodArray<z.ZodString>;
    seedRef: z.ZodOptional<z.ZodString>;
    currentHP: z.ZodOptional<z.ZodNumber>;
    currentAP: z.ZodOptional<z.ZodNumber>;
    equipmentConditions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<{
        damaged: "damaged";
        destroyed: "destroyed";
        intact: "intact";
    }>>>;
    equipmentChoices: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>>;
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
    crawlerLevel: z.ZodOptional<z.ZodNumber>;
    usedAbilities: z.ZodOptional<z.ZodArray<z.ZodString>>;
    trainingPoints: z.ZodOptional<z.ZodNumber>;
    injuries: z.ZodOptional<z.ZodArray<z.ZodObject<{
        severity: z.ZodEnum<{
            major: "major";
            minor: "minor";
        }>;
        note: z.ZodString;
    }, z.core.$strict>>>;
    maxHpModifier: z.ZodOptional<z.ZodNumber>;
    maxApModifier: z.ZodOptional<z.ZodNumber>;
    maxInventorySlotsModifier: z.ZodOptional<z.ZodNumber>;
    maxHpOverride: z.ZodOptional<z.ZodNumber>;
    maxApOverride: z.ZodOptional<z.ZodNumber>;
    maxInventorySlotsOverride: z.ZodOptional<z.ZodNumber>;
    equipmentUses: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    usedToggles: z.ZodOptional<z.ZodObject<{
        background: z.ZodOptional<z.ZodBoolean>;
        keepsake: z.ZodOptional<z.ZodBoolean>;
        motto: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    genericInventory: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        slotCost: z.ZodNumber;
        qty: z.ZodOptional<z.ZodNumber>;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    lastCriticalInjury: z.ZodOptional<z.ZodObject<{
        roll: z.ZodNumber;
        outcome: z.ZodEnum<{
            fatal: "fatal";
            "major-injury": "major-injury";
            "minor-injury": "minor-injury";
            "miraculous-survival": "miraculous-survival";
            unconscious: "unconscious";
        }>;
        rolledAt: z.ZodString;
    }, z.core.$strict>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strict>;
export type Pilot = z.infer<typeof PilotSchema>;
export {};

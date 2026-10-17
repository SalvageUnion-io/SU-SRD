/**
 * Player-facing choices: the option shapes, the cardinality/constraint
 * vocabulary, the discriminated "where do the options come from" source axis,
 * and the choice record itself.
 *
 * `ChoiceOptionSchema` and `ChoiceConstraintsSchema` are exported because
 * `guides.ts` reuses them for guide steps. They are NOT re-exported from the
 * `objects` barrel — they were module-private before this split and stay
 * package-internal.
 */
import { z } from '../../zod';
/**
 * Choice options schema
 */
export declare const ChoiceOptionSchema: z.ZodObject<{
    label: z.ZodString;
    value: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strict>;
/**
 * Choice constraints schema
 */
export declare const ChoiceConstraintsSchema: z.ZodObject<{
    field: z.ZodOptional<z.ZodString>;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
    scalesWithField: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
/**
 * Choice schema (z.lazy() defers building the shape; the type is inferred, never
 * hand-annotated — see ContentBlockSchema for why).
 */
export declare const ChoiceSchema: z.ZodLazy<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    content: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            choice: "choice";
            datavalues: "datavalues";
            flavor: "flavor";
            heading: "heading";
            hint: "hint";
            label: "label";
            "list-item": "list-item";
            paragraph: "paragraph";
        }>>>;
        value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodObject<{
            label: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            type: z.ZodOptional<z.ZodEnum<{
                cost: "cost";
                keyword: "keyword";
                trait: "trait";
            }>>;
            unit: z.ZodOptional<z.ZodString>;
            perTechLevel: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>]>>;
        label: z.ZodOptional<z.ZodString>;
        level: z.ZodOptional<z.ZodNumber>;
        lead: z.ZodOptional<z.ZodBoolean>;
        choiceId: z.ZodOptional<z.ZodString>;
        items: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                choice: "choice";
                datavalues: "datavalues";
                flavor: "flavor";
                heading: "heading";
                hint: "hint";
                label: "label";
                "list-item": "list-item";
                paragraph: "paragraph";
            }>>>;
            value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodObject<{
                label: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                type: z.ZodOptional<z.ZodEnum<{
                    cost: "cost";
                    keyword: "keyword";
                    trait: "trait";
                }>>;
                unit: z.ZodOptional<z.ZodString>;
                perTechLevel: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>]>>;
            label: z.ZodOptional<z.ZodString>;
            level: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>>>;
    source: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"text">;
        multiline: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"table">;
        rollTable: z.ZodString;
        orChooseOwn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"options">;
        options: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        }, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"catalog">;
        schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            abilities: "abilities";
            "ability-tree-requirements": "ability-tree-requirements";
            "bio-titans": "bio-titans";
            chassis: "chassis";
            classes: "classes";
            "crawler-bays": "crawler-bays";
            "crawler-tech-levels": "crawler-tech-levels";
            crawlers: "crawlers";
            creatures: "creatures";
            distances: "distances";
            drones: "drones";
            equipment: "equipment";
            factions: "factions";
            guides: "guides";
            keywords: "keywords";
            meld: "meld";
            modules: "modules";
            npcs: "npcs";
            "roll-tables": "roll-tables";
            sources: "sources";
            squads: "squads";
            systems: "systems";
            "tech-levels": "tech-levels";
            traits: "traits";
            vehicles: "vehicles";
        }>>>;
        entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
        filter: z.ZodOptional<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            damageType: z.ZodOptional<z.ZodEnum<{
                HP: "HP";
                SP: "SP";
            }>>;
        }, z.core.$strict>>;
        reveals: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"systemVariant">;
        options: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>;
    }, z.core.$strict>], "kind">>;
    cardinality: z.ZodOptional<z.ZodObject<{
        min: z.ZodNumber;
        max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
            scalesWith: z.ZodString;
        }, z.core.$strict>]>;
    }, z.core.$strict>>;
    lifetime: z.ZodOptional<z.ZodEnum<{
        permanent: "permanent";
        session: "session";
    }>>;
}, z.core.$strict>>;
/**
 * Array of choices
 */
export declare const ChoicesSchema: z.ZodArray<z.ZodLazy<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    content: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            choice: "choice";
            datavalues: "datavalues";
            flavor: "flavor";
            heading: "heading";
            hint: "hint";
            label: "label";
            "list-item": "list-item";
            paragraph: "paragraph";
        }>>>;
        value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodObject<{
            label: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            type: z.ZodOptional<z.ZodEnum<{
                cost: "cost";
                keyword: "keyword";
                trait: "trait";
            }>>;
            unit: z.ZodOptional<z.ZodString>;
            perTechLevel: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>]>>;
        label: z.ZodOptional<z.ZodString>;
        level: z.ZodOptional<z.ZodNumber>;
        lead: z.ZodOptional<z.ZodBoolean>;
        choiceId: z.ZodOptional<z.ZodString>;
        items: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                choice: "choice";
                datavalues: "datavalues";
                flavor: "flavor";
                heading: "heading";
                hint: "hint";
                label: "label";
                "list-item": "list-item";
                paragraph: "paragraph";
            }>>>;
            value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodObject<{
                label: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                type: z.ZodOptional<z.ZodEnum<{
                    cost: "cost";
                    keyword: "keyword";
                    trait: "trait";
                }>>;
                unit: z.ZodOptional<z.ZodString>;
                perTechLevel: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>]>>;
            label: z.ZodOptional<z.ZodString>;
            level: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>>>;
    source: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"text">;
        multiline: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"table">;
        rollTable: z.ZodString;
        orChooseOwn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"options">;
        options: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        }, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"catalog">;
        schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            abilities: "abilities";
            "ability-tree-requirements": "ability-tree-requirements";
            "bio-titans": "bio-titans";
            chassis: "chassis";
            classes: "classes";
            "crawler-bays": "crawler-bays";
            "crawler-tech-levels": "crawler-tech-levels";
            crawlers: "crawlers";
            creatures: "creatures";
            distances: "distances";
            drones: "drones";
            equipment: "equipment";
            factions: "factions";
            guides: "guides";
            keywords: "keywords";
            meld: "meld";
            modules: "modules";
            npcs: "npcs";
            "roll-tables": "roll-tables";
            sources: "sources";
            squads: "squads";
            systems: "systems";
            "tech-levels": "tech-levels";
            traits: "traits";
            vehicles: "vehicles";
        }>>>;
        entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
        filter: z.ZodOptional<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            damageType: z.ZodOptional<z.ZodEnum<{
                HP: "HP";
                SP: "SP";
            }>>;
        }, z.core.$strict>>;
        reveals: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"systemVariant">;
        options: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>;
    }, z.core.$strict>], "kind">>;
    cardinality: z.ZodOptional<z.ZodObject<{
        min: z.ZodNumber;
        max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
            scalesWith: z.ZodString;
        }, z.core.$strict>]>;
    }, z.core.$strict>>;
    lifetime: z.ZodOptional<z.ZodEnum<{
        permanent: "permanent";
        session: "session";
    }>>;
}, z.core.$strict>>>;

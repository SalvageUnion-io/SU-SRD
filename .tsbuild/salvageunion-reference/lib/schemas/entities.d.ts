/**
 * Zod entity schemas - all 24 entity types
 */
import { z } from '../zod';
/**
 * Pilot abilities and skills
 */
export declare const AbilitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    description: z.ZodOptional<z.ZodString>;
    tree: z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>;
    level: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"L">, z.ZodLiteral<"G">]>;
    mechActionType: z.ZodOptional<z.ZodEnum<{
        DownTime: "DownTime";
        Free: "Free";
        Long: "Long";
        Passive: "Passive";
        Reaction: "Reaction";
        Short: "Short";
        Turn: "Turn";
    }>>;
    grants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        schema: z.ZodUnion<readonly [z.ZodEnum<{
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
        }>, z.ZodLiteral<"choice">]>;
        name: z.ZodString;
    }, z.core.$strict>>>;
    activationCurrency: z.ZodOptional<z.ZodEnum<{
        "EP or AP": "EP or AP";
        "SP or HP": "SP or HP";
        Variable: "Variable";
    }>>;
    actions: z.ZodArray<z.ZodString>;
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
}, z.core.$strict>;
/**
 * Requirements for ability trees
 */
export declare const AbilityTreeRequirementSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    requirement: z.ZodArray<z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>>;
}, z.core.$strict>;
/**
 * Actions, abilities, and attacks that can be performed
 */
export declare const MetaActionSchema: z.ZodLazy<z.ZodObject<{
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
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    displayName: z.ZodOptional<z.ZodString>;
    activationCost: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"X">]>>;
    range: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        Close: "Close";
        Far: "Far";
        Long: "Long";
        Medium: "Medium";
    }>>>;
    actionType: z.ZodOptional<z.ZodEnum<{
        DownTime: "DownTime";
        Free: "Free";
        Long: "Long";
        Passive: "Passive";
        Reaction: "Reaction";
        Short: "Short";
        Turn: "Turn";
    }>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    damage: z.ZodOptional<z.ZodObject<{
        damageType: z.ZodEnum<{
            HP: "HP";
            SP: "SP";
        }>;
        amount: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    }, z.core.$strict>>;
    choices: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
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
    }, z.core.$strict>>>>;
    table: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"standard">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"alternate">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19-20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        type: z.ZodLiteral<"flat">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"dramatic">;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"duos">;
        '1-2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3-4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5-6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7-8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13-14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15-16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17-18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19-20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"bio-chassis">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"columns">;
        '1-4': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '5-8': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '9-12': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '13-16': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '17-20': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"salvage-cache">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8-9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10-11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12-13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14-15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16-17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"octet">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5-7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14-16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">>;
    tableName: z.ZodOptional<z.ZodString>;
    hidden: z.ZodOptional<z.ZodBoolean>;
    activationCurrency: z.ZodOptional<z.ZodEnum<{
        "EP or AP": "EP or AP";
        "SP or HP": "SP or HP";
        Variable: "Variable";
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>>;
    page: z.ZodOptional<z.ZodNumber>;
    actionSource: z.ZodOptional<z.ZodEnum<{
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
    }>>;
    drone: z.ZodOptional<z.ZodString>;
}, z.core.$strict>>;
/**
 * Bio-Titans: mech-scale biological monsters.
 *
 * Instinctual, mech-scale creatures (e.g. Scylla, Typhon, Chrysalis) with a
 * structurePoints + actions statblock — actions often include a "Titanic
 * Actions" entry. Bio-salvage extracted from a Bio-Titan equals its starting
 * Structure Points (derived at the display layer). A Bio-Titan may carry
 * `patterns` — variants that add actions to its stats (`BioTitanPatternSchema`).
 */
export declare const BioTitanSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    structurePoints: z.ZodNumber;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    patterns: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        hidden: z.ZodOptional<z.ZodBoolean>;
        source: z.ZodOptional<z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>>;
        page: z.ZodOptional<z.ZodNumber>;
        additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
            source: z.ZodEnum<{
                "False Flag": "False Flag";
                "Mech Monday": "Mech Monday";
                Rainmaker: "Rainmaker";
                "Reclamation of the Wastes": "Reclamation of the Wastes";
                "Relics of a Time Gone By": "Relics of a Time Gone By";
                "Salvage Union Starter Set": "Salvage Union Starter Set";
                "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
                "Thatcher's Mech Base": "Thatcher's Mech Base";
                "The Hive": "The Hive";
                "We Were Here First!": "We Were Here First!";
            }>;
            booklet: z.ZodOptional<z.ZodString>;
            page: z.ZodNumber;
        }, z.core.$strict>>>;
        actions: z.ZodArray<z.ZodString>;
        formerSlugs: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/**
 * Mech chassis definitions
 */
export declare const ChassisSchema: z.ZodObject<{
    structurePoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    energyPoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    heatCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    systemSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    moduleSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    cargoCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    techLevel: z.ZodNonOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>>;
    salvageValue: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    chassisAbilities: z.ZodArray<z.ZodString>;
    heads: z.ZodOptional<z.ZodArray<z.ZodObject<{
        structurePoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
        energyPoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
        heatCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
        systemSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
        moduleSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
        cargoCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
        techLevel: z.ZodNonOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>>;
        salvageValue: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
        name: z.ZodString;
    }, z.core.$strict>>>;
    patterns: z.ZodArray<z.ZodLazy<z.ZodObject<{
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
        legalStarting: z.ZodOptional<z.ZodBoolean>;
        hidden: z.ZodOptional<z.ZodBoolean>;
        homebrew: z.ZodOptional<z.ZodBoolean>;
        source: z.ZodOptional<z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>>;
        page: z.ZodOptional<z.ZodNumber>;
        booklet: z.ZodOptional<z.ZodString>;
        additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
            source: z.ZodEnum<{
                "False Flag": "False Flag";
                "Mech Monday": "Mech Monday";
                Rainmaker: "Rainmaker";
                "Reclamation of the Wastes": "Reclamation of the Wastes";
                "Relics of a Time Gone By": "Relics of a Time Gone By";
                "Salvage Union Starter Set": "Salvage Union Starter Set";
                "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
                "Thatcher's Mech Base": "Thatcher's Mech Base";
                "The Hive": "The Hive";
                "We Were Here First!": "We Were Here First!";
            }>;
            booklet: z.ZodOptional<z.ZodString>;
            page: z.ZodNumber;
        }, z.core.$strict>>>;
        systems: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            count: z.ZodOptional<z.ZodNumber>;
            preselectedChoices: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            head: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        modules: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            count: z.ZodOptional<z.ZodNumber>;
            preselectedChoices: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            head: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        drones: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            ref: z.ZodOptional<z.ZodString>;
            systems: z.ZodArray<z.ZodString>;
            modules: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/**
 * Pilot Classes (Base and Hybrid)
 */
export declare const ClassSchema: z.ZodUnion<readonly [z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hybrid: z.ZodBoolean;
    maxAbilities: z.ZodNumber;
    advanceable: z.ZodBoolean;
    coreTrees: z.ZodArray<z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>>;
    advancedTree: z.ZodOptional<z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>>;
    legendaryTree: z.ZodOptional<z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>>;
}, z.core.$strict>, z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hybrid: z.ZodBoolean;
    advanceable: z.ZodBoolean;
    maxAbilities: z.ZodNumber;
    advancedTree: z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>;
    legendaryTree: z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>;
}, z.core.$strict>]>;
/**
 * Bays and facilities on Union Crawlers.
 *
 * Two shapes are supported:
 * - Core fixed facilities (Workshop Manual / Starter Set) have a crew `npc`
 *   and a `damagedEffect`.
 * - Expansion "upgrade" / found bays (e.g. Bio-Mech Bay, Nanite Processing Bay,
 *   Training Bay) are player-addable or scenario facilities with a build `cost`
 *   and/or `techLevel`, and typically no crew NPC or damaged effect.
 */
export declare const CrawlerBaySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    expansion: z.ZodOptional<z.ZodBoolean>;
    damagedEffect: z.ZodOptional<z.ZodString>;
    npc: z.ZodOptional<z.ZodLazy<z.ZodObject<{
        position: z.ZodString;
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
        hitPoints: z.ZodNumber;
        choices: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
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
        }, z.core.$strict>>>>;
    }, z.core.$strict>>>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    cost: z.ZodOptional<z.ZodObject<{
        scrap: z.ZodOptional<z.ZodNumber>;
        bioSalvage: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    choices: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
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
    }, z.core.$strict>>>>;
    tableName: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
/**
 * Tech levels for Union Crawlers
 */
export declare const CrawlerTechLevelSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    techLevel: z.ZodNumber;
    structurePoints: z.ZodNumber;
    upkeepCost: z.ZodNumber;
    upgradeCost: z.ZodNullable<z.ZodNumber>;
    populationMin: z.ZodNumber;
    populationMax: z.ZodNullable<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Crawler vehicles
 */
export declare const CrawlerSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    npc: z.ZodLazy<z.ZodObject<{
        position: z.ZodString;
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
        hitPoints: z.ZodNumber;
        choices: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
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
        }, z.core.$strict>>>>;
    }, z.core.$strict>>;
    actions: z.ZodArray<z.ZodString>;
    mutations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            max_sp_bonus: "max_sp_bonus";
            weapon_slots: "weapon_slots";
        }>;
        value: z.ZodNumber;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/**
 * Creatures and wildlife
 */
export declare const CreatureSchema: z.ZodObject<{
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hitPoints: z.ZodNumber;
}, z.core.$strict>;
/**
 * Distances
 */
export declare const DistanceSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
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
}, z.core.$strict>;
/**
 * Tech level descriptions
 */
export declare const TechLevelEntitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    techLevel: z.ZodNumber;
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
}, z.core.$strict>;
/**
 * Autonomous drones.
 *
 * Most drones are configured from `systems`, but some drone-class threats
 * (e.g. The Iron Lady) carry named `actions` — sometimes including a "Titanic
 * Actions" entry — and equipped `modules`, mirroring a mech statblock.
 */
export declare const DroneSchema: z.ZodObject<{
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
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    modules: z.ZodOptional<z.ZodArray<z.ZodString>>;
    bonusPerTechLevel: z.ZodOptional<z.ZodObject<{
        structurePoints: z.ZodOptional<z.ZodNumber>;
        energyPoints: z.ZodOptional<z.ZodNumber>;
        heatCapacity: z.ZodOptional<z.ZodNumber>;
        systemSlots: z.ZodOptional<z.ZodNumber>;
        moduleSlots: z.ZodOptional<z.ZodNumber>;
        cargoCapacity: z.ZodOptional<z.ZodNumber>;
        techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
        salvageValue: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    choices: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
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
    }, z.core.$strict>>>>;
}, z.core.$strict>;
/**
 * Pilot equipment and gear
 */
export declare const EquipmentSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    bonusPerTechLevel: z.ZodOptional<z.ZodObject<{
        structurePoints: z.ZodOptional<z.ZodNumber>;
        energyPoints: z.ZodOptional<z.ZodNumber>;
        heatCapacity: z.ZodOptional<z.ZodNumber>;
        systemSlots: z.ZodOptional<z.ZodNumber>;
        moduleSlots: z.ZodOptional<z.ZodNumber>;
        cargoCapacity: z.ZodOptional<z.ZodNumber>;
        techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
        salvageValue: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    choices: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
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
    }, z.core.$strict>>>>;
}, z.core.$strict>;
/**
 * Faction groups and organizations
 */
export declare const FactionSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    goals: z.ZodString;
    assets: z.ZodString;
    weaknesses: z.ZodString;
    formation: z.ZodOptional<z.ZodArray<z.ZodObject<{
        chassis: z.ZodString;
        pattern: z.ZodOptional<z.ZodString>;
        schema: z.ZodOptional<z.ZodEnum<{
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
        }>>;
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        page: z.ZodNumber;
        quantity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>>;
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
}, z.core.$strict>;
/**
 * Game keywords and terminology
 */
export declare const KeywordSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
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
}, z.core.$strict>;
/**
 * Meld-infected creatures
 */
export declare const MeldSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    hitPoints: z.ZodOptional<z.ZodNumber>;
    structurePoints: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Mech modules
 */
export declare const ModuleSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
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
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    name: z.ZodString;
}, z.core.$strict>;
/**
 * Non-player characters and people
 */
export declare const NPCSchema: z.ZodObject<{
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hitPoints: z.ZodNumber;
    damageType: z.ZodOptional<z.ZodEnum<{
        HP: "HP";
        SP: "SP";
    }>>;
    bioSalvageValue: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Random tables and roll tables
 */
export declare const RollTableSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    table: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"standard">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"alternate">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19-20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        type: z.ZodLiteral<"flat">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"dramatic">;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"duos">;
        '1-2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3-4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5-6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7-8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13-14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15-16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17-18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19-20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"bio-chassis">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"columns">;
        '1-4': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '5-8': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '9-12': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '13-16': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '17-20': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"salvage-cache">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8-9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10-11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12-13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14-15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16-17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"octet">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5-7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14-16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">;
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
    indexable: z.ZodOptional<z.ZodLiteral<true>>;
}, z.core.$strict>;
/**
 * NPC squads and groups
 */
export declare const SquadSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hitPoints: z.ZodOptional<z.ZodNumber>;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    damageType: z.ZodOptional<z.ZodEnum<{
        HP: "HP";
        SP: "SP";
    }>>;
}, z.core.$strict>;
/**
 * Mech systems
 */
export declare const SystemSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
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
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    name: z.ZodString;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/**
 * Traits and special properties
 */
export declare const TraitEntitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
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
}, z.core.$strict>;
/**
 * Conventional vehicles.
 *
 * Unlike mechs, vehicles are not built from the system/module install economy:
 * their capabilities are expressed directly as named `actions`. The `systems`
 * field inherited from MechanicalEntitySchema is omitted here, and there is no
 * `modules` field — a vehicle carries neither (the schema is strict).
 */
export declare const VehicleSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
/**
 * Player-facing guides and processes (character creation, progression, downtime)
 */
export declare const GuideSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    guideType: z.ZodEnum<{
        "character-creation": "character-creation";
        "crawler-creation": "crawler-creation";
        downtime: "downtime";
        gameplay: "gameplay";
        "mech-creation": "mech-creation";
        progression: "progression";
    }>;
    steps: z.ZodArray<z.ZodLazy<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        section: z.ZodOptional<z.ZodString>;
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
        schema: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodEnum<{
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
        }>, z.ZodLiteral<"actions">]>>>;
        schemaEntities: z.ZodOptional<z.ZodArray<z.ZodString>>;
        schemaField: z.ZodOptional<z.ZodString>;
        rollTable: z.ZodOptional<z.ZodString>;
        choiceOptions: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>>;
        filters: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            operator: z.ZodOptional<z.ZodEnum<{
                eq: "eq";
                ne: "ne";
            }>>;
            value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>>;
        constraints: z.ZodOptional<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        guideRef: z.ZodOptional<z.ZodString>;
        optional: z.ZodOptional<z.ZodBoolean>;
        paperOnly: z.ZodOptional<z.ZodBoolean>;
        entityLayout: z.ZodOptional<z.ZodEnum<{
            sidebar: "sidebar";
        }>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/**
 * Source books and expansions
 */
export declare const SourceEntitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
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
    id: z.ZodString;
    blackMarket: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "False Flag": "False Flag";
            "Mech Monday": "Mech Monday";
            Rainmaker: "Rainmaker";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "The Hive": "The Hive";
            "We Were Here First!": "We Were Here First!";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    purchaseLink: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
/**
 * Catalog categories for organizing schemas in the UI (meta schema, not a game entity)
 */
export declare const CatalogCategorySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    schemas: z.ZodArray<z.ZodEnum<{
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
    }>>;
    flat: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;

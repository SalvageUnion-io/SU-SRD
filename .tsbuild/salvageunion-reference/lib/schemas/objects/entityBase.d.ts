/**
 * The shared entity head — id, name, source, page, artwork flag, content — and
 * the one entity variant declared here rather than in `entities.ts` because it
 * is embedded inside a class record.
 */
import { z } from '../../zod';
/**
 * Basic entity with name, content, source, and page reference
 */
export declare const BaseEntitySchema: z.ZodObject<{
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
}, z.core.$strip>;
/**
 * Advanced or hybrid character class
 */
export declare const AdvancedClassSchema: z.ZodObject<{
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
}, z.core.$strict>;

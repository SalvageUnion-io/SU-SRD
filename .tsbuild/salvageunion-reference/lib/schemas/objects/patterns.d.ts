/**
 * Mech patterns — a preset loadout for a chassis, plus the system/module and
 * drone configuration entries a pattern is built from.
 */
import { z } from '../../zod';
/**
 * Pattern system/module configuration
 */
export declare const PatternSystemModuleSchema: z.ZodObject<{
    name: z.ZodString;
    count: z.ZodOptional<z.ZodNumber>;
    preselectedChoices: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    head: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
/**
 * Named drone configuration for patterns with multiple drones
 */
export declare const PatternDroneConfigSchema: z.ZodObject<{
    name: z.ZodString;
    ref: z.ZodOptional<z.ZodString>;
    systems: z.ZodArray<z.ZodString>;
    modules: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
/**
 * Pattern schema. The `z.lazy()` is kept — it defers building the shape to
 * first use, exactly as before the objects split (when it was load-bearing for
 * a forward reference to `AdditionalSourceSchema`, now an ordinary import).
 * Removing it would change module-evaluation order for no benefit. The type is
 * inferred, never hand-annotated — see ContentBlockSchema for why.
 */
export declare const PatternSchema: z.ZodLazy<z.ZodObject<{
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
}, z.core.$strict>>;
/**
 * Bio-Titan pattern — a named variant of a Bio-Titan that the book prints as
 * "uses the stats of <Bio-Titan> with the following additional special rule"
 * (Rainmaker p.80, the Hill Worm Pattern Typhon). A DELTA, not a stat block:
 * the pattern inherits its Bio-Titan's Structure Points and actions, and
 * `actions` names only what it adds — so a change to the base is never
 * restated (and never drifts) across its patterns.
 */
export declare const BioTitanPatternSchema: z.ZodObject<{
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
}, z.core.$strict>;

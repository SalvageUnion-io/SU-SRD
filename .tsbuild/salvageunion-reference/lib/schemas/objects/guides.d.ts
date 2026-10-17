/**
 * Guides — the read-only, step-by-step transcriptions of the book's creation
 * and downtime procedures (ADR-021: a guide is never a wizard).
 */
import { z } from '../../zod';
/**
 * A single step in a guide
 */
export declare const GuideStepSchema: z.ZodLazy<z.ZodObject<{
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
}, z.core.$strict>>;
/**
 * Category of a guide
 */
export declare const GuideTypeSchema: z.ZodEnum<{
    "character-creation": "character-creation";
    "crawler-creation": "crawler-creation";
    downtime: "downtime";
    gameplay: "gameplay";
    "mech-creation": "mech-creation";
    progression: "progression";
}>;

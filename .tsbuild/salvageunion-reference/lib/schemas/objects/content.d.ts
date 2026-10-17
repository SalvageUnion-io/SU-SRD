/**
 * Structured content blocks — the renderable prose/list/datavalue payload that
 * hangs off almost every entity.
 */
import { z } from '../../zod';
/**
 * Block of structured content for rendering (paragraph, heading, list item, etc.)
 *
 * Wrapped in `z.lazy()` so the shape is only built on first use. The type is
 * deliberately INFERRED — a hand-written `z.ZodType<…>` annotation here silently
 * erases any key it forgets from `z.infer`, so the field parses and lands in the
 * generated JSON Schema while being invisible to every TypeScript consumer.
 */
export declare const ContentBlockSchema: z.ZodLazy<z.ZodObject<{
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
}, z.core.$strict>>;
/**
 * Array of content blocks
 */
export declare const ContentSchema: z.ZodArray<z.ZodLazy<z.ZodObject<{
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
}, z.core.$strict>>>;

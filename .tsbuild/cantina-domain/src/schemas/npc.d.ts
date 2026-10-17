import { z } from 'salvageunion-reference/zod';
/**
 * A built NPC: the fourth owned entity, beside pilots, mechs and crawlers
 * ([ADR-044](../../../../docs/ARCHITECTURE.md#decisions); the model is
 * `docs/architecture/npc-builder.md`).
 *
 * It combines the data's two NPC shapes. The stat block takes its names from
 * the standalone `npcs` entity (`NPCSchema` in salvageunion-reference): HP,
 * HP-or-SP, actions, traits, bio-salvage value. The identity takes its names
 * from a crawler crew member's live state (`CrawlerNpcStateSchema`) and the
 * book's crew choices: name, position, description, keepsake, motto, facts.
 *
 * Everything that comes from the book is a reference, never a copy (The Cantina's
 * "refs, never copies"): an action is its slug, a trait is the package's
 * `Trait` (`{ type, amount? }`, `type` the `traits.json` name, as `npcs.json`
 * stores it), and nothing re-derives from `templateRef`. The prose the player
 * writes (`description`) is theirs; a template's own text is never copied in.
 */
/** A trait, in the package's own shape (`TraitSchema` in salvageunion-reference). */
declare const NpcTraitSchema: z.ZodObject<{
    type: z.ZodString;
    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
}, z.core.$strict>;
export type NpcTrait = z.infer<typeof NpcTraitSchema>;
/** Where a built NPC started. Informational only: nothing re-derives from it. */
declare const NpcTemplateRefSchema: z.ZodObject<{
    schema: z.ZodEnum<{
        "crawler-bays": "crawler-bays";
        crawlers: "crawlers";
        npcs: "npcs";
    }>;
    slug: z.ZodString;
}, z.core.$strict>;
export type NpcTemplateRef = z.infer<typeof NpcTemplateRefSchema>;
export declare const NpcSchema: z.ZodObject<{
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
    templateRef: z.ZodOptional<z.ZodObject<{
        schema: z.ZodEnum<{
            "crawler-bays": "crawler-bays";
            crawlers: "crawlers";
            npcs: "npcs";
        }>;
        slug: z.ZodString;
    }, z.core.$strict>>;
    name: z.ZodString;
    position: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    keepsake: z.ZodOptional<z.ZodString>;
    motto: z.ZodOptional<z.ZodString>;
    facts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    choiceValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    hitPoints: z.ZodNumber;
    damageType: z.ZodEnum<{
        HP: "HP";
        SP: "SP";
    }>;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    }, z.core.$strict>>;
    bioSalvageValue: z.ZodOptional<z.ZodNumber>;
    currentHP: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strict>;
export type Npc = z.infer<typeof NpcSchema>;
export {};

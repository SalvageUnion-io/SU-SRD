import { z } from 'salvageunion-reference/zod';
/**
 * The party's shared scrap pool, bucketed by tech level ("the party
 * economy — 6 numbers"). Salvage deposits in; upkeep/craft/repair/trade
 * withdraw. SCRAP cargo lots crossing the crawler boundary deposit/withdraw
 * the matching bucket. Absent buckets read as 0.
 */
declare const ScrapPoolSchema: z.ZodObject<{
    tl1: z.ZodOptional<z.ZodNumber>;
    tl2: z.ZodOptional<z.ZodNumber>;
    tl3: z.ZodOptional<z.ZodNumber>;
    tl4: z.ZodOptional<z.ZodNumber>;
    tl5: z.ZodOptional<z.ZodNumber>;
    tl6: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type ScrapPool = z.infer<typeof ScrapPoolSchema>;
/**
 * Per-NPC live state shared by crawler-bay crew leads and the crawler-type's
 * special NPC. Extracted from the inline `crawlerBays` entry so the
 * type NPC (`typeNpc`) reuses the same shape. The NPC's freeform identity
 * fields (Keepsake/Motto) persist in the crawler's `bayChoices` map, NOT here —
 * this schema holds only the structured live-play state.
 */
declare const CrawlerNpcStateSchema: z.ZodObject<{
    npcName: z.ZodOptional<z.ZodString>;
    npcCurrentHP: z.ZodOptional<z.ZodNumber>;
    npcDescription: z.ZodOptional<z.ZodString>;
    npcFacts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    condition: z.ZodOptional<z.ZodEnum<{
        damaged: "damaged";
        intact: "intact";
    }>>;
}, z.core.$strict>;
export type CrawlerNpcState = z.infer<typeof CrawlerNpcStateSchema>;
/**
 * Crawler tech levels are I–VI per the Salvage Union ruleset.
 *
 * Optional fields read as their documented default when absent, so records
 * written before a field existed still parse.
 */
export declare const CrawlerSchema: z.ZodObject<{
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
    description: z.ZodOptional<z.ZodString>;
    techLevel: z.ZodString;
    type: z.ZodOptional<z.ZodString>;
    typeNpc: z.ZodOptional<z.ZodObject<{
        npcName: z.ZodOptional<z.ZodString>;
        npcCurrentHP: z.ZodOptional<z.ZodNumber>;
        npcDescription: z.ZodOptional<z.ZodString>;
        npcFacts: z.ZodOptional<z.ZodArray<z.ZodString>>;
        condition: z.ZodOptional<z.ZodEnum<{
            damaged: "damaged";
            intact: "intact";
        }>>;
    }, z.core.$strict>>;
    crawlerBays: z.ZodOptional<z.ZodArray<z.ZodObject<{
        npcName: z.ZodOptional<z.ZodString>;
        npcCurrentHP: z.ZodOptional<z.ZodNumber>;
        npcDescription: z.ZodOptional<z.ZodString>;
        npcFacts: z.ZodOptional<z.ZodArray<z.ZodString>>;
        condition: z.ZodOptional<z.ZodEnum<{
            damaged: "damaged";
            intact: "intact";
        }>>;
        bayRef: z.ZodString;
    }, z.core.$strict>>>;
    systems: z.ZodArray<z.ZodString>;
    bayChoices: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>>;
    seedRef: z.ZodOptional<z.ZodString>;
    currentSP: z.ZodOptional<z.ZodNumber>;
    scrapPool: z.ZodOptional<z.ZodObject<{
        tl1: z.ZodOptional<z.ZodNumber>;
        tl2: z.ZodOptional<z.ZodNumber>;
        tl3: z.ZodOptional<z.ZodNumber>;
        tl4: z.ZodOptional<z.ZodNumber>;
        tl5: z.ZodOptional<z.ZodNumber>;
        tl6: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    upgradePool: z.ZodOptional<z.ZodNumber>;
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
    maxSpModifier: z.ZodOptional<z.ZodNumber>;
    maxSpOverride: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strict>;
export type Crawler = z.infer<typeof CrawlerSchema>;
export {};

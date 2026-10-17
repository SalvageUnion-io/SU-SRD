import { z } from 'salvageunion-reference/zod';
export declare const EntityRefSchema: z.ZodObject<{
    type: z.ZodEnum<{
        crawler: "crawler";
        mech: "mech";
        npc: "npc";
        pilot: "pilot";
    }>;
    id: z.ZodString;
}, z.core.$strict>;
export type EntityRef = z.infer<typeof EntityRefSchema>;
/**
 * The container key every contained record carries — pilot, mech, crawler,
 * built NPC and encounter NPC spread it into their shapes (ADR-030 §2).
 */
export declare const containerFields: {
    /**
     * Which container holds this entity: a Game's id, or `null` for the owner's
     * **Shelf**. Optional because a template-seeded server body names no Game;
     * adoption stamps the row's `gameId` column into it (`planCrawlerSync`).
     * Read it through `containerOf()`.
     */
    gameId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
};

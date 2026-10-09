import { z } from 'salvageunion-reference/zod'

export const EntityRefSchema = z
  .object({
    type: z.enum(['pilot', 'mech', 'crawler']),
    id: z.string(),
  })
  .strict()

export type EntityRef = z.infer<typeof EntityRefSchema>

/**
 * The container key every contained record carries — pilot, mech, crawler and
 * encounter NPC spread it into their shapes (ADR-030 §2).
 */
export const containerFields = {
  /**
   * Which container holds this entity: a Game's id, or `null` for the owner's
   * **Shelf**. Optional because a template-seeded server body names no Game;
   * adoption stamps the row's `gameId` column into it (`planCrawlerSync`).
   * Read it through `containerOf()`.
   */
  gameId: z.string().nullable().optional(),
}

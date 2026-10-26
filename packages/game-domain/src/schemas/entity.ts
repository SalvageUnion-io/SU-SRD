import { z } from 'salvageunion-reference/zod'
import { ENTITY_KINDS } from '../entityKinds'

export const EntityRefSchema = z
  .object({
    type: z.enum(ENTITY_KINDS),
    id: z.string(),
  })
  .strict()

export type EntityRef = z.infer<typeof EntityRefSchema>

/**
 * The container key every contained record carries — pilot, mech, crawler,
 * built NPC and encounter NPC spread it into their shapes (ADR-030 §2).
 */
export const containerFields = {
  /**
   * Which container holds this entity: a Game's id, or `null` for the owner's
   * **Shelf**. Optional because a template-seeded server body names no Game;
   * the replica stamps the unit's Game into it as its room serves it.
   * Read it through `containerOf()`.
   */
  gameId: z.string().nullable().optional(),
}

import { z } from 'salvageunion-reference/zod'

export const EntityRefSchema = z
  .object({
    type: z.enum(['pilot', 'mech', 'crawler']),
    id: z.string(),
  })
  .strict()

export type EntityRef = z.infer<typeof EntityRefSchema>

/**
 * The container keys every contained record carries — pilot, mech, crawler and
 * encounter NPC spread these into their shapes (ADR-030 §2).
 */
export const containerFields = {
  /**
   * Which container holds this entity.
   *
   * `undefined` means the record predates the container split and should be
   * read through `containerOf()`, which falls back to `workspaceId`.
   * `null` means the owner's **Shelf** — not "unset". The distinction is the
   * whole point: a shelf is a real place an entity lives, not the absence of
   * one.
   */
  gameId: z.string().nullable().optional(),
  /**
   * @deprecated Superseded by `gameId` (ADR-030 §2). Retained because these
   * schemas are `.strict()`: dropping the key would fail the parse of every
   * already-migrated record. Removing it needs a follow-up migration that
   * strips it from stored rows first — a separate, irreversible change.
   */
  workspaceId: z.string().optional(),
}

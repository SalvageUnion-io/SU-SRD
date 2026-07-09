import { z } from 'salvageunion-reference/zod'

import { EntityRefSchema } from './entity'

/**
 * SoftLink captures a non-cascading directional relationship between two
 * entities. Deletion of either endpoint leaves the link orphaned (not
 * auto-deleted) — callers must query and clean up orphans explicitly.
 *
 * Relationship types:
 *   'mech-to-pilot'    — a mech is assigned to carry a pilot
 *   'pilot-to-crawler' — a pilot belongs to a crawler crew
 */
export const SoftLinkSchema = z
  .object({
    id: z.string(),
    from: EntityRefSchema,
    to: EntityRefSchema,
    type: z.enum(['mech-to-pilot', 'pilot-to-crawler']),
    createdAt: z.string().datetime(),
  })
  .strict()

export type SoftLink = z.infer<typeof SoftLinkSchema>

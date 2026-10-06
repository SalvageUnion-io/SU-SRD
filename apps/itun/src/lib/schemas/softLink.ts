import { z } from 'salvageunion-reference/zod'
import { EntityRefSchema } from './entity'

/**
 * SoftLink captures a directional assignment between two entities. Deleting an
 * endpoint cascades its links (`entityStore.delete`, and server-side
 * `pruneSoftLinksFor`).
 *
 * Relationship types (ADR-037 — cardinality and the same-container rule live in
 * `lib/links/linkRules.ts`):
 *   'mech-to-pilot'    — a mech is assigned to carry a pilot (1:1)
 *   'pilot-to-crawler' — a pilot belongs to a crawler crew (many pilots : 1)
 *   'mech-to-crawler'  — a mech docks in a crawler's bay, independently of its
 *                        pilot (many mechs : 1)
 */
export const SoftLinkSchema = z
  .object({
    id: z.string(),
    from: EntityRefSchema,
    to: EntityRefSchema,
    type: z.enum(['mech-to-pilot', 'pilot-to-crawler', 'mech-to-crawler']),
    createdAt: z.string().datetime(),
  })
  .strict()

export type SoftLink = z.infer<typeof SoftLinkSchema>

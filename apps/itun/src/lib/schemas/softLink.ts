import { z } from 'salvageunion-reference/zod'
import { EntityRefSchema } from './entity'

/**
 * Which crew slot of a crawler an `npc-to-crawler` link fills (ADR-043): one of
 * its bays, named by the bay's slug, or the crawler type's special NPC.
 */
export const CrewSlotSchema = z.union([
  z.object({ kind: z.literal('bay'), bayRef: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('type') }).strict(),
])

export type CrewSlot = z.infer<typeof CrewSlotSchema>

/**
 * SoftLink captures a directional assignment between two entities. Deleting an
 * endpoint cascades its links (`entityStore.delete`, and server-side
 * `pruneLinksOfRow`).
 *
 * Relationship types (ADR-037, ADR-043 — cardinality and the same-container
 * rule live in `lib/links/linkRules.ts`):
 *   'mech-to-pilot'    — a mech is assigned to carry a pilot (1:1)
 *   'pilot-to-crawler' — a pilot belongs to a crawler crew (many pilots : 1)
 *   'mech-to-crawler'  — a mech docks in a crawler's bay, independently of its
 *                        pilot (many mechs : 1)
 *   'npc-to-crawler'   — a built NPC crews one of a crawler's slots (`slot`):
 *                        one slot per NPC, one NPC per slot
 *
 * `slot` is required on `npc-to-crawler` and refused on the other three: the
 * link is the assignment, so the slot lives on it rather than on the NPC.
 */
export const SoftLinkSchema = z
  .object({
    id: z.string(),
    from: EntityRefSchema,
    to: EntityRefSchema,
    type: z.enum(['mech-to-pilot', 'pilot-to-crawler', 'mech-to-crawler', 'npc-to-crawler']),
    slot: CrewSlotSchema.optional(),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((link, ctx) => {
    const slotted = link.type === 'npc-to-crawler'
    if (slotted && link.slot === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['slot'],
        message: 'An npc-to-crawler link names a slot',
      })
    }
    if (!slotted && link.slot !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['slot'], message: `A ${link.type} link has no slot` })
    }
  })

export type SoftLink = z.infer<typeof SoftLinkSchema>

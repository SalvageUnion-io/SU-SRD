import { z } from 'salvageunion-reference/zod';
/**
 * Which crew slot of a crawler an `npc-to-crawler` link fills (ADR-044): one of
 * its bays, named by the bay's slug, or the crawler type's special NPC.
 */
export declare const CrewSlotSchema: z.ZodUnion<readonly [z.ZodObject<{
    kind: z.ZodLiteral<"bay">;
    bayRef: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"type">;
}, z.core.$strict>]>;
export type CrewSlot = z.infer<typeof CrewSlotSchema>;
/**
 * SoftLink captures a directional assignment between two entities. Deleting an
 * endpoint cascades its links (`entityStore.delete`, and server-side
 * `pruneLinksOfRow`).
 *
 * Relationship types (ADR-037, ADR-044 — cardinality and the same-container
 * rule live in `links/linkRules.ts`):
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
export declare const SoftLinkSchema: z.ZodObject<{
    id: z.ZodString;
    from: z.ZodObject<{
        type: z.ZodEnum<{
            crawler: "crawler";
            mech: "mech";
            npc: "npc";
            pilot: "pilot";
        }>;
        id: z.ZodString;
    }, z.core.$strict>;
    to: z.ZodObject<{
        type: z.ZodEnum<{
            crawler: "crawler";
            mech: "mech";
            npc: "npc";
            pilot: "pilot";
        }>;
        id: z.ZodString;
    }, z.core.$strict>;
    type: z.ZodEnum<{
        "mech-to-crawler": "mech-to-crawler";
        "mech-to-pilot": "mech-to-pilot";
        "npc-to-crawler": "npc-to-crawler";
        "pilot-to-crawler": "pilot-to-crawler";
    }>;
    slot: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        kind: z.ZodLiteral<"bay">;
        bayRef: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"type">;
    }, z.core.$strict>]>>;
    createdAt: z.ZodString;
}, z.core.$strict>;
export type SoftLink = z.infer<typeof SoftLinkSchema>;

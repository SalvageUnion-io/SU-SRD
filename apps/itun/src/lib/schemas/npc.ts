import { z } from 'salvageunion-reference/zod'
import { containerFields } from './entity'

/**
 * A built NPC: the fourth owned entity, beside pilots, mechs and crawlers
 * ([ADR-043](../../../../../docs/ARCHITECTURE.md#adr-043); the model is
 * `docs/architecture/npc-builder.md`).
 *
 * It combines the data's two NPC shapes. The stat block takes its names from
 * the standalone `npcs` entity (`NPCSchema` in salvageunion-reference): HP,
 * HP-or-SP, actions, traits, bio-salvage value. The identity takes its names
 * from a crawler crew member's live state (`CrawlerNpcStateSchema`) and the
 * book's crew choices: name, position, description, keepsake, motto, facts.
 *
 * Everything that comes from the book is a reference, never a copy (ITUN's
 * "refs, never copies"): an action is its slug, a trait is the package's
 * `Trait` (`{ type, amount? }`, `type` the `traits.json` name, as `npcs.json`
 * stores it), and nothing re-derives from `templateRef`. The prose the player
 * writes (`description`) is theirs; a template's own text is never copied in.
 */

/** A trait, in the package's own shape (`TraitSchema` in salvageunion-reference). */
export const NpcTraitSchema = z
  .object({
    type: z.string().min(1),
    amount: z.union([z.number().int().min(0), z.string()]).optional(),
  })
  .strict()

/** Where a built NPC started. Informational only: nothing re-derives from it. */
export const NpcTemplateRefSchema = z
  .object({
    schema: z.enum(['npcs', 'crawler-bays', 'crawlers']),
    slug: z.string().min(1),
  })
  .strict()

export const NpcSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    ...containerFields,

    templateRef: NpcTemplateRefSchema.optional(),

    // Identity: the names match CrawlerNpcStateSchema and the crew choices.
    name: z.string().min(1),
    /** Role title ("Doc", "Union Quartermaster"). */
    position: z.string().optional(),
    description: z.string().optional(),
    keepsake: z.string().optional(),
    motto: z.string().optional(),
    facts: z.array(z.string()).optional(),
    /**
     * A crew slot's other choices, by the choice's name (today only the
     * Augmented A.I.'s "A.I. Personality"). Name, Description, Keepsake and
     * Motto have fields of their own above.
     */
    choiceValues: z.record(z.string(), z.string()).optional(),

    // Stat block: the names match NPCSchema.
    /**
     * Max HP (or SP). Zero is a real value: the Augmented crawler's A.I. has
     * none, and an NPC with max 0 is never shown as down.
     */
    hitPoints: z.number().int().min(0),
    damageType: z.enum(['HP', 'SP']),
    /** Action slugs into `actions.json`. Never text. */
    actions: z.array(z.string().min(1)),
    traits: z.array(NpcTraitSchema),
    bioSalvageValue: z.number().int().min(0).optional(),

    // Play state.
    /** Current HP. Absent is full, as on pilots. */
    currentHP: z.number().int().min(0).optional(),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Npc = z.infer<typeof NpcSchema>

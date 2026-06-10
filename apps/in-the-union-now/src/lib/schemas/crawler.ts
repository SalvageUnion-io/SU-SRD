import { z } from 'zod'
import { CargoLotSchema } from './cargoLot'
import { ChoiceSelectionsSchema } from './pilot'

/**
 * The party's shared scrap pool, bucketed by tech level (rules C5: "the party
 * economy — 6 numbers"). Salvage deposits in; upkeep/craft/repair/trade
 * withdraw. SCRAP cargo lots crossing the crawler boundary deposit/withdraw
 * the matching bucket. Absent buckets read as 0.
 */
export const ScrapPoolSchema = z
  .object({
    tl1: z.number().int().min(0).optional(),
    tl2: z.number().int().min(0).optional(),
    tl3: z.number().int().min(0).optional(),
    tl4: z.number().int().min(0).optional(),
    tl5: z.number().int().min(0).optional(),
    tl6: z.number().int().min(0).optional(),
  })
  .strict()
export type ScrapPool = z.infer<typeof ScrapPoolSchema>

/**
 * Crawler tech levels are I–VI per the Salvage Union ruleset.
 */
export const CrawlerSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    /** Tech level (I–VI) expressed as a string slug, e.g. "tech-1" */
    techLevel: z.string(),
    /**
     * Installed SRD crawler bays (Command Bay, Mech Bay, Storage Bay, …). The
     * official crawler sheets pre-print all bays as fixed sections, so every
     * crawler is seeded with the full set on creation; the array is extensible
     * so a crawler can gain more bays over time.
     *
     * Each entry tracks the bay's embedded NPC's live state (name + current
     * HP). The NPC's max HP comes from the SRD bay's `npc.hitPoints` (4); the
     * crew is the per-bay NPC, which replaces the legacy free-text `bays`
     * (crew/mech assignment) field.
     *
     * Optional so crawlers persisted before this field was added still validate
     * on read (no version bump / migration required); read sites treat a
     * missing value as an empty list.
     */
    crawlerBays: z
      .array(
        z.object({
          /** SRD crawler-bay id (or name) this entry installs. */
          bayRef: z.string(),
          /** Freeform name the player gave the bay's embedded NPC. */
          npcName: z.string().optional(),
          /** NPC's current HP (max from the SRD bay's `npc.hitPoints`, 4). */
          npcCurrentHP: z.number().int().min(0).optional(),
          /**
           * Player-editable freeform description of the bay's embedded NPC
           * (appearance, personality, etc.). Distinct from the SRD bay's own
           * rules text (`content`), which is read-only and resolved from the
           * reference entity. Optional — additive field, no DB migration needed.
           */
          npcDescription: z.string().optional(),
          /**
           * Player-decided facts about the bay's NPC — a freeform list of short
           * strings the table has established in play (add/remove). Optional;
           * read sites treat a missing value as an empty list.
           */
          npcFacts: z.array(z.string()).optional(),
          /**
           * Bay condition (rules C8). Bays are Intact/Damaged ONLY — never
           * Destroyed (unlike mech items). Damaged disables the bay's
           * function; repair costs 5 Scrap of crawler TL or higher. Absent
           * reads as 'intact'.
           */
          condition: z.enum(['intact', 'damaged']).optional(),
        })
      )
      .optional(),
    /** Slugs of crawler system items installed */
    systems: z.array(z.string()),
    /**
     * Persisted crawler-bay choice selections, keyed by bay ref (the same
     * `crawlerBays[].bayRef` slug/id used to resolve the SRD bay), then by
     * choiceId → selected option values. Some SRD bays carry `choices` (e.g.
     * the Armament Bay's "Armament Bay Weapons System" permanent pick); this
     * persists the player's selection so it survives reloads.
     *
     * Optional: when absent or a key is missing, the display layer treats that
     * bay as having no selections. Additive optional field — no DB migration
     * needed (same tactic as Pilot.equipmentChoices / crawlerBays).
     */
    bayChoices: z.record(z.string(), ChoiceSelectionsSchema).optional(),
    /** Optional: links this crawler to a workspace */
    workspaceId: z.string().optional(),
    // ---------------------------------------------------------------------------
    // Live-play current stat tracking (#245).
    // TODO: source base value from rules once crawler tech-level data exposes SP.
    // ---------------------------------------------------------------------------
    /** Current structure points */
    currentSP: z.number().int().min(0).optional(),
    // ---------------------------------------------------------------------------
    // Shared party economy + cargo (plan 2.4, rules C4/C5/C6).
    // All additive-optional — absent reads as the documented default.
    // ---------------------------------------------------------------------------
    /** Shared scrap pool bucketed by TL 1–6. Absent = all buckets 0. */
    scrapPool: ScrapPoolSchema.optional(),
    /**
     * Upgrade Pool progress (rules C4): paid Upkeep accumulates here plus
     * voluntary scrap; upgrade at 30× TL. Absent = 0.
     */
    upgradePool: z.number().int().min(0).optional(),
    /**
     * Cargo lots in the crawler's hold. Unlimited capacity (Storage Bay,
     * rules C6) — no cap math, unlike mech cargoLots. Absent = empty.
     */
    cargoLots: z.array(CargoLotSchema).optional(),
    /**
     * Hand-edited bonus to max SP on top of the tech-level base — the Battle
     * Crawler type's +5 Max SP (rules C1) lives here. Derived max SP =
     * tech-level structurePoints + this (lib/rules/derivedStats.ts). Absent = 0.
     */
    maxSpModifier: z.number().int().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Crawler = z.infer<typeof CrawlerSchema>

import { z } from 'salvageunion-reference/zod'
import { containerFields } from './entity'
import { ItemConditionMapSchema } from './itemCondition'
import { PartnerInstanceSchema } from './partner'
import { photoFields } from './photo'

/**
 * Persisted choice selections for an entity that carries `choices`
 * (e.g. granted equipment with permanent/multi-select picks).
 *
 * Mirrors the UI library's `ChoiceSelections` type exactly:
 *   Record<choiceId, selectedOptionValues[]>
 * so it can be passed straight into ReferenceEntityCard's controlled
 * `selections` prop. Free-text choices store their value as a single-element array.
 */

export const ChoiceSelectionsSchema = z.record(z.string(), z.array(z.string()))

/**
 * A pilot injury. Minor = −1 max HP (heals at Med Bay T3–4);
 * Major = −2 max HP (heals at T5–6). Injuries stack; when derived max HP
 * reaches 0 the pilot dies. The severity enum drives the max-HP derivation in
 * lib/rules/derivedStats.ts; `note` records the source/description.
 */

const InjurySchema = z
  .object({
    severity: z.enum(['minor', 'major']),
    note: z.string(),
  })
  .strict()

/**
 * Critical Injury Table outcome bands (Core Book p.241; mirrors the
 * "Critical Injury" entry in salvageunion-reference data/roll-tables.json).
 * - fatal: roll 1 — the pilot dies (never auto-applied; player marks it)
 * - major-injury: roll 2-5 — −2 max HP until healed (T5-6 Med Bay) + Unconscious
 * - minor-injury: roll 6-10 — −1 max HP until healed (T3-4 Med Bay) + Unconscious
 * - unconscious: roll 11-19 — stable at 0 HP, unconscious until ≥1 HP
 * - miraculous-survival: roll 20 — 1 HP, conscious, acts normally
 */

const CriticalInjuryOutcomeSchema = z.enum([
  'fatal',
  'major-injury',
  'minor-injury',
  'unconscious',
  'miraculous-survival',
])

/**
 * Recorded result of a Critical Injury Table roll (rolled when the pilot
 * reaches 0 HP). Snapshot-safe plain data stored on the pilot — same shape
 * discipline as the mech's HeatCheckResult/CriticalDamageResult.
 */

const CriticalInjuryResultSchema = z
  .object({
    roll: z.number().int().min(1).max(20),
    outcome: CriticalInjuryOutcomeSchema,

    /** ISO timestamp of when this result was rolled. */
    rolledAt: z.string().datetime(),
  })
  .strict()

/**
 * A free-form inventory entry with an explicit slot cost. Used for
 * anything the pilot carries that is not a reference equipment slug — most
 * importantly Scrap (3 slots each). Slot math at the display
 * layer sums `slotCost` truthfully alongside reference equipment.
 */

const GenericInventoryEntrySchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),

    /** Explicit inventory-slot cost for this entry (Scrap = 3). */
    slotCost: z.number().int().min(0),

    /** Optional quantity for stackable entries; absent means 1. */
    qty: z.number().int().min(1).optional(),
    note: z.string().optional(),
  })
  .strict()

export type GenericInventoryEntry = z.infer<typeof GenericInventoryEntrySchema>

/**
 * classRef: slug reference to a class in salvageunion-reference.
 * Resolution against game data is handled at the presentation/query layer.
 *
 * Optional fields read as their documented default when absent, so records
 * written before a field existed still parse.
 */

export const PilotSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),

    /** Pilot's real name — must not be empty. */
    name: z.string().min(1),

    /** Pilot's callsign / handle — must not be empty. */
    callsign: z.string().min(1),
    /**
     * The pilot's pronouns, as free text — never a picker. A closed list gets
     * someone wrong, and this is the pilot's own word for themselves.
     */
    pronouns: z.string().optional(),

    /** Slug reference to a Pilot Class in salvageunion-reference */
    classRef: z.string(),

    /**
     * The Core class this pilot advanced OUT of, when `classRef` names a Hybrid.
     *
     * **Reference data, not an entity link.** This is a class slug pointing into
     * `salvageunion-reference` — never at another row — so it creates no
     * relationship between two records and there is nothing to keep in sync.
     *
     * **An override, not the record of truth.** The origin is normally DERIVED
     * from the trees the pilot holds abilities in, and that derivation is
     * reliable rather than a guess: advancing legally takes 6 Core abilities —
     * 3 in the gate tree, which the hybrid grants and so proves nothing, plus 3
     * more that only the origin's own trees can supply. So this field stays
     * absent for the ordinary pilot and is written only when the player answers
     * a disambiguation, which is the case derivation cannot cover: a pilot with
     * no abilities yet, one holding only trees the hybrid grants anyway, or a
     * free-edited pilot whose trees point two ways at once.
     *
     * Absent reads as "derive it". It deliberately CANNOT be backfilled: unlike
     * `seedRef`, no stored value implies it.
     */
    originClassRef: z.string().optional(),

    /**
     * Slugs of class abilities selected for this pilot.
     * Uncapped at the schema level so advancement beyond the creation budget
     * can persist. The rules cap — 10 abilities, 12 for Salvager —
     * is a SOFT warning (lib/rules/softWarnings.ts), never a parse failure.
     */
    abilities: z.array(z.string()),

    /**
     * Slugs of equipment items carried. Uncapped at the schema level — the
     * creation budget (3 at TL1) is wizard guidance, not a persistence cap.
     */
    equipment: z.array(z.string()),
    motto: z.string(),
    keepsake: z.string(),
    appearance: z.string(),
    background: z.string().default(''),

    /**
     * Freeform bio / backstory, distinct from `background` (the short Background
     * archetype). Rendered on the pilot sheet, edited in the wizard.
     */
    description: z.string().optional(),

    /** Active condition slugs */
    conditions: z.array(z.string()),

    ...containerFields,
    /** The entity's own picture; see `PhotoSchema`. */
    ...photoFields,

    /**
     * Which built-in template row this was spawned from, if any.
     *
     * **Provenance, never identity.** A seeded entity is a *copy* of a
     * template, so it gets its own UUID like everything else created here; this
     * records which template it came from, so "is the Starter Set already
     * present?" can be answered without making the answer depend on two
     * different people's rows sharing an id.
     * Ids are the `appId` an entity is addressed by on the server, where two
     * accounts holding the same one resolve to a single row — so a fixed
     * template id would make the later player's writes refused as somebody
     * else's entity.
     *
     * Absent on everything a person built themselves, which is nearly every row.
     */
    seedRef: z.string().optional(),

    // ---------------------------------------------------------------------------
    // Live-play current stat tracking.
    // A freshly created pilot is seeded with the base HP/AP rule constants
    // (PILOT_BASE_HP / PILOT_BASE_AP in lib/rules/derivedStats, via
    // pilotFormState). Absent means full: see `resolvePool`.
    // ---------------------------------------------------------------------------
    /** Current hit points */
    currentHP: z.number().int().min(0).optional(),

    /** Current action points */
    currentAP: z.number().int().min(0).optional(),

    /**
     * Per-equipment condition map. Keyed by equipment slug.
     * When absent or key missing, the display layer defaults to 'intact'.
     */
    equipmentConditions: ItemConditionMapSchema.optional(),

    /**
     * Persisted granted-equipment choice selections, keyed by equipment slug,
     * then by choiceId → selected option values. Optional: when absent or a key
     * is missing, the display layer treats that item as having no selections.
     */
    equipmentChoices: z.record(z.string(), ChoiceSelectionsSchema).optional(),

    /**
     * Statted Drones / Companions this pilot's abilities grant (Auto-Turret,
     * Survey Drone, Mecha Companion). Each carries its own id, so Mecha
     * Packmaster's TWO Mecha Companions are two distinct partners rather than
     * one shared entry. Absent reads as none.
     */
    partners: z.array(PartnerInstanceSchema).optional(),

    /**
     * Manual fallback for the pilot's effective Crawler Tech Level (1–6), which
     * scales choice caps (e.g. the Custom Sniper Rifle's Modification choice,
     * "at each Tech Level you may select an additional Modification") and the
     * Stat Training bonus to max HP/AP (`pilotMaxHPParts`). Only used
     * when the pilot is NOT linked to a crawler; when a crawler is associated its
     * techLevel takes precedence (see resolveEffectiveCrawlerLevel).
     */
    crawlerLevel: z.number().int().min(1).max(6).optional(),

    /**
     * Slugs of pilot abilities that have been "used" this rest. Used for
     * once-per-rest abilities: the per-ability toggle adds/removes a slug here.
     * When absent or a slug is missing, the ability reads as available (not yet
     * used).
     */
    usedAbilities: z.array(z.string()).optional(),

    // ---------------------------------------------------------------------------
    // Advancement + derived-maxima state.
    // Absent reads as the documented default.
    // ---------------------------------------------------------------------------
    /** Training Points available to spend (+1 per Downtime). Absent = 0. */
    trainingPoints: z.number().int().min(0).optional(),

    /**
     * Injuries list (enum severity, not free-form). Drives the max-HP
     * derivation: maxHP = 10 + 2×(crawler tech − 1) + maxHpModifier
     * − Σ(minor: 1, major: 2).
     * Absent = no injuries.
     */
    injuries: z.array(InjurySchema).optional(),

    /**
     * A general, hand-entered adjustment to max HP ("Manual adjustment" in the
     * provenance panel). NOT Stat Training: that is derived from the crawler
     * tier at read time (+2 per tech level above 1 — `pilotMaxHPParts`), and
     * abilities contribute through their own named lines. Injury penalties are
     * NOT folded in here either — they are derived from `injuries` so healing
     * an injury restores max HP without bookkeeping. Absent = 0.
     */
    maxHpModifier: z.number().int().optional(),

    /**
     * A general, hand-entered adjustment to max AP. NOT Stat Training, which is
     * derived from the crawler tier (+1 per tech level above 1 —
     * `pilotMaxAPParts`). Absent = 0.
     */
    maxApModifier: z.number().int().optional(),

    /**
     * Passive bonuses to inventory capacity over the base 6
     * (e.g. Beefcake +4). Absent = 0.
     */
    maxInventorySlotsModifier: z.number().int().optional(),

    // ---------------------------------------------------------------------------
    // Cap overrides — absolute pins (ADR-022 amendment, Free Edit only).
    //
    // When present the stat SHOWS this value and stops tracking its derivation.
    // The derived total is still computed underneath for the "overridden from N"
    // callout and the one-click revert; it is never persisted. Distinct from the
    // max*Modifier fields above, which are manual adjustments that CONTRIBUTE to
    // the derivation rather than replacing it. See ADR-029.
    // ---------------------------------------------------------------------------
    /** Absolute pinned max Hit Points. */
    maxHpOverride: z.number().int().nonnegative().optional(),

    /** Absolute pinned max Ability Points. */
    maxApOverride: z.number().int().nonnegative().optional(),

    /** Absolute pinned inventory capacity. */
    maxInventorySlotsOverride: z.number().int().nonnegative().optional(),

    /**
     * Per-equipment Uses (X) counters, keyed by equipment slug.
     * Value = uses remaining; absent key = item at full uses. All uses
     * recharge after a week of Downtime (Orbital Lance never — hand-managed).
     */
    equipmentUses: z.record(z.string(), z.number().int().min(0)).optional(),

    /**
     * The three once-per-Downtime 'Used' toggles from the official pilot
     * sheet. true = used this cycle; reset at Downtime.
     */
    usedToggles: z
      .object({
        background: z.boolean().optional(),
        keepsake: z.boolean().optional(),
        motto: z.boolean().optional(),
      })
      .strict()
      .optional(),

    /**
     * Free-form inventory entries with explicit slot costs — the pilot-side
     * home for Scrap (3 slots each) and other non-reference items.
     */
    genericInventory: z.array(GenericInventoryEntrySchema).optional(),

    /**
     * The most recent Critical Injury Table result (rolled on reaching 0
     * HP). Snapshot-safe plain data.
     */
    lastCriticalInjury: CriticalInjuryResultSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Pilot = z.infer<typeof PilotSchema>

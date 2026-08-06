import { z } from 'salvageunion-reference/zod'
import { ItemConditionMapSchema } from './mech'
import { PartnerInstanceSchema } from './partner'

/**
 * Persisted choice selections for an entity that carries `choices`
 * (e.g. granted equipment with permanent/multi-select picks).
 *
 * Mirrors component-lib's `ChoiceSelections` type exactly:
 *   Record<choiceId, selectedOptionValues[]>
 * so it can be passed straight into ReferenceEntityCard's controlled
 * `selections` prop. Free-text choices store their value as a single-element array.
 */

export const ChoiceSelectionsSchema = z.record(z.string(), z.array(z.string()))

/**
 * A pilot injury (rules A11). Minor = −1 max HP (heals at Med Bay T3–4);
 * Major = −2 max HP (heals at T5–6). Injuries stack; when derived max HP
 * reaches 0 the pilot dies. The severity enum drives the max-HP derivation in
 * lib/rules/derivedStats.ts; `note` records the source/description.
 */

export const InjurySchema = z
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

export const CriticalInjuryOutcomeSchema = z.enum([
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

export const CriticalInjuryResultSchema = z
  .object({
    roll: z.number().int().min(1).max(20),
    outcome: CriticalInjuryOutcomeSchema,

    /** ISO timestamp of when this result was rolled. */
    rolledAt: z.string().datetime(),
  })
  .strict()

/**
 * A free-form inventory entry with an explicit slot cost (plan S7). Used for
 * anything the pilot carries that is not a reference equipment slug — most
 * importantly Scrap (3 slots each per rules A13). Slot math at the display
 * layer sums `slotCost` truthfully alongside reference equipment.
 */

export const GenericInventoryEntrySchema = z
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
     *
     * Additive-optional, so records written before this field still validate on
     * read (no version bump / migration).
     */
    pronouns: z.string().optional(),

    /** Slug reference to a Pilot Class in salvageunion-reference */
    classRef: z.string(),

    /**
     * Slugs of class abilities selected for this pilot.
     * Uncapped at the schema level so advancement beyond the creation budget
     * can persist (plan 2.2). The rules cap — 10 abilities, 12 for Salvager —
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
     * Freeform bio / backstory. Additive-optional (no DB migration — absent
     * reads as undefined); distinct from `background` (the short Background
     * archetype). Rendered on the pilot sheet, edited in the wizard.
     */
    description: z.string().optional(),

    /** Active condition slugs */
    conditions: z.array(z.string()),

    /**
     * Which container holds this entity (ADR-030 §2).
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

    /**
     * Which built-in template row this was spawned from, if any.
     *
     * **Provenance, never identity.** A seeded entity is a *copy* of a
     * template, so it gets its own UUID like everything else created here; this
     * records which template it came from, so "is the Starter Set already
     * present?" can be answered without making the answer depend on two
     * different people's rows sharing an id.
     *
     * That is precisely what the Starter Set used to rely on: it wrote fixed
     * ids (`starter-pilot-bonesaw`, …) so that re-seeding would overwrite
     * rather than duplicate. Locally that worked; globally it was wrong. Every
     * player who seeded the roster held byte-identical ids, and those ids are
     * the `appId` a claimed entity is addressed by on the server — where two
     * accounts bringing the same one resolve to a single row, so the later
     * player's writes are refused as somebody else's entity.
     *
     * Absent on everything a person built themselves, which is nearly every row.
     */
    seedRef: z.string().optional(),

    // ---------------------------------------------------------------------------
    // Live-play current stat tracking (#245).
    // A freshly created pilot is seeded with the base HP/AP rule constants
    // (PILOT_BASE_HP / PILOT_BASE_AP in lib/rules/derivedStats, via
    // pilotFormState). Kept optional so legacy/imported records still parse;
    // read sites fall back to the derived maxHP/maxAP.
    // ---------------------------------------------------------------------------
    /** Current hit points */
    currentHP: z.number().int().min(0).optional(),

    /** Current action points */
    currentAP: z.number().int().min(0).optional(),

    /**
     * Per-equipment condition map (REQ-011 #240). Keyed by equipment slug.
     * When absent or key missing, the display layer defaults to 'intact'.
     */
    equipmentConditions: ItemConditionMapSchema.optional(),

    /**
     * Persisted granted-equipment choice selections, keyed by equipment slug,
     * then by choiceId → selected option values. Optional: when absent or a key
     * is missing, the display layer treats that item as having no selections.
     * Additive optional field — no DB migration needed (same tactic as
     * equipmentConditions).
     */
    equipmentChoices: z.record(z.string(), ChoiceSelectionsSchema).optional(),

    /**
     * @deprecated Superseded by `partners` (ADR-027). Nothing reads or writes
     * this any more — the v11 migration lifts each entry into a
     * `PartnerInstance` with its own id, which is what fixed the bug described
     * below (two of one drone sharing a single slug-keyed entry).
     *
     * The field is RETAINED rather than deleted for two reasons, both concrete:
     * `PilotSchema` is `.strict()`, so a migrated record that still carries the
     * key would fail to parse the moment the field disappears; and keeping it
     * means the migration stays reversible from a pre-v11 export. Removing it
     * needs a follow-up migration that deletes the key from every stored pilot
     * FIRST — which is a separate, irreversible change and does not belong in
     * the same release as the feature that replaced it.
     *
     * ---
     * Per-equipment installed loadout for drone/companion equipment that carries
     * its own systemSlots/moduleSlots (Survey Drone, Mecha Companion,
     * Auto-Turret). Keyed by equipment slug → the systems/modules installed on
     * that instance; refs are system/module slugs (same convention as
     * mech.systems/modules). Edited through the same "Add System/Module" picker
     * mechs use, with the same per-item condition/uses tracking scoped to this
     * instance: `systemConditions`/`moduleConditions` keyed by the item slug
     * (Intact/Damaged/Destroyed) and `itemUses` (uses remaining, absent = full)
     * — the pilot-equipment analogue of mech.systemConditions/moduleConditions/
     * itemUses. Additive-optional — absent reads as no loadout; no DB migration
     * needed (same tactic as equipmentChoices/equipmentConditions). Keyed by slug
     * so two of the same drone slug on one pilot would share an entry — an
     * accepted limitation identical to equipmentChoices.
     */
    equipmentLoadouts: z
      .record(
        z.string(),
        z
          .object({
            systems: z.array(z.string()).default([]),
            modules: z.array(z.string()).default([]),

            /** Per-installed-system condition (slug → Intact/Damaged/Destroyed). */
            systemConditions: ItemConditionMapSchema.optional(),

            /** Per-installed-module condition (slug → Intact/Damaged/Destroyed). */
            moduleConditions: ItemConditionMapSchema.optional(),

            /** Uses remaining per installed item slug (absent = full, rules B13). */
            itemUses: z.record(z.string(), z.number().int().min(0)).optional(),
          })
          .strict()
      )
      .optional(),

    /**
     * Statted Drones / Companions this pilot's abilities grant (Auto-Turret,
     * Survey Drone, Mecha Companion). Each carries its own id, so Mecha
     * Packmaster's TWO Mecha Companions are two distinct partners rather than
     * one shared entry — the bug `equipmentLoadouts` could not express.
     * Additive-optional; absent reads as none.
     */
    partners: z.array(PartnerInstanceSchema).optional(),

    /**
     * Manual fallback for the pilot's effective Crawler Tech Level (1–6), used
     * to scale choice caps (e.g. the Custom Sniper Rifle's Modification choice,
     * "at each Tech Level you may select an additional Modification"). Only used
     * when the pilot is NOT linked to a crawler; when a crawler is associated its
     * techLevel takes precedence (see resolveEffectiveCrawlerLevel). Optional and
     * additive — no DB migration needed (same tactic as equipmentChoices).
     */
    crawlerLevel: z.number().int().min(1).max(6).optional(),

    /**
     * Slugs of pilot abilities that have been "used" this rest (live-play, Slice
     * D). Used for once-per-rest abilities: the per-ability toggle adds/removes a
     * slug here. When absent or a slug is missing, the ability reads as available
     * (not yet used). Additive optional field — no DB migration needed (same
     * tactic as equipmentChoices).
     */
    usedAbilities: z.array(z.string()).optional(),

    // ---------------------------------------------------------------------------
    // Advancement + derived-maxima state (plan 2.2, rules A2/A4/A5/A11/A14).
    // All additive-optional — no DB migration required; absent reads as the
    // documented default.
    // ---------------------------------------------------------------------------
    /** Training Points available to spend (rules A5: +1 per Downtime). Absent = 0. */
    trainingPoints: z.number().int().min(0).optional(),

    /**
     * Injuries list (enum severity, not free-form). Drives the max-HP
     * derivation: maxHP = 10 + maxHpModifier − Σ(minor: 1, major: 2).
     * Absent = no injuries.
     */
    injuries: z.array(InjurySchema).optional(),

    /**
     * Training/passive bonuses to max HP ONLY (Stat Training +2 per tier,
     * Beefcake, Defy Death, …). Injury penalties are NOT folded in here — they
     * are derived from `injuries` so healing an injury restores max HP without
     * bookkeeping. Absent = 0.
     */
    maxHpModifier: z.number().int().optional(),

    /** Training/passive bonuses to max AP (Stat Training +1 per tier). Absent = 0. */
    maxApModifier: z.number().int().optional(),

    /**
     * Passive bonuses to inventory capacity over the base 6 (rules A13 —
     * e.g. Beefcake +4). Absent = 0.
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
     * Per-equipment Uses (X) counters (rules A14), keyed by equipment slug.
     * Value = uses remaining; absent key = item at full uses. All uses
     * recharge after a week of Downtime (Orbital Lance never — hand-managed).
     */
    equipmentUses: z.record(z.string(), z.number().int().min(0)).optional(),

    /**
     * The three once-per-Downtime 'Used' toggles from the official pilot
     * sheet (rules A8–A10). true = used this cycle; reset at Downtime.
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
     * home for Scrap (3 slots each) and other non-reference items (plan S7).
     */
    genericInventory: z.array(GenericInventoryEntrySchema).optional(),

    /**
     * The most recent Critical Injury Table result (rolled on reaching 0 HP —
     * design-review R-1). Additive optional field, snapshot-safe plain data.
     */
    lastCriticalInjury: CriticalInjuryResultSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Pilot = z.infer<typeof PilotSchema>

/**
 * Pilots persisted (or exported/published) before the vestigial `rollResults`
 * field was removed still carry it — and the strict PilotSchema would reject
 * them. Drop the field before parsing. Mirrors normalizeLegacyCargoRecord;
 * the v4 IndexedDB migration applies the same rewrite on local records.
 */

export function normalizeLegacyPilotRecord(
  record: Record<string, unknown>
): Record<string, unknown> {
  if (!('rollResults' in record)) return record
  const rest = { ...record }
  delete rest.rollResults
  return rest
}

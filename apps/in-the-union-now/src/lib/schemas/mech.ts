import { z } from 'salvageunion-reference/zod'

import { CargoLotSchema } from './cargoLot'

/**
 * Per-item condition states for mech systems, modules, and pilot equipment.
 * Keyed by the item slug. When absent defaults to 'intact' at the display layer.
 */
export const ItemConditionSchema = z.enum(['intact', 'damaged', 'destroyed'])
export type ItemCondition = z.infer<typeof ItemConditionSchema>

/** Map from item slug → condition */
export const ItemConditionMapSchema = z.record(z.string(), ItemConditionSchema)
export type ItemConditionMap = z.infer<typeof ItemConditionMapSchema>

/**
 * Reactor Overload outcome categories (Core Book p.234-235). Distinct from the
 * raw d20 roll: maps the table band to a deterministic mech effect.
 * - meltdown: roll 1 — mech destroyed
 * - system-destroyed: roll 2-5 — player marks a System destroyed
 * - module-destroyed: roll 6-10 — player marks a Module destroyed
 * - overheat: roll 11-19 — shutdown + Vulnerable + SP damage = current Heat
 * - safe: roll 20 — no effect
 */
export const ReactorOverloadOutcomeSchema = z.enum([
  'meltdown',
  'system-destroyed',
  'module-destroyed',
  'overheat',
  'safe',
])
export type ReactorOverloadOutcome = z.infer<typeof ReactorOverloadOutcomeSchema>

/**
 * Recorded result of a Heat Check (and any subsequent Reactor Overload roll).
 * Snapshot-safe plain data stored on the mech so the sheet can render the last
 * outcome. `heatCheckRoll` is the d20 vs current Heat; `overloaded` is true when
 * that roll <= heat. `overloadRoll` / `outcome` are only present on an overload.
 */
export const HeatCheckResultSchema = z
  .object({
    heatCheckRoll: z.number().int().min(1).max(20),
    heatAtCheck: z.number().int().min(0),
    overloaded: z.boolean(),
    overloadRoll: z.number().int().min(1).max(20).optional(),
    outcome: ReactorOverloadOutcomeSchema.optional(),
    /** ISO timestamp of when this check was rolled. */
    rolledAt: z.string().datetime(),
  })
  .strict()
export type HeatCheckResult = z.infer<typeof HeatCheckResultSchema>

/**
 * Critical Damage Table outcome bands (Core Book p.239-240; mirrors the
 * "Critical Damage" entry in salvageunion-reference data/roll-tables.json).
 * Distinct from the raw d20 roll: maps the band to its deterministic effect.
 * - catastrophic: roll 1 — mech + all mounted Systems/Modules + Cargo destroyed;
 *   pilot dies unless they have a means to escape
 * - system-destruction: roll 2-5 — a System is destroyed (player marks which);
 *   chassis Damaged and inoperable until repaired
 * - module-destruction: roll 6-10 — a Module is destroyed (player marks which);
 *   chassis Damaged and inoperable until repaired
 * - core-damage: roll 11-19 — chassis Damaged and inoperable; pilot reduced to
 *   0 HP unless they can escape the mech
 * - miraculous-survival: roll 20 — mech Intact at 1 SP, fully operational
 */
export const CriticalDamageOutcomeSchema = z.enum([
  'catastrophic',
  'system-destruction',
  'module-destruction',
  'core-damage',
  'miraculous-survival',
])
export type CriticalDamageOutcome = z.infer<typeof CriticalDamageOutcomeSchema>

/**
 * Recorded result of a Critical Damage Table roll (rolled when the mech
 * reaches 0 SP). Snapshot-safe plain data stored on the mech so the sheet can
 * render the last outcome — same shape discipline as HeatCheckResult.
 */
export const CriticalDamageResultSchema = z
  .object({
    roll: z.number().int().min(1).max(20),
    outcome: CriticalDamageOutcomeSchema,
    /** ISO timestamp of when this result was rolled. */
    rolledAt: z.string().datetime(),
  })
  .strict()
export type CriticalDamageResult = z.infer<typeof CriticalDamageResultSchema>

/**
 * chassisRef / systems / modules store SLUG references into
 * salvageunion-reference (e.g. "ghost-chassis"), the same convention as pilot
 * `classRef` and encounter `refSlug`. The v6 IndexedDB migration
 * (lib/db/migrations/6-mech-refs-to-slugs.ts) rewrote legacy name-based refs;
 * resolution (lib/rules/resolveRefs.ts) stays tolerant of names/ids for
 * snapshots published by older clients. Resolution against game data is
 * handled at the rules/presentation layer.
 */
export const MechSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    /** Slug reference to a Chassis in salvageunion-reference */
    chassisRef: z.string(),
    /** Slugs of mech system items installed */
    systems: z.array(z.string()),
    /** Slugs of mech module items installed */
    modules: z.array(z.string()),
    /**
     * Cargo lots carried in the mech (design §2.12). Replaces the legacy
     * `cargo: string[]` field — the v3 IndexedDB migration
     * (lib/db/migrations/3-cargo-to-cargo-lots.ts) rewrites old records.
     */
    cargoLots: z.array(CargoLotSchema),
    /** Optional: name of the paint/visual pattern applied */
    patternName: z.string().optional(),
    /**
     * Freeform description / appearance / quirk notes. Additive-optional (no DB
     * migration — absent reads as undefined). Rendered on the mech sheet, edited
     * in the wizard.
     */
    description: z.string().optional(),
    /**
     * Active condition labels — the single unified conditions vocabulary for
     * the mech (Vulnerable, Prone, Immobile, Burn, Ion-locked, …). The
     * automation-written `shutdown`/`vulnerable`/`destroyed` boolean flags
     * below are reconciled into this vocabulary at read time via
     * `unifiedMechConditions()` in lib/rules/derivedStats.ts.
     */
    conditions: z.array(z.string()),
    // ---------------------------------------------------------------------------
    // Hand-edited maxima modifiers (plan 2.3, rules B2/B4/B6/B14).
    // Heat Sinks (+1 Max Heat each), Capacitance Banks (+2 Max EP each),
    // Composite Armour (±5 Max SP), cargo holds (+N Cargo Cap) and similar
    // passives are recorded here; derived maxima = chassis stat + modifier
    // (lib/rules/derivedStats.ts). Absent means 0.
    // ---------------------------------------------------------------------------
    /** Bonus/penalty to max Structure Points on top of the chassis value. */
    maxSpModifier: z.number().int().optional(),
    /** Bonus/penalty to max Energy Points on top of the chassis value. */
    maxEpModifier: z.number().int().optional(),
    /** Bonus/penalty to Heat Capacity on top of the chassis value. */
    maxHeatModifier: z.number().int().optional(),
    /** Bonus/penalty to Cargo Capacity on top of the chassis value. */
    maxCargoModifier: z.number().int().optional(),
    /** Optional: links this mech to a workspace */
    workspaceId: z.string().optional(),
    // ---------------------------------------------------------------------------
    // Live-play current stat tracking (Wave 6, #199).
    // These are current values for the active session — separate from the chassis
    // defaults shown in MechSheet. When absent the sheet falls back to chassis
    // defaults as the display value; when set they represent the mech's current
    // live state (damage taken, resources spent, etc.).
    // ---------------------------------------------------------------------------
    /** Current hull/structure points (falls back to chassis structurePoints) */
    currentHP: z.number().int().min(0).optional(),
    /** Current action points */
    currentAP: z.number().int().min(0).optional(),
    /** Current tech points */
    currentTP: z.number().int().min(0).optional(),
    /** Current structure points */
    currentSP: z.number().int().min(0).optional(),
    /** Current energy points (falls back to chassis energyPoints) */
    currentEP: z.number().int().min(0).optional(),
    /** Current heat level (falls back to chassis heatCapacity) */
    currentHeat: z.number().int().min(0).optional(),
    /**
     * Per-system condition map (REQ-011 #240). Keyed by system slug.
     * When absent or key missing, the display layer defaults to 'intact'.
     */
    systemConditions: ItemConditionMapSchema.optional(),
    /**
     * Per-module condition map (REQ-011 #240). Keyed by module slug.
     * When absent or key missing, the display layer defaults to 'intact'.
     */
    moduleConditions: ItemConditionMapSchema.optional(),
    /**
     * Per-installed-item Uses (X) counters covering BOTH systems and modules
     * (rules B13, trait glossary "Uses (X)"). Keyed by the installed item's
     * stable key — the item slug today, the loadout instance id once installed
     * items gain instance ids. Value = uses remaining. When absent or a key is
     * missing, the display layer falls back to the item's full Uses value.
     * All uses recharge after a week of Downtime.
     */
    itemUses: z.record(z.string(), z.number().int().min(0)).optional(),
    // ---------------------------------------------------------------------------
    // Heat Check / Reactor Overload live-play state (Slice C, #199).
    // Core Book p.233-235. All optional — absent means the mech is operating
    // normally and has not yet logged a Heat Check this session.
    // ---------------------------------------------------------------------------
    /**
     * Set true when a Reactor Overload result of 11-19 (reactor overheat) shuts
     * the mech down: it becomes Vulnerable and cannot act until restarted.
     */
    shutdown: z.boolean().optional(),
    /**
     * Set true when a result of 11-19 makes the mech Vulnerable, or by other
     * effects. Mirrors `shutdown` for an overheat but kept separate so a GM can
     * clear shutdown while leaving the mech Vulnerable.
     */
    vulnerable: z.boolean().optional(),
    /**
     * Set true on a catastrophic meltdown (Reactor Overload result of 1) — the
     * mech is destroyed.
     */
    destroyed: z.boolean().optional(),
    /**
     * The most recent Heat Check / Reactor Overload result, recorded so the
     * sheet can display it. Snapshot-safe (plain data).
     */
    lastHeatCheck: HeatCheckResultSchema.optional(),
    /**
     * The most recent Critical Damage Table result (rolled on reaching 0 SP —
     * design-review R-1). Additive optional field, snapshot-safe plain data.
     */
    lastCriticalDamage: CriticalDamageResultSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Mech = z.infer<typeof MechSchema>

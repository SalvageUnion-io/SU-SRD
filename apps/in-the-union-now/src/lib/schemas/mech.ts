import { z } from 'zod'

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
 * chassisRef: reference to a Chassis in salvageunion-reference by its `name`
 * (e.g. "Ghost Chassis"), matching how the builder stores it and how the rules
 * layer (lib/rules/capacity.ts) resolves it. Not a slug.
 * Resolution against game data is handled at the presentation/query layer.
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
    /** Slugs of cargo items carried in the mech */
    cargo: z.array(z.string()),
    /** Optional: name of the paint/visual pattern applied */
    patternName: z.string().optional(),
    /** Active condition slugs */
    conditions: z.array(z.string()),
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
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Mech = z.infer<typeof MechSchema>

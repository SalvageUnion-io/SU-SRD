import { z } from 'salvageunion-reference/zod'
import { CargoLotSchema } from './cargoLot'
import { containerFields } from './entity'
import { ItemConditionMapSchema } from './itemCondition'
import { PartnerInstanceSchema } from './partner'
import { photoFields } from './photo'

/**
 * chassisRef / systems / modules store SLUG references into
 * salvageunion-reference (e.g. "ghost-chassis"), the same convention as
 * encounter `refSlug`. They resolve through `salvageunion-reference/rules`
 * (`resolveChassisRef`, `resolveSystemRef`, `resolveModuleRef`) at the
 * rules/presentation layer.
 *
 * Optional fields read as their documented default when absent, so records
 * written before a field existed still parse.
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

    /** Cargo lots carried in the mech. */
    cargoLots: z.array(CargoLotSchema),

    /** Optional: name of the paint/visual pattern applied */
    patternName: z.string().optional(),

    /** Short freeform quirk note (the poster's "Quirk"). */
    quirk: z.string().optional(),

    /** Freeform appearance note (the poster's "Appearance"). */
    appearance: z.string().optional(),

    /** Freeform description of the build — what it is for and its story. */
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
    // Cap overrides — absolute pins (ADR-022 amendment, Free Edit only).
    //
    // When present the stat SHOWS this value and stops tracking its derivation.
    // The derived total is still computed underneath so the sheet can render an
    // "overridden from N" callout and offer a one-click revert; it is never
    // persisted. Clearing the field resumes derivation.
    // ---------------------------------------------------------------------------
    /** Absolute pinned max Structure Points. */
    maxSpOverride: z.number().int().nonnegative().optional(),

    /** Absolute pinned max Energy Points. */
    maxEpOverride: z.number().int().nonnegative().optional(),

    /** Absolute pinned Heat Capacity. */
    maxHeatOverride: z.number().int().nonnegative().optional(),

    /** Absolute pinned Cargo Capacity. */
    maxCargoOverride: z.number().int().nonnegative().optional(),

    ...containerFields,
    /** The entity's own picture; see `PhotoSchema`. */
    ...photoFields,

    /** Which built-in template row this was spawned from. See `PilotSchema.seedRef`. */
    seedRef: z.string().optional(),

    /**
     * The saved mech pattern this mech was built from — the pattern's id, which
     * is also its `/p/pattern/:id` address. Creation provenance
     * only: the mech's own name is its pattern name, and editing the loadout
     * never clears this. Counts toward the pattern page's "mechs built from it".
     */
    sourcePattern: z.string().optional(),

    // ---------------------------------------------------------------------------
    // Live-play current stat tracking.
    // These are current values for the active session — separate from the chassis
    // defaults shown in MechSheet. When absent the sheet falls back to chassis
    // defaults as the display value; when set they represent the mech's current
    // live state (damage taken, resources spent, etc.).
    // ---------------------------------------------------------------------------
    /** Current structure points */
    currentSP: z.number().int().min(0).optional(),

    /** Current energy points (falls back to chassis energyPoints) */
    currentEP: z.number().int().min(0).optional(),

    /** Current heat level (absent means 0; see resolveGauge) */
    currentHeat: z.number().int().min(0).optional(),

    /**
     * Statted Drones this mech's CHASSIS ability fields — Little Sestra's Sestra
     * Drone, Big Brother's four Big Brother Drones. Distinct from a pilot's
     * ability-granted partners: these belong to the machine, not its pilot, and
     * their tech level is fixed by the stat block rather than tracking the Union
     * Crawler. Absent reads as none.
     */
    partners: z.array(PartnerInstanceSchema).optional(),

    /**
     * Per-system condition map. Keyed by system slug.
     * When absent or key missing, the display layer defaults to 'intact'.
     */
    systemConditions: ItemConditionMapSchema.optional(),

    /**
     * Per-module condition map. Keyed by module slug.
     * When absent or key missing, the display layer defaults to 'intact'.
     */
    moduleConditions: ItemConditionMapSchema.optional(),

    /**
     * Per-installed-item Uses (X) counters covering BOTH systems and modules
     * (trait glossary "Uses (X)"). Keyed by the installed item's
     * stable key — the item slug today, the loadout instance id once installed
     * items gain instance ids. Value = uses remaining. When absent or a key is
     * missing, the display layer falls back to the item's full Uses value.
     * All uses recharge after a week of Downtime.
     */
    itemUses: z.record(z.string(), z.number().int().min(0)).optional(),

    // ---------------------------------------------------------------------------
    // Reactor Overload live-play state (Core Book p.233-235). All optional:
    // absent means the mech is operating normally.
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

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Mech = z.infer<typeof MechSchema>

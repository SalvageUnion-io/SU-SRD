/**
 * Partner — a statted Drone / Companion owned by a pilot or a mech.
 *
 * A Partner is any granted entity carrying a MECH-SHAPED stat block: energy and
 * heat alongside `systemSlots`/`moduleSlots`. The Core Book states the same
 * formula four separate times (Auto-Turret p. 29, Survey Drone p. 48, Mecha
 * Companion p. 68, Sestra Drone p. 128):
 *
 *   "…uses the same rules as Mechs for attaching Systems and Modules; taking
 *    damage and being repaired; as well as Heat and Heat Checks. Your [partner]
 *    cannot Push."
 *
 * so a partner is modelled as a mech minus Push, minus a chassis/pattern.
 *
 * TWO grant paths, which is why this schema is not simply a field on the pilot:
 *
 *   - PILOT-granted, from a pilot ability's `grants` → an `equipment` record
 *     with slots (Auto-Turret, Survey Drone, Mecha Companion).
 *   - MECH-granted, from a chassis ability's `drone` field → a `drones` record
 *     (Sestra Drone via Little Sestra, Big Brother Drone via Big Brother).
 *
 * `hostSchema` is what lets one shape serve both — and it is load-bearing
 * beyond taste: "Survey Drone" exists in BOTH `equipment.json` (the player's
 * partner, SP 2 / EP 4 / 3 sys) and `drones.json` (an opposition stat block,
 * SP 1 and nothing else). Resolving `hostRef` without it picks the wrong record.
 *
 * OWNERSHIP IS INTRINSIC. A partner lives in an array on its host rather than in
 * its own store, so deleting a pilot or mech removes its partners with no orphan
 * cleanup, and it rides through snapshots and export bundles with that host. A
 * partner has no independent existence — it is granted by an ability and cannot
 * outlive the thing that grants it. This is also why partners get no index
 * route: they are not roster citizens.
 *
 * Superseded [ADR-023](../../../../docs/adrs/ADR-023-drone-equipment-installed-loadout.md),
 * whose `Pilot.equipmentLoadouts` was keyed by equipment SLUG. That collapsed
 * multiples of one partner into a single shared entry — a live bug, because
 * Mecha Packmaster grants TWO Mecha Companions and Big Brother's DronTek pattern
 * fields FOUR drones. Every partner here carries its own `id`.
 */

import { z } from 'salvageunion-reference/zod'

import { CargoLotSchema } from './cargoLot'
import { ItemConditionMapSchema } from './itemCondition'

/**
 * Which reference file `hostRef` resolves against. See the "Survey Drone exists
 * in both" note above — this is a disambiguator, not a convenience.
 */
export const PartnerHostSchemaSchema = z.enum(['equipment', 'drones'])
export type PartnerHostSchema = z.infer<typeof PartnerHostSchemaSchema>

export const PartnerInstanceSchema = z
  .object({
    /**
     * Globally unique across every host. Partners are addressed by a flat
     * `{ type: 'partner', id }` ref resolved by scanning pilots and mechs, so
     * this cannot be scoped per-host.
     */
    id: z.string(),

    /** Slug of the `equipment` / `drones` record supplying this partner's stats. */
    hostRef: z.string(),

    /** Which file `hostRef` resolves against. */
    hostSchema: PartnerHostSchemaSchema,

    /**
     * This instance's name. For mech-granted partners a pattern may supply it
     * ("Shield Drone" over the Big Brother Drone stat block); for pilot-granted
     * ones it is the player's own ("Custos"). Absent falls back to the stat
     * block's name at render time.
     */
    name: z.string().optional(),

    /** Free-text appearance (Mecha Companion offers this as a choice). */
    appearance: z.string().optional(),

    /** A.I. Personality — rolled on the table (p. 91) or chosen. */
    aiPersonality: z.string().optional(),

    /**
     * Manual override of the DERIVED tech level. Normally absent: tech level is
     * computed, and the rule differs by grant path — see `partnerTechLevel` in
     * lib/rules/partnerStats.ts. This exists only because the Live Sheet is a
     * Free-Edit surface (ADR-021).
     */
    techLevelOverride: z.number().int().min(1).max(6).optional(),

    /** Current structure points. Absent reads as the derived maximum. */
    currentSP: z.number().int().min(0).optional(),

    /** Current energy points. Absent reads as the derived maximum. */
    currentEP: z.number().int().min(0).optional(),

    /** Current heat. Absent reads as 0. */
    currentHeat: z.number().int().min(0).optional(),

    /** Installed system slugs (same convention as mech.systems). */
    systems: z.array(z.string()).default([]),

    /** Installed module slugs (same convention as mech.modules). */
    modules: z.array(z.string()).default([]),

    /** Per-installed-system condition (slug → Intact/Damaged/Destroyed). */
    systemConditions: ItemConditionMapSchema.optional(),

    /** Per-installed-module condition (slug → Intact/Damaged/Destroyed). */
    moduleConditions: ItemConditionMapSchema.optional(),

    /** Uses remaining per installed item slug (absent = full, rules B13). */
    itemUses: z.record(z.string(), z.number().int().min(0)).optional(),

    /** Partner-level conditions, mirroring mech.conditions. */
    conditions: z.array(z.string()).default([]),

    /**
     * This partner's own cargo hold. Partners are first-class nodes in the cargo
     * graph, not leaves: the Load action reads "onto your Mech or an allied
     * Mech", and a partner uses the mech rules. Survey Drone carries 1, Mecha
     * Companion 3, Sestra Drone 3; Auto-Turret carries 0 and is Immobile, so its
     * hold is structurally absent rather than an empty container.
     */
    cargoLots: z.array(CargoLotSchema).optional(),
  })
  .strict()

export type PartnerInstance = z.infer<typeof PartnerInstanceSchema>

/**
 * Structural type aliases for the rules module.
 *
 * These types describe the SHAPE of entities that the rule utilities consume.
 * They are intentionally defined here as plain structural types (not imported
 * from any app's Zod schemas) so this module has no dependency on any
 * consumer app — ADR-006 (pure rules logic lives in this package). A
 * consumer's Zod-inferred types (e.g. ITUN's `src/lib/schemas/`) satisfy
 * these structural shapes automatically (TypeScript's structural type system
 * ensures compatibility at call sites); this module never imports them back.
 *
 * (Migrated from ITUN's `src/lib/rules/types.ts` — see ADR-006. Originally
 * authored with exactly this file-disjoint intent, anticipating this move.)
 */

/**
 * Tech level — matches salvageunion-reference's `TechLevelSchema`: the numeric
 * tiers 1–6 plus the two non-numeric equipment tiers 'B' (Bio) and 'N' (Nanite).
 * Per the Core Book "TECH LEVELS" box (p.3), TECH 6 covers "BIO AND NANITE TECH";
 * Bio/Nanite systems & modules exist in the catalog and must be selectable.
 */
export type TechLevel = 1 | 2 | 3 | 4 | 5 | 6 | 'B' | 'N'

/**
 * A system installed on a mech, identified by a name reference into the
 * `salvageunion-reference` Systems dataset.
 *
 * `slotCost` may be explicitly overridden (e.g. by a chassis ability). When
 * absent the utility looks up the canonical `slotsRequired` from the dataset.
 */
export type MechSystemSlot = {
  /** Name reference — must match a system name in salvageunion-reference */
  ref: string
  /** Override for slot cost; defaults to the reference data's slotsRequired */
  slotCost?: number
}

/**
 * A module installed on a mech, identified by a name reference into the
 * `salvageunion-reference` Modules dataset.
 */
export type MechModuleSlot = {
  /** Name reference — must match a module name in salvageunion-reference */
  ref: string
  /** Override for slot cost; defaults to the reference data's slotsRequired */
  slotCost?: number
}

/**
 * Minimal mech shape consumed by `computeMechCapacity`.
 * The `chassisRef` must match a chassis name in salvageunion-reference.
 */
export type MechInput = {
  chassisRef: string
  systems: MechSystemSlot[]
  modules: MechModuleSlot[]
}

/**
 * Discriminated union of capacity violations.
 */
export type CapacityViolation =
  | {
      kind: 'system-over-slots'
      message: string
      details: { used: number; max: number }
    }
  | {
      kind: 'module-over-slots'
      message: string
      details: { used: number; max: number }
    }
  | {
      kind: 'system-requires-chassis'
      message: string
      details: { systemRef: string; requiredChassis: string }
    }
  | {
      kind: 'chassis-not-found'
      message: string
      details: { chassisRef: string }
    }

/**
 * Result of `computeMechCapacity`.
 */
export type MechCapacityResult = {
  systemSlotsUsed: number
  systemSlotsMax: number
  moduleSlotsUsed: number
  moduleSlotsMax: number
  violations: CapacityViolation[]
}

/**
 * A reference-linked cargo item (resolved from salvageunion-reference).
 */
export type CargoItemRef = {
  kind: 'ref'
  /** Name of the equipment/system in salvageunion-reference */
  ref: string
  /** Explicit slot count override (optional; falls back to the dataset value) */
  slotCount?: number
}

/**
 * A custom (player-entered) cargo item with no SRD reference.
 */
export type CargoItemCustom = {
  kind: 'custom'
  name: string
  slotCount: number
}

export type CargoItem = CargoItemRef | CargoItemCustom

/**
 * Minimal parent shape for a cargo-carrying entity.
 * `cargoCapacity` is the maximum cargo slots.
 *
 * NOTE: `computeCargoCapacity`, the function these cargo types were written
 * for, was deleted as dead code — it had no production consumer. The types
 * survive only because ITUN's ADR-006 shim re-exports them, which is what
 * keeps knip quiet about them. They are candidates for removal.
 */
export type CargoParent = {
  cargoCapacity: number
}

/**
 * Discriminated union of cargo violations.
 */
export type CargoViolation =
  | {
      kind: 'over-capacity'
      message: string
      details: { used: number; max: number }
    }
  | { kind: 'missing-ref'; message: string; details: { ref: string } }

/**
 * Shape a cargo-capacity calculation returns: slots used, slots available,
 * and any violations. See the note on `CargoParent` — the function that
 * produced this was deleted as dead code.
 */
export type CargoCapacityResult = {
  used: number
  max: number
  violations: CargoViolation[]
}

/**
 * Minimal item shape consumed by `salvageValueFor` / `scrapCostFor`.
 * Any SU entity with a salvageValue and techLevel satisfies this.
 */
export type ScrapableItem = {
  salvageValue: number
  techLevel: TechLevel
}

/**
 * Severity of a soft warning.
 */
export type SoftWarningSeverity = 'info' | 'warn'

/**
 * A non-blocking rule violation surfaced at save time.
 *
 * Soft warnings do not prevent saving. The user sees them in a
 * confirm-and-proceed dialog and may dismiss them.
 */
export type SoftWarning = {
  code: string
  message: string
  severity: SoftWarningSeverity
}

/**
 * Tier of an ability tree (advancement rules, plan S5):
 * - core: a class's three core trees (Salvager: any core tree)
 * - advanced: an Advanced/Hybrid specialisation tree (2 TP, gated on 6 core)
 * - legendary: a Legendary tree (3 TP, gated on 6 core + 3 advanced; max one)
 */
export type AbilityTier = 'core' | 'advanced' | 'legendary'

/**
 * Minimal ability shape for soft-warning checks. `tree`/`level`/`tier` are
 * resolved from salvageunion-reference by `enrichPilotSnapshot`; checks that
 * need them no-op when they are absent (un-enriched snapshots).
 */
export type AbilityInput = {
  ref: string
  /** Display name for warning messages (defaults to ref). */
  name?: string
  /** Ability tree this ability belongs to, if known. */
  tree?: string
  /** Tree level (1–3 numeric; 'L' legendary, 'G' general), if known. */
  level?: number | 'L' | 'G'
  /** Tier classification of the ability's tree, if known. */
  tier?: AbilityTier
}

/**
 * Minimal pilot shape consumed by `evaluateSoftWarnings`.
 */
export type PilotSnapshot = {
  abilities: AbilityInput[]
  /**
   * True when the pilot's class is Salvager — raises the ability soft cap
   * from 10 to 12 (Core trees only, per the core rules).
   */
  isSalvager?: boolean
  /**
   * The class's own ability cap, read from the dataset.
   *
   * Preferred over the `PILOT_ABILITY_CAP` / `SALVAGER_ABILITY_CAP` constants,
   * which duplicate values the class records already carry — every class record
   * now states its own `maxAbilities`, so the cap is data rather than a
   * hardcoded pair plus a name-string test. The constants remain the fallback
   * for a snapshot built without a resolvable class.
   */
  maxAbilities?: number
  /**
   * 'base' for the six core classes; 'advanced-hybrid' for an Advanced or
   * Hybrid specialisation class. Undefined when unresolvable.
   */
  classTier?: 'base' | 'advanced-hybrid'
  /** Class display name for warning messages, if known. */
  className?: string
}

/**
 * Minimal system shape for soft-warning dependency checks.
 */
export type SystemSnapshot = {
  ref: string
  /** Other system refs this system depends on (if known) */
  requires?: string[]
}

/**
 * Minimal mech shape consumed by `evaluateSoftWarnings`.
 */
export type MechSnapshot = {
  techLevel?: TechLevel
  systems: SystemSnapshot[]
}

/**
 * Context object passed to `evaluateSoftWarnings`.
 * Describes what was changed and who is being saved.
 */
export type SoftWarningContext = {
  /** Type of entity being saved */
  entityType: 'pilot' | 'mech' | 'crawler'
  /** Is this a downgrade in tech level? */
  techLevelDowngraded?: boolean
  /**
   * If a scrap refund was expected but not issued on TL downgrade.
   * Set to true when the edit skips the refund step.
   */
  scrapRefundSkipped?: boolean
}

/**
 * Before/after snapshot pair consumed by `evaluateSoftWarnings`.
 */
export type EditSnapshot<T> = {
  before: T
  after: T
}

// ---------------------------------------------------------------------------
// Heat Check / Reactor Overload structural types (moved with heatCheck.ts's
// pure functions; see ./heatCheck.ts). These are "small outcome/result
// record shapes, not full persisted records" (ADR-006) — a consumer's
// Zod-inferred equivalents (e.g. ITUN's HeatCheckResultSchema /
// ReactorOverloadOutcomeSchema in src/lib/schemas/mech.ts) satisfy them
// structurally. The union literals are kept byte-identical to ITUN's Zod
// enums so a drift fails typecheck rather than silently diverging.
// ---------------------------------------------------------------------------

/** A function that returns an integer die roll in [1, sides]. Injectable. */
export type Roll = (sides: number) => number

/**
 * Reactor Overload outcome categories (Core Book p.234-235).
 *   1     → meltdown
 *   2-5   → system-destroyed
 *   6-10  → module-destroyed
 *   11-19 → overheat
 *   20    → safe
 */
export type ReactorOverloadOutcome =
  | 'meltdown'
  | 'system-destroyed'
  | 'module-destroyed'
  | 'overheat'
  | 'safe'

/**
 * Recorded result of a Heat Check (and any subsequent Reactor Overload roll).
 * Snapshot-safe plain data a consumer stores on the mech so the sheet can
 * render the last outcome.
 */
export type HeatCheckResult = {
  heatCheckRoll: number
  heatAtCheck: number
  overloaded: boolean
  overloadRoll?: number
  outcome?: ReactorOverloadOutcome
  /** ISO timestamp of when this check was rolled. */
  rolledAt: string
}

/**
 * The deterministic state changes a Heat Check produces. The caller applies
 * these as a patch to the mech. `requiresPlayerChoice` is true for the 2-5 /
 * 6-10 bands, signalling the UI to prompt the player to mark a System/Module
 * (this module never auto-picks one).
 */
export type HeatCheckEffect = {
  /** The recorded result for display + persistence. */
  result: HeatCheckResult
  /** New SP after applying overheat damage (only changes on 11-19). */
  nextSP: number
  /** True when the mech shuts down (11-19). */
  shutdown: boolean
  /** True when the mech becomes Vulnerable (11-19). */
  vulnerable: boolean
  /** True when the mech is destroyed (meltdown, roll 1). */
  destroyed: boolean
  /** True when the player must pick a System/Module to mark destroyed (2-5 / 6-10). */
  requiresPlayerChoice: boolean
}

export type PushResult = {
  /** Heat after +2 (clamped to cap), before any overheat SP damage. */
  nextHeat: number
  /** The Heat Check performed at the new heat. */
  effect: HeatCheckEffect
}

// ---------------------------------------------------------------------------
// Take Damage / Critical Damage / Critical Injury structural types (moved
// with takeDamage.ts). Same discipline as HeatCheckResult above.
// ---------------------------------------------------------------------------

/**
 * Critical Damage Table outcome bands (Core Book p.239-240).
 *   1     → catastrophic
 *   2-5   → system-destruction
 *   6-10  → module-destruction
 *   11-19 → core-damage
 *   20    → miraculous-survival
 */
export type CriticalDamageOutcome =
  | 'catastrophic'
  | 'system-destruction'
  | 'module-destruction'
  | 'core-damage'
  | 'miraculous-survival'

/** Recorded result of a Critical Damage Table roll. */
export type CriticalDamageResult = {
  roll: number
  outcome: CriticalDamageOutcome
  /** ISO timestamp of when this result was rolled. */
  rolledAt: string
}

/**
 * Critical Injury Table outcome bands (Core Book p.241).
 *   1     → fatal
 *   2-5   → major-injury
 *   6-10  → minor-injury
 *   11-19 → unconscious
 *   20    → miraculous-survival
 */
export type CriticalInjuryOutcome =
  | 'fatal'
  | 'major-injury'
  | 'minor-injury'
  | 'unconscious'
  | 'miraculous-survival'

/** Recorded result of a Critical Injury Table roll. */
export type CriticalInjuryResult = {
  roll: number
  outcome: CriticalInjuryOutcome
  /** ISO timestamp of when this result was rolled. */
  rolledAt: string
}

// ---------------------------------------------------------------------------
// Mediator table structural types (moved with mediatorTables.ts).
// ---------------------------------------------------------------------------

/** The three Mediator tables the tray can roll (Workshop Manual p.268). */
export type MediatorTableId = 'reaction' | 'morale' | 'retreat'

/**
 * Recorded result of a Mediator table roll (Reaction / Morale / Retreat).
 * Snapshot-safe plain data — same shape discipline as HeatCheckResult.
 */
export type MediatorRollResult = {
  table: MediatorTableId
  roll: number
  /** Band label from the table entry (e.g. 'Friendly'), when present. */
  label?: string
  /** Full outcome text from the table entry. */
  value: string
  /** ISO timestamp of when this result was rolled. */
  rolledAt: string
}

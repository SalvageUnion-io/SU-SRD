/**
 * Structural type aliases for the rules module.
 *
 * These types describe the SHAPE of entities that the rule utilities consume.
 * They are intentionally defined here (not imported from cycle-1 schemas or
 * salvageunion-reference) so that this module is file-disjoint from the
 * schemas and db modules that cycle-1 owns.
 *
 * When Wave 2 wires up Zustand stores, the actual Pilot/Mech/Crawler types
 * produced by the Zod schemas in `src/lib/schemas/` will satisfy these
 * structural shapes automatically (TypeScript's structural type system
 * ensures compatibility at call sites).
 */

/**
 * Tech level — 1 through 6 as defined in salvageunion-reference tech-levels.json.
 */
export type TechLevel = 1 | 2 | 3 | 4 | 5 | 6

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
 * Minimal parent shape consumed by `computeCargoCapacity`.
 * `cargoCapacity` is the maximum cargo slots.
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
 * Result of `computeCargoCapacity`.
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
 * Crawler tech-level upgrade context (SRD p.218). Describes a pending
 * upgrade so the rule layer can surface advisory warnings before the player
 * confirms the spend. All checks are non-blocking (ADR-007).
 */
export type CrawlerUpgradeContext = {
  /** Crawler's current tech level (before the upgrade). */
  fromTL: TechLevel
  /** Tech level the player is stepping to. */
  toTL: TechLevel
  /**
   * Cost in scrap to perform the upgrade (30× the current TL's scrap per the
   * SRD), or null when the cost cannot be determined (e.g. already at TL6).
   */
  cost: number | null
  /**
   * Scrap currently available to cover the cost — the Upgrade Pool plus any
   * scrap-pool buckets at the current TL or higher (TL+ scrap is allowed).
   */
  available: number
  /** Number of damaged crawler bays that will be repaired by the upgrade. */
  damagedBayCount: number
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
  /**
   * Pending crawler tech-level upgrade (SRD p.218). When present, the crawler
   * evaluator surfaces advisory upgrade warnings (TL cap, short pool) and an
   * informational note that damaged bays are repaired by the upgrade.
   */
  crawlerUpgrade?: CrawlerUpgradeContext
}

/**
 * Before/after snapshot pair consumed by `evaluateSoftWarnings`.
 */
export type EditSnapshot<T> = {
  before: T
  after: T
}

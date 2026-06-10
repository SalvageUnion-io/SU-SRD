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
 * Minimal ability shape for soft-warning checks.
 */
export type AbilityInput = {
  ref: string
  /** Minimum pilot level required, if known (optional) */
  minLevel?: number
}

/**
 * Minimal pilot shape consumed by `evaluateSoftWarnings`.
 */
export type PilotSnapshot = {
  level: number
  abilities: AbilityInput[]
  /**
   * True when the pilot's class is Salvager — raises the ability soft cap
   * from 10 to 12 (Core trees only, per the core rules).
   */
  isSalvager?: boolean
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

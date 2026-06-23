/**
 * Soft-warning rule evaluation (REQ-012).
 *
 * Soft warnings are non-blocking rule violations surfaced at save time. The
 * user sees them in a confirm-and-proceed dialog and may dismiss them. They do
 * not prevent saving — they inform and protect against common mistakes.
 *
 * This module is intentionally kept to documented cases only. Additional
 * warning rules belong in M4 story #225 (REQ-NF-21).
 *
 * All functions are pure — no side effects, no async, no React.
 */

import type {
  AbilityInput,
  AbilityTier,
  EditSnapshot,
  MechSnapshot,
  PilotSnapshot,
  SoftWarning,
  SoftWarningContext,
} from './types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function warn(code: string, message: string): SoftWarning {
  return { code, message, severity: 'warn' }
}

function info(code: string, message: string): SoftWarning {
  return { code, message, severity: 'info' }
}

// ---------------------------------------------------------------------------
// Pilot warning checks (advancement prerequisites, plan S5 / 3.3–3.4)
//
// All checks are tier/tree-driven and evaluate the AFTER state — they need an
// enriched snapshot (enrichPilotSnapshot resolves tree/level/tier from
// salvageunion-reference). Un-enriched abilities (no tree/tier) are skipped,
// so raw string[]-shaped callers degrade to "no warnings", never to noise.
// ---------------------------------------------------------------------------

function abilityLabel(a: AbilityInput): string {
  return a.name ?? a.ref
}

/** Count of abilities in the given tier. */
function tierCount(abilities: AbilityInput[], tier: AbilityTier): number {
  return abilities.filter((a) => a.tier === tier).length
}

/** True when at least one core tree has 3+ selected abilities (a complete tree). */
function hasCompleteCoreTree(abilities: AbilityInput[]): boolean {
  const perTree = new Map<string, number>()
  for (const a of abilities) {
    if (a.tier !== 'core' || a.tree === undefined) continue
    perTree.set(a.tree, (perTree.get(a.tree) ?? 0) + 1)
  }
  return [...perTree.values()].some((n) => n >= 3)
}

/**
 * Core trees are taken in order: an ability at numeric level n requires every
 * lower level of the same tree. Applies to any tree with numeric levels
 * (core AND advanced trees both run 1→3).
 */
function checkTreeOrder(after: PilotSnapshot): SoftWarning[] {
  const warnings: SoftWarning[] = []
  const levelsByTree = new Map<string, Set<number>>()
  for (const a of after.abilities) {
    if (a.tree === undefined || typeof a.level !== 'number') continue
    const set = levelsByTree.get(a.tree) ?? new Set<number>()
    set.add(a.level)
    levelsByTree.set(a.tree, set)
  }
  for (const a of after.abilities) {
    if (a.tree === undefined || typeof a.level !== 'number' || a.level <= 1) continue
    const taken = levelsByTree.get(a.tree)
    const missing: number[] = []
    for (let lvl = 1; lvl < a.level; lvl++) {
      if (!taken?.has(lvl)) missing.push(lvl)
    }
    if (missing.length > 0) {
      warnings.push(
        warn(
          'ABILITY_TREE_ORDER',
          `"${abilityLabel(a)}" is level ${a.level} in the ${a.tree} tree, but level ` +
            `${missing.join(' and ')} of that tree ${missing.length === 1 ? "hasn't" : "haven't"} ` +
            `been taken — trees are taken in order.`
        )
      )
    }
  }
  return warnings
}

/**
 * Advanced/Hybrid abilities require 6 Core abilities including a complete
 * core tree (rules: "6 Core abilities incl. all 3 in the linked tree").
 */
function checkAdvancedGate(after: PilotSnapshot): SoftWarning[] {
  const advanced = after.abilities.filter((a) => a.tier === 'advanced')
  if (advanced.length === 0) return []
  const coreCount = tierCount(after.abilities, 'core')
  if (coreCount >= 6 && hasCompleteCoreTree(after.abilities)) return []
  const first = advanced[0]!
  return [
    warn(
      'ADVANCED_ABILITY_PREREQUISITE',
      `"${abilityLabel(first)}" is an Advanced/Hybrid ability — it normally requires ` +
        `6 Core abilities including a complete core tree (this pilot has ${coreCount}).`
    ),
  ]
}

/** Legendary abilities require 6 Core + 3 Advanced/Hybrid abilities. */
function checkLegendaryGate(after: PilotSnapshot): SoftWarning[] {
  const legendary = after.abilities.filter((a) => a.tier === 'legendary')
  if (legendary.length === 0) return []
  const warnings: SoftWarning[] = []
  const coreCount = tierCount(after.abilities, 'core')
  const advancedCount = tierCount(after.abilities, 'advanced')
  if (coreCount < 6 || advancedCount < 3) {
    warnings.push(
      warn(
        'LEGENDARY_ABILITY_PREREQUISITE',
        `"${abilityLabel(legendary[0]!)}" is a Legendary ability — it normally requires ` +
          `6 Core and 3 Advanced/Hybrid abilities (this pilot has ${coreCount} core, ` +
          `${advancedCount} advanced).`
      )
    )
  }
  if (legendary.length > 1) {
    warnings.push(
      warn(
        'ONE_LEGENDARY_LIMIT',
        `This pilot has ${legendary.length} Legendary abilities; the rules allow at most one — ever.`
      )
    )
  }
  return warnings
}

/**
 * Switching to an Advanced/Hybrid specialisation class normally requires the
 * 6-core gate. Only warns when the class CHANGED to advanced-hybrid in this
 * edit — an already-specialised pilot is not nagged on every save.
 */
function checkClassPrerequisite(before: PilotSnapshot, after: PilotSnapshot): SoftWarning[] {
  if (after.classTier !== 'advanced-hybrid') return []
  if (before.classTier === 'advanced-hybrid') return []
  const coreCount = tierCount(after.abilities, 'core')
  if (coreCount >= 6 && hasCompleteCoreTree(after.abilities)) return []
  return [
    warn(
      'CLASS_PREREQUISITE',
      `${after.className ?? 'This specialisation'} is an Advanced/Hybrid class — it normally ` +
        `requires 6 Core abilities including a complete core tree (this pilot has ${coreCount}).`
    ),
  ]
}

/**
 * The pilot ability soft cap (plan 2.2): 10 abilities, 12 for Salvager.
 * The schema no longer caps the array — exceeding the rules cap is a soft
 * warning, never a parse failure or a blocked save.
 */
export const PILOT_ABILITY_CAP = 10
export const SALVAGER_ABILITY_CAP = 12

/**
 * Warn when a pilot's ability count exceeds the rules cap
 * (10, or 12 for Salvager — Core trees only).
 */
function checkAbilityCountCap(after: PilotSnapshot): SoftWarning[] {
  const cap = after.isSalvager ? SALVAGER_ABILITY_CAP : PILOT_ABILITY_CAP
  if (after.abilities.length <= cap) return []
  return [
    warn(
      'PILOT_ABILITY_CAP_EXCEEDED',
      `This pilot has ${after.abilities.length} abilities; the rules cap is ${cap}` +
        `${after.isSalvager ? ' (Salvager)' : ''}.`
    ),
  ]
}

// ---------------------------------------------------------------------------
// Mech warning checks
// ---------------------------------------------------------------------------

/**
 * Warn when a system that another system depends on is being removed.
 *
 * Dependency information comes from the `requires` field on `SystemSnapshot`.
 * If system A requires system B, removing B while A is still installed is a
 * soft warning (not a hard block — house rules and edge cases exist).
 */
function checkSystemDependencies(before: MechSnapshot, after: MechSnapshot): SoftWarning[] {
  const warnings: SoftWarning[] = []

  const afterRefs = new Set(after.systems.map((s) => s.ref))
  const removedRefs = new Set(before.systems.filter((s) => !afterRefs.has(s.ref)).map((s) => s.ref))

  if (removedRefs.size === 0) return warnings

  for (const remaining of after.systems) {
    if (!remaining.requires) continue
    for (const dep of remaining.requires) {
      if (removedRefs.has(dep)) {
        warnings.push(
          warn(
            'SYSTEM_DEPENDENCY_REMOVED',
            `"${remaining.ref}" depends on "${dep}", which was removed from this mech.`
          )
        )
      }
    }
  }

  return warnings
}

/**
 * Warn when a tech level is being downgraded without a scrap refund recorded.
 *
 * SRD downgrade rules are intentionally permissive (soft), but the application
 * should alert the player that they may be entitled to a scrap refund.
 */
function checkTechLevelDowngrade(context: SoftWarningContext): SoftWarning[] {
  if (!context.techLevelDowngraded) return []

  const warnings: SoftWarning[] = [
    warn(
      'TECH_LEVEL_DOWNGRADE',
      'Tech level is being reduced. Per the rules, a scrap refund may be applicable.'
    ),
  ]

  if (context.scrapRefundSkipped) {
    warnings.push(
      warn(
        'TECH_LEVEL_DOWNGRADE_NO_REFUND',
        'Downgrading tech level without issuing a scrap refund. Confirm this is intentional.'
      )
    )
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Crawler upgrade checks (SRD p.218, M4)
//
// Upgrading a Union Crawler costs 30× the crawler's CURRENT Tech Level in Scrap,
// paid out of the Upgrade Pool (which voluntary scrap may top up). All checks
// are advisory — the player always confirms and proceeds (ADR-007):
//   - TL6 (Megacity) is the cap and cannot be upgraded further.
//   - The Upgrade Pool / scrap may be short of the cost.
//   - Damaged bays are repaired by the upgrade (informational, SRD p.219).
// Downgrades are handled by the shared TECH_LEVEL_DOWNGRADE check.
// ---------------------------------------------------------------------------

function checkCrawlerUpgrade(context: SoftWarningContext): SoftWarning[] {
  const upgrade = context.crawlerUpgrade
  if (!upgrade) return []
  // Downgrades route to checkTechLevelDowngrade, not here.
  if (upgrade.toTL <= upgrade.fromTL) return []

  const warnings: SoftWarning[] = []

  // TL6 is the cap — cost is null because there is no next level.
  if (upgrade.fromTL >= 6 || upgrade.cost === null) {
    warnings.push(
      warn(
        'CRAWLER_TL_MAX',
        'Tech 6 (Megacity) is the highest Union Crawler Tech Level and cannot be upgraded further.'
      )
    )
    return warnings
  }

  if (upgrade.available < upgrade.cost) {
    warnings.push(
      warn(
        'CRAWLER_UPGRADE_POOL_SHORT',
        `Upgrading to Tech ${upgrade.toTL} costs ${upgrade.cost} Tech-${upgrade.fromTL} Scrap, ` +
          `but only ${upgrade.available} Scrap (Upgrade Pool + Tech ${upgrade.fromTL}+ buckets) ` +
          `is available — ${upgrade.cost - upgrade.available} short. Upgrading anyway is the table's call.`
      )
    )
  }

  if (upgrade.damagedBayCount > 0) {
    warnings.push(
      info(
        'CRAWLER_BAYS_REPAIRED',
        `${upgrade.damagedBayCount} damaged ${
          upgrade.damagedBayCount === 1 ? 'bay' : 'bays'
        } will be repaired to Intact during the upgrade (SRD p.219).`
      )
    )
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate soft warnings for a pilot edit.
 *
 * Documented cases (all advisory, never blocking — plan 3.3/3.4):
 * - Tree order violated (level n taken without the levels below it)
 * - Advanced/Hybrid ability without the 6-core gate
 * - Legendary ability without 6 core + 3 advanced; more than one Legendary
 * - Class switched to Advanced/Hybrid without the 6-core gate
 * - Ability count beyond the rules cap (10 / Salvager 12)
 *
 * Returns an empty array when no warnings apply.
 */
export function evaluatePilotWarnings(
  snapshot: EditSnapshot<PilotSnapshot>,
  context: SoftWarningContext
): SoftWarning[] {
  const warnings: SoftWarning[] = []
  warnings.push(...checkTreeOrder(snapshot.after))
  warnings.push(...checkAdvancedGate(snapshot.after))
  warnings.push(...checkLegendaryGate(snapshot.after))
  warnings.push(...checkClassPrerequisite(snapshot.before, snapshot.after))
  warnings.push(...checkAbilityCountCap(snapshot.after))
  warnings.push(...checkTechLevelDowngrade(context))
  return warnings
}

/**
 * Evaluate soft warnings for a mech edit.
 *
 * Documented cases:
 * - A system that another system depends on is being removed
 * - Tech level is being downgraded (optionally: without a scrap refund)
 *
 * Returns an empty array when no warnings apply.
 */
export function evaluateMechWarnings(
  snapshot: EditSnapshot<MechSnapshot>,
  context: SoftWarningContext
): SoftWarning[] {
  const warnings: SoftWarning[] = []
  warnings.push(...checkSystemDependencies(snapshot.before, snapshot.after))
  warnings.push(...checkTechLevelDowngrade(context))
  return warnings
}

/**
 * Evaluate soft warnings for a crawler edit (SRD p.218–219).
 *
 * Documented cases (all advisory, never blocking — ADR-007):
 * - Tech level is being downgraded (shared TECH_LEVEL_DOWNGRADE check)
 * - A pending tech-level upgrade hits the TL6 cap
 * - A pending upgrade's cost exceeds the available Upgrade Pool / scrap
 * - Informational: damaged bays will be repaired by the upgrade
 *
 * Returns an empty array when no warnings apply.
 */
export function evaluateCrawlerWarnings(context: SoftWarningContext): SoftWarning[] {
  const warnings: SoftWarning[] = []
  warnings.push(...checkTechLevelDowngrade(context))
  warnings.push(...checkCrawlerUpgrade(context))
  return warnings
}

/**
 * Unified entry point for soft-warning evaluation.
 *
 * Dispatches to the appropriate entity-specific evaluator based on
 * `context.entityType`. For 'pilot', `before`/`after` must be `PilotSnapshot`.
 * For 'mech', they must be `MechSnapshot`. For 'crawler', the tech-level
 * downgrade check and the pending-upgrade checks apply (SRD p.218–219); pass
 * the upgrade details in `context.crawlerUpgrade`.
 *
 * When `entityType` is 'crawler', pass any object satisfying `MechSnapshot`
 * (the snapshots are unused — crawler warnings derive from `context`).
 *
 * Returns an empty array when no warnings apply.
 */
export function evaluateSoftWarnings(
  before: PilotSnapshot | MechSnapshot,
  after: PilotSnapshot | MechSnapshot,
  context: SoftWarningContext
): SoftWarning[] {
  const snapshot = { before, after }

  switch (context.entityType) {
    case 'pilot':
      return evaluatePilotWarnings(snapshot as EditSnapshot<PilotSnapshot>, context)
    case 'mech':
      return evaluateMechWarnings(snapshot as EditSnapshot<MechSnapshot>, context)
    case 'crawler':
      return evaluateCrawlerWarnings(context)
    default: {
      // Exhaustiveness guard — TypeScript will catch this at compile time if
      // a new entityType is added without a corresponding case.
      const _unreachable: never = context.entityType
      return _unreachable
    }
  }
}

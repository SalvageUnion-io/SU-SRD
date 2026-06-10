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

// ---------------------------------------------------------------------------
// Pilot warning checks
// ---------------------------------------------------------------------------

/**
 * Warn when a pilot has an ability whose `minLevel` requirement is not met
 * by the pilot's current level.
 *
 * "This ability is normally available at level N. This pilot is level M."
 */
function checkAbilityPrerequisites(before: PilotSnapshot, after: PilotSnapshot): SoftWarning[] {
  const warnings: SoftWarning[] = []

  // Only check abilities that are new in the `after` snapshot
  const beforeRefs = new Set(before.abilities.map((a) => a.ref))

  for (const ability of after.abilities) {
    if (beforeRefs.has(ability.ref)) continue // already had it — not a new addition
    if (ability.minLevel !== undefined && after.level < ability.minLevel) {
      warnings.push(
        warn(
          'ABILITY_LEVEL_PREREQUISITE',
          `"${ability.ref}" is normally available at level ${ability.minLevel}. ` +
            `This pilot is level ${after.level}.`
        )
      )
    }
  }

  return warnings
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate soft warnings for a pilot edit.
 *
 * Documented cases:
 * - Pilot ability added whose `minLevel` requirement exceeds the pilot's level
 *
 * Returns an empty array when no warnings apply.
 */
export function evaluatePilotWarnings(
  snapshot: EditSnapshot<PilotSnapshot>,
  context: SoftWarningContext
): SoftWarning[] {
  const warnings: SoftWarning[] = []
  warnings.push(...checkAbilityPrerequisites(snapshot.before, snapshot.after))
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
 * Unified entry point for soft-warning evaluation.
 *
 * Dispatches to the appropriate entity-specific evaluator based on
 * `context.entityType`. For 'pilot', `before`/`after` must be `PilotSnapshot`.
 * For 'mech', they must be `MechSnapshot`. For 'crawler', only the
 * tech-level downgrade check applies (crawler-specific rules are M4).
 *
 * When `entityType` is 'crawler', pass any object satisfying `MechSnapshot`
 * (only the `techLevel` field is read; `systems` can be an empty array).
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
      // Crawler-specific rules beyond tech-level downgrade are deferred to M4.
      return checkTechLevelDowngrade(context)
    default: {
      // Exhaustiveness guard — TypeScript will catch this at compile time if
      // a new entityType is added without a corresponding case.
      const _unreachable: never = context.entityType
      return _unreachable
    }
  }
}

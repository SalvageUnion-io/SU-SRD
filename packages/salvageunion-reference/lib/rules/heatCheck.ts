/**
 * Heat Check / Reactor Overload rules.
 *
 * Salvage Union Core Book p.233-235 — the central mech combat mechanic.
 *
 * Rules summary:
 * - Heat can never exceed Heat Cap (clamped by `clampHeat`).
 * - A Heat Check triggers when the pilot Pushes, reaches Heat Cap, or starts a
 *   turn at Heat Cap. Roll a d20: if the roll is <= current Heat the reactor
 *   OVERLOADS.
 * - On overload, roll the Reactor Overload Table (another d20):
 *     1     → catastrophic meltdown (mech destroyed)
 *     2-5   → a System is destroyed (player picks which)
 *     6-10  → a Module is destroyed (player picks which)
 *     11-19 → reactor overheat: mech shuts down, becomes Vulnerable, and takes
 *             SP damage equal to current Heat
 *     20    → reactor overdrive: the mech may take any additional action this
 *             turn, or Push its next roll within 10 minutes, for free (p.235)
 * - Push: re-roll a die, +2 Heat (clamped to cap), then immediately a Heat Check.
 *
 * This module is PURE: no React, no IndexedDB, no real randomness. The d20 is
 * injected via a `Roll` function so every function is deterministic in tests.
 * Production callers pass a Randsum-backed `Roll`. `heatCheckPatch` stays
 * app-local in `apps/web/src/lib/rules/heatCheck.ts`: it assembles a
 * `Partial<Mech>` write-through patch, which needs the app's own Zod-derived
 * `Mech` type (ADR-006/ADR-007).
 *
 * The functions here compute the *deterministic* parts of the outcome (clamped
 * heat, SP damage, shutdown/vulnerable/destroyed flags) and report the table
 * band. Marking WHICH System/Module is destroyed (the 2-5 / 6-10 bands) is left
 * to the player via the card status badge — this module never auto-picks.
 */

import type {
  HeatCheckEffect,
  OverloadTable,
  PushResult,
  ReactorOverloadOutcome,
  Roll,
} from './types'

/**
 * Clamps a heat value into [0, cap]. Heat can never exceed Heat Cap (rule 1).
 * A negative cap is treated as 0.
 */
export function clampHeat(heat: number, cap: number): number {
  const safeCap = Math.max(0, cap)
  if (heat < 0) return 0
  if (heat > safeCap) return safeCap
  return heat
}

/**
 * Check whether an action can be activated given current heat and cost.
 * An action is blocked if using it would push heat above the heat cap.
 */
export function canActivateAction(currentHeat: number, heatCost: number, heatCap: number): boolean {
  return currentHeat + heatCost <= heatCap
}

/** Heat a Push adds to the Mech (Core Book p.233). */
export const PUSH_HEAT = 2

/**
 * Whether the Mech may Push: not when the Heat gained would take it over its
 * Heat Cap (Core Book p.234 — a Mech with a Heat Capacity of 10 on 9 Heat
 * cannot Push).
 */
export function canPush(currentHeat: number, heatCap: number): boolean {
  return canActivateAction(currentHeat, PUSH_HEAT, heatCap)
}

/**
 * Maps a Reactor Overload Table d20 roll to its outcome band (p.235).
 *   1     → meltdown
 *   2-5   → system-destroyed
 *   6-10  → module-destroyed
 *   11-19 → overheat
 *   20    → overdrive
 * Each band is one row of the `Reactor Overload` roll table, which
 * `describeOverloadOutcome` reads for the readout.
 */
export function reactorOverloadOutcome(roll: number): ReactorOverloadOutcome {
  if (roll <= 1) return 'meltdown'
  if (roll <= 5) return 'system-destroyed'
  if (roll <= 10) return 'module-destroyed'
  if (roll <= 19) return 'overheat'
  return 'overdrive'
}

/**
 * Maps a Bio-Chassis Overload Table d20 roll to its outcome band (We Were Here
 * First p.79), the table a Bio-Chassis fails a Heat Check on.
 *   1     → death-throes
 *   2-3   → system-destroyed
 *   4-5   → severe-pilot-overload
 *   6-8   → module-destroyed
 *   9-10  → pilot-overload
 *   11-19 → bio-overload
 *   20    → overdrive
 */
export function bioOverloadOutcome(roll: number): ReactorOverloadOutcome {
  if (roll <= 1) return 'death-throes'
  if (roll <= 3) return 'system-destroyed'
  if (roll <= 5) return 'severe-pilot-overload'
  if (roll <= 8) return 'module-destroyed'
  if (roll <= 10) return 'pilot-overload'
  if (roll <= 19) return 'bio-overload'
  return 'overdrive'
}

/**
 * Whether a chassis is a Bio-Chassis: the Bio tier, `'B'` (We Were Here First
 * pp.66-73). A Bio-Chassis rolls its own Damage and Overload tables.
 */
export function isBioChassis(chassis: { techLevel?: unknown } | null | undefined): boolean {
  return chassis?.techLevel === 'B'
}

/** The overload table for a chassis: a Bio-Chassis's own, else the reactor's. */
export function overloadTableOf(
  chassis: { techLevel?: unknown } | null | undefined
): OverloadTable {
  return isBioChassis(chassis) ? 'bio' : 'reactor'
}

/** The roll table an overload rolls on, by its name in the reference data. */
export function overloadTableName(table: OverloadTable): string {
  return table === 'bio' ? 'Bio-Chassis Overload Table' : 'Reactor Overload'
}

/** The roll table a mech at 0 SP rolls on (Core Book p.240; WWHF p.78). */
export function damageTableName(table: OverloadTable): string {
  return table === 'bio' ? 'Bio-Chassis Damage Table' : 'Critical Damage'
}

type HeatCheckInput = {
  /** Current Heat at the moment of the check (already clamped to cap). */
  heat: number
  /** Current SP — used to apply overheat damage on an 11-19. */
  currentSP: number
  /** Injectable d20 roller. */
  roll: Roll
  /** Injectable clock for the recorded timestamp (defaults to () => new Date()). */
  now?: () => Date
  /** The table an overload rolls on (default the reactor's). */
  table?: OverloadTable
}

/**
 * Performs a single Heat Check (rule 2).
 *
 * Rolls a d20; if roll <= heat the reactor overloads and a second d20 is rolled
 * on the Reactor Overload Table. Returns the deterministic effect. SP damage and
 * shutdown/vulnerable are applied for the 11-19 band; destroyed for roll 1. The
 * 2-5 / 6-10 bands set `requiresPlayerChoice` and leave SP/flags untouched.
 */
export function performHeatCheck({
  heat,
  currentSP,
  roll,
  now,
  table = 'reactor',
}: HeatCheckInput): HeatCheckEffect {
  const clock = now ?? (() => new Date())
  const heatCheckRoll = roll(20)
  // A natural 20 is ALWAYS a success, even when current Heat >= 20 (Heat Cap can
  // exceed 20, e.g. Cerberus chassis at Cap 30). Core Book p.234. Otherwise the
  // reactor overloads when the roll is <= current Heat.
  const overloaded = heatCheckRoll !== 20 && heatCheckRoll <= heat

  if (!overloaded) {
    return {
      result: {
        heatCheckRoll,
        heatAtCheck: heat,
        overloaded: false,
        rolledAt: clock().toISOString(),
      },
      nextSP: currentSP,
      shutdown: false,
      vulnerable: false,
      destroyed: false,
      requiresPlayerChoice: false,
    }
  }

  const overloadRoll = roll(20)
  const outcome =
    table === 'bio' ? bioOverloadOutcome(overloadRoll) : reactorOverloadOutcome(overloadRoll)

  const overheat = outcome === 'overheat'
  // A Bio-Overload: the Pilot is out for a Turn, the Bio-Chassis cannot act
  // and is Vulnerable; the Heat burns the Pilot, not the chassis (WWHF p.79).
  const bioOverload = outcome === 'bio-overload'
  const destroyed = outcome === 'meltdown' || outcome === 'death-throes'
  const requiresPlayerChoice = outcome === 'system-destroyed' || outcome === 'module-destroyed'
  const pilotInjury =
    outcome === 'severe-pilot-overload'
      ? 'major'
      : outcome === 'pilot-overload'
        ? 'minor'
        : undefined

  // 11-19: SP damage equal to current Heat, clamped to 0.
  const nextSP = overheat ? Math.max(0, currentSP - heat) : currentSP

  return {
    result: {
      heatCheckRoll,
      heatAtCheck: heat,
      overloaded: true,
      overloadRoll,
      outcome,
      rolledAt: clock().toISOString(),
    },
    nextSP,
    shutdown: overheat || bioOverload,
    vulnerable: overheat || bioOverload,
    destroyed,
    requiresPlayerChoice,
    ...(bioOverload && heat > 0 ? { pilotDamage: heat } : {}),
    ...(pilotInjury === undefined ? {} : { pilotInjury }),
  }
}

type PushInput = {
  /** Current Heat before the Push. */
  heat: number
  /** Heat Cap — the new heat is clamped to this. */
  heatCap: number
  /** Current SP. */
  currentSP: number
  /** Injectable d20 roller. */
  roll: Roll
  /** Injectable clock. */
  now?: () => Date
  /** The table an overload rolls on (default the reactor's). */
  table?: OverloadTable
}

/**
 * Performs a Push (rule 3): +2 Heat (clamped to cap), then an immediate Heat
 * Check at the new heat. Returns both the new heat and the check effect.
 */
export function performPush({ heat, heatCap, currentSP, roll, now, table }: PushInput): PushResult {
  const nextHeat = clampHeat(heat + PUSH_HEAT, heatCap)
  const effect = performHeatCheck({
    heat: nextHeat,
    currentSP,
    roll,
    ...(now === undefined ? {} : { now }),
    ...(table === undefined ? {} : { table }),
  })
  return { nextHeat, effect }
}

/**
 * Heat Check / Reactor Overload rules (Slice C, #199).
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
 *     20    → safe (no effect)
 * - Push: re-roll a die, +2 Heat (clamped to cap), then immediately a Heat Check.
 *
 * This module is PURE: no React, no IndexedDB, no real randomness. The d20 is
 * injected via a `Roll` function so every function is deterministic in tests.
 * The production caller (MechSheet) passes a real RNG-backed roller.
 *
 * The functions here compute the *deterministic* parts of the outcome (clamped
 * heat, SP damage, shutdown/vulnerable/destroyed flags) and report the table
 * band. Marking WHICH System/Module is destroyed (the 2-5 / 6-10 bands) is left
 * to the player via the existing ConditionToggle — this module never auto-picks.
 */

import { roll } from '@randsum/roller'

import type { HeatCheckResult, ReactorOverloadOutcome } from '../schemas/mech'

/** A function that returns an integer die roll in [1, sides]. Injectable. */
export type Roll = (sides: number) => number

/** Default roller — a uniform d-sides via randsum. Injectable for deterministic tests. */
export const defaultRoll: Roll = (sides: number) => roll(`1d${sides}`).total

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
 * Maps a Reactor Overload Table d20 roll to its outcome band (p.234-235).
 *   1     → meltdown
 *   2-5   → system-destroyed
 *   6-10  → module-destroyed
 *   11-19 → overheat
 *   20    → safe
 */
export function reactorOverloadOutcome(roll: number): ReactorOverloadOutcome {
  if (roll <= 1) return 'meltdown'
  if (roll <= 5) return 'system-destroyed'
  if (roll <= 10) return 'module-destroyed'
  if (roll <= 19) return 'overheat'
  return 'safe'
}

/**
 * The deterministic state changes a Heat Check produces. The caller applies
 * these as a patch to the mech. `requiresPlayerChoice` is true for the 2-5 /
 * 6-10 bands, signalling the UI to prompt the player to mark a System/Module
 * via ConditionToggle (this module never auto-picks one).
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

type HeatCheckInput = {
  /** Current Heat at the moment of the check (already clamped to cap). */
  heat: number
  /** Current SP — used to apply overheat damage on an 11-19. */
  currentSP: number
  /** Injectable d20 roller. */
  roll: Roll
  /** Injectable clock for the recorded timestamp (defaults to () => new Date()). */
  now?: () => Date
}

/**
 * Performs a single Heat Check (rule 2).
 *
 * Rolls a d20; if roll <= heat the reactor overloads and a second d20 is rolled
 * on the Reactor Overload Table. Returns the deterministic effect. SP damage and
 * shutdown/vulnerable are applied for the 11-19 band; destroyed for roll 1. The
 * 2-5 / 6-10 bands set `requiresPlayerChoice` and leave SP/flags untouched.
 */
export function performHeatCheck({ heat, currentSP, roll, now }: HeatCheckInput): HeatCheckEffect {
  const clock = now ?? (() => new Date())
  const heatCheckRoll = roll(20)
  // A natural 20 is ALWAYS a success, even when current Heat >= 20 (Heat Cap can
  // exceed 20, e.g. Cerberus chassis at Cap 30). Core Book p.30/39 / keywords
  // 'heat check'. Otherwise the reactor overloads when the roll is <= current Heat.
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
  const outcome = reactorOverloadOutcome(overloadRoll)

  const overheat = outcome === 'overheat'
  const destroyed = outcome === 'meltdown'
  const requiresPlayerChoice = outcome === 'system-destroyed' || outcome === 'module-destroyed'

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
    shutdown: overheat,
    vulnerable: overheat,
    destroyed,
    requiresPlayerChoice,
  }
}

export type PushResult = {
  /** Heat after +2 (clamped to cap), before any overheat SP damage. */
  nextHeat: number
  /** The Heat Check performed at the new heat. */
  effect: HeatCheckEffect
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
}

/**
 * Performs a Push (rule 3): +2 Heat (clamped to cap), then an immediate Heat
 * Check at the new heat. Returns both the new heat and the check effect.
 */
export function performPush({ heat, heatCap, currentSP, roll, now }: PushInput): PushResult {
  const nextHeat = clampHeat(heat + 2, heatCap)
  const effect = performHeatCheck({ heat: nextHeat, currentSP, roll, now })
  return { nextHeat, effect }
}

/**
 * Take Damage / Critical Damage / Critical Injury rules (design-review R-1).
 *
 * Salvage Union Core Book p.239-242 — damage intake, the most error-prone
 * live math in the game.
 *
 * Rules summary:
 * - Mech Damage (p.239-240): weapons that list SP damage reduce mech SP 1:1.
 *   A weapon that lists HP damage deals HALF that damage to a mech (floored).
 *   SP can never go below 0. On reaching 0 SP, roll the Critical Damage
 *   Table (d20):
 *     1     → Catastrophic: mech + mounted Systems/Modules + Cargo destroyed;
 *             pilot dies unless they can escape
 *     2-5   → System Destruction: a System destroyed (player marks which);
 *             chassis Damaged and inoperable
 *     6-10  → Module Destruction: a Module destroyed (player marks which);
 *             chassis Damaged and inoperable
 *     11-19 → Core Damage: chassis Damaged and inoperable; pilot reduced to
 *             0 HP unless they can escape
 *     20    → Miraculous Survival: mech Intact at 1 SP, fully operational
 * - Pilot Damage (p.241): weapons that list HP damage reduce pilot HP 1:1.
 *   A weapon that deals SP damage deals 2× that damage to a pilot. HP can
 *   never go below 0. On reaching 0 HP, roll the Critical Injury Table (d20):
 *     1     → Fatal Injury: the pilot dies
 *     2-5   → Major Injury (−2 max HP until healed, T5-6 Med Bay) + Unconscious
 *     6-10  → Minor Injury (−1 max HP until healed, T3-4 Med Bay) + Unconscious
 *     11-19 → Unconscious: stable at 0 HP until they regain ≥1 HP
 *     20    → Miraculous Survival: 1 HP, conscious, acts normally
 * - Vulnerable (e.g. a shut-down mech) takes 2× damage. The doubling applies
 *   to the damage the TARGET takes — i.e. after the SP↔HP conversion.
 *
 * The band data mirrors the "Critical Damage" / "Critical Injury" tables in
 * salvageunion-reference data/roll-tables.json, encoded here as pure band
 * functions the same way heatCheck.ts encodes the Reactor Overload bands.
 * The SP subtraction itself is the shared `applySpDamage` from
 * salvageunion-reference/lib/combatUtils.ts (ADR-006 — never reimplemented).
 *
 * This module is PURE: no React, no store, no real randomness — the d20 is
 * injected via `Roll`. Per ADR-007 the functions return deterministic
 * bookkeeping for the caller to apply and FLAG the destructive/narrative
 * choices (which System/Module dies, whether an injury is accepted, pilot
 * death) for the player — never auto-picked.
 */

import { applySpDamage } from 'salvageunion-reference'

import type { CriticalDamageOutcome, CriticalDamageResult } from '../schemas/mech'
import type { CriticalInjuryOutcome, CriticalInjuryResult } from '../schemas/pilot'
import type { Roll } from './heatCheck'

/** What the incoming weapon lists in its profile (drives the p.240/241 conversions). */
export type DamageKind = 'sp' | 'hp'

// ---------------------------------------------------------------------------
// Mech damage (p.239-240)
// ---------------------------------------------------------------------------

/**
 * The SP damage a mech actually takes: HP-listed weapons deal half damage to
 * mechs (floored), then Vulnerable doubles what the mech takes. Non-positive
 * amounts are 0.
 */
export function mechEffectiveDamage(amount: number, kind: DamageKind, vulnerable: boolean): number {
  if (amount <= 0) return 0
  const converted = kind === 'hp' ? Math.floor(amount / 2) : amount
  return vulnerable ? converted * 2 : converted
}

export type MechDamageInput = {
  /** Current SP before the hit. */
  currentSP: number
  /** The weapon's listed damage. */
  amount: number
  /** What the weapon lists — SP applies 1:1, HP is halved vs mechs. */
  kind: DamageKind
  /** Vulnerable targets take 2× damage. */
  vulnerable: boolean
}

export type MechDamageEffect = {
  /** SP damage actually applied after conversion + Vulnerable. */
  effectiveDamage: number
  /** New SP (clamped at 0 by the shared applySpDamage). */
  nextSP: number
  /** True when this hit left the mech at 0 SP — roll Critical Damage. */
  criticalDue: boolean
}

/**
 * Applies one hit to a mech's SP. The subtraction/clamp is the shared
 * `applySpDamage`; `criticalDue` signals the Critical Damage Table prompt
 * (only when real damage landed — arriving at 0 from 0 with a 0-damage input
 * never prompts).
 */
export function applyMechDamage({
  currentSP,
  amount,
  kind,
  vulnerable,
}: MechDamageInput): MechDamageEffect {
  const effectiveDamage = mechEffectiveDamage(amount, kind, vulnerable)
  const { newSp } = applySpDamage(currentSP, effectiveDamage)
  return {
    effectiveDamage,
    nextSP: newSp,
    criticalDue: effectiveDamage > 0 && newSp === 0,
  }
}

/**
 * Maps a Critical Damage Table d20 roll to its outcome band (p.240).
 *   1     → catastrophic
 *   2-5   → system-destruction
 *   6-10  → module-destruction
 *   11-19 → core-damage
 *   20    → miraculous-survival
 */
export function criticalDamageOutcome(roll: number): CriticalDamageOutcome {
  if (roll <= 1) return 'catastrophic'
  if (roll <= 5) return 'system-destruction'
  if (roll <= 10) return 'module-destruction'
  if (roll <= 19) return 'core-damage'
  return 'miraculous-survival'
}

/**
 * The deterministic state changes a Critical Damage roll produces. The caller
 * applies these as a patch to the mech. `requiresPlayerChoice` flags the 2-5 /
 * 6-10 bands: the player marks WHICH System/Module is destroyed via its
 * status badge (ADR-007 — this module never auto-picks one). The pilot-side
 * consequences of `catastrophic`/`core-damage` (death / 0 HP unless they
 * escape) are narrative and stay advisory text at the control layer.
 */
export type CriticalDamageEffect = {
  /** The recorded result for display + persistence. */
  result: CriticalDamageResult
  /** SP override — 1 on miraculous-survival, null otherwise (unchanged). */
  nextSP: number | null
  /** True on catastrophic (roll 1) — the mech is destroyed. */
  destroyed: boolean
  /** True on 2-19 — the chassis is Damaged and inoperable until repaired. */
  chassisDamaged: boolean
  /** 2-5 → 'system', 6-10 → 'module': the player marks one destroyed. */
  requiresPlayerChoice: 'system' | 'module' | null
}

type CriticalRollInput = {
  /** Injectable d20 roller. */
  roll: Roll
  /** Injectable clock for the recorded timestamp (defaults to () => new Date()). */
  now?: () => Date
}

/** Rolls the Critical Damage Table (p.240) and returns the deterministic effect. */
export function performCriticalDamage({ roll, now }: CriticalRollInput): CriticalDamageEffect {
  const clock = now ?? (() => new Date())
  const d20 = roll(20)
  const outcome = criticalDamageOutcome(d20)
  return {
    result: { roll: d20, outcome, rolledAt: clock().toISOString() },
    nextSP: outcome === 'miraculous-survival' ? 1 : null,
    destroyed: outcome === 'catastrophic',
    chassisDamaged:
      outcome === 'system-destruction' ||
      outcome === 'module-destruction' ||
      outcome === 'core-damage',
    requiresPlayerChoice:
      outcome === 'system-destruction'
        ? 'system'
        : outcome === 'module-destruction'
          ? 'module'
          : null,
  }
}

// ---------------------------------------------------------------------------
// Pilot damage (p.241)
// ---------------------------------------------------------------------------

/**
 * The HP damage a pilot actually takes: SP-listed weapons deal 2× damage to
 * pilots, then Vulnerable doubles what the pilot takes. Non-positive amounts
 * are 0.
 */
export function pilotEffectiveDamage(
  amount: number,
  kind: DamageKind,
  vulnerable: boolean
): number {
  if (amount <= 0) return 0
  const converted = kind === 'sp' ? amount * 2 : amount
  return vulnerable ? converted * 2 : converted
}

export type PilotDamageInput = {
  /** Current HP before the hit. */
  currentHP: number
  /** The weapon's listed damage. */
  amount: number
  /** What the weapon lists — HP applies 1:1, SP is doubled vs pilots. */
  kind: DamageKind
  /** Vulnerable targets take 2× damage. */
  vulnerable: boolean
}

export type PilotDamageEffect = {
  /** HP damage actually applied after conversion + Vulnerable. */
  effectiveDamage: number
  /** New HP (clamped at 0 — HP never goes negative). */
  nextHP: number
  /** True when this hit left the pilot at 0 HP — roll Critical Injury. */
  criticalDue: boolean
}

/** Applies one hit to a pilot's HP (clamped at 0, never negative). */
export function applyPilotDamage({
  currentHP,
  amount,
  kind,
  vulnerable,
}: PilotDamageInput): PilotDamageEffect {
  const effectiveDamage = pilotEffectiveDamage(amount, kind, vulnerable)
  const nextHP = Math.max(0, currentHP - effectiveDamage)
  return {
    effectiveDamage,
    nextHP,
    criticalDue: effectiveDamage > 0 && nextHP === 0,
  }
}

/**
 * Maps a Critical Injury Table d20 roll to its outcome band (p.241).
 *   1     → fatal
 *   2-5   → major-injury
 *   6-10  → minor-injury
 *   11-19 → unconscious
 *   20    → miraculous-survival
 */
export function criticalInjuryOutcome(roll: number): CriticalInjuryOutcome {
  if (roll <= 1) return 'fatal'
  if (roll <= 5) return 'major-injury'
  if (roll <= 10) return 'minor-injury'
  if (roll <= 19) return 'unconscious'
  return 'miraculous-survival'
}

/**
 * The deterministic state changes a Critical Injury roll produces.
 * Unconsciousness (bands 2-19) is recoverable bookkeeping the caller may
 * auto-apply as a condition; the max-HP-reducing `injury` (2-5 / 6-10) is
 * offered for the player to ACCEPT into the injuries list, and `fatal` is
 * narrative only (ADR-007 — the app never kills a pilot automatically).
 */
export type CriticalInjuryEffect = {
  /** The recorded result for display + persistence. */
  result: CriticalInjuryResult
  /** HP override — 1 on miraculous-survival, null otherwise (unchanged). */
  nextHP: number | null
  /** True on 2-19 — the pilot is Unconscious until they regain ≥1 HP. */
  unconscious: boolean
  /** The injury severity the player is prompted to accept (2-5 / 6-10). */
  injury: 'minor' | 'major' | null
  /** True on a roll of 1 — the pilot dies (player marks it, never auto). */
  fatal: boolean
}

/** Rolls the Critical Injury Table (p.241) and returns the deterministic effect. */
export function performCriticalInjury({ roll, now }: CriticalRollInput): CriticalInjuryEffect {
  const clock = now ?? (() => new Date())
  const d20 = roll(20)
  const outcome = criticalInjuryOutcome(d20)
  return {
    result: { roll: d20, outcome, rolledAt: clock().toISOString() },
    nextHP: outcome === 'miraculous-survival' ? 1 : null,
    unconscious:
      outcome === 'major-injury' || outcome === 'minor-injury' || outcome === 'unconscious',
    injury: outcome === 'major-injury' ? 'major' : outcome === 'minor-injury' ? 'minor' : null,
    fatal: outcome === 'fatal',
  }
}

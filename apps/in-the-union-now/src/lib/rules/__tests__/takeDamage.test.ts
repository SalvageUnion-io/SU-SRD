/**
 * Take Damage / Critical Damage / Critical Injury rule tests (design-review
 * R-1; Core Book p.239-242).
 *
 * The d20 is INJECTABLE via the `roll` param (same discipline as
 * heatCheck.test.ts) — no real randomness anywhere.
 */

import { describe, expect, test } from 'bun:test'

import {
  applyMechDamage,
  applyPilotDamage,
  criticalDamageOutcome,
  criticalInjuryOutcome,
  mechEffectiveDamage,
  performCriticalDamage,
  performCriticalInjury,
  pilotEffectiveDamage,
} from '../takeDamage'
import type { Roll } from '../heatCheck'

/** Returns a Roll that yields the given values in order, ignoring `sides`. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 1
    i++
    return v
  }
}

const fixedNow = () => new Date('2026-07-01T00:00:00.000Z')

// ---------------------------------------------------------------------------
// mechEffectiveDamage — SP↔HP conversion + Vulnerable (p.240)
// ---------------------------------------------------------------------------

describe('mechEffectiveDamage', () => {
  test('SP-listed damage applies 1:1', () => {
    expect(mechEffectiveDamage(3, 'sp', false)).toBe(3)
  })

  test('HP-listed damage is halved vs mechs (floored)', () => {
    expect(mechEffectiveDamage(5, 'hp', false)).toBe(2)
    expect(mechEffectiveDamage(4, 'hp', false)).toBe(2)
    expect(mechEffectiveDamage(1, 'hp', false)).toBe(0)
  })

  test('Vulnerable doubles the damage the mech takes (after conversion)', () => {
    expect(mechEffectiveDamage(3, 'sp', true)).toBe(6)
    // convert first (floor 5/2 = 2), then ×2 → 4 (not floor(10/2) = 5)
    expect(mechEffectiveDamage(5, 'hp', true)).toBe(4)
  })

  test('non-positive amounts deal 0', () => {
    expect(mechEffectiveDamage(0, 'sp', true)).toBe(0)
    expect(mechEffectiveDamage(-2, 'hp', false)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// applyMechDamage — SP reduction via the shared applySpDamage
// ---------------------------------------------------------------------------

describe('applyMechDamage', () => {
  test('reduces SP and does not prompt above 0', () => {
    const effect = applyMechDamage({ currentSP: 9, amount: 3, kind: 'sp', vulnerable: false })
    expect(effect.effectiveDamage).toBe(3)
    expect(effect.nextSP).toBe(6)
    expect(effect.criticalDue).toBe(false)
  })

  test('SP clamps at 0 and prompts the Critical Damage roll', () => {
    const effect = applyMechDamage({ currentSP: 4, amount: 7, kind: 'sp', vulnerable: false })
    expect(effect.nextSP).toBe(0)
    expect(effect.criticalDue).toBe(true)
  })

  test('landing exactly on 0 prompts', () => {
    const effect = applyMechDamage({ currentSP: 3, amount: 3, kind: 'sp', vulnerable: false })
    expect(effect.nextSP).toBe(0)
    expect(effect.criticalDue).toBe(true)
  })

  test('0 effective damage at 0 SP never prompts', () => {
    // 1 HP-listed damage floors to 0 vs a mech — nothing happened.
    const effect = applyMechDamage({ currentSP: 0, amount: 1, kind: 'hp', vulnerable: false })
    expect(effect.effectiveDamage).toBe(0)
    expect(effect.nextSP).toBe(0)
    expect(effect.criticalDue).toBe(false)
  })

  test('further damage while already at 0 SP re-prompts', () => {
    const effect = applyMechDamage({ currentSP: 0, amount: 2, kind: 'sp', vulnerable: false })
    expect(effect.nextSP).toBe(0)
    expect(effect.criticalDue).toBe(true)
  })

  test('Vulnerable ×2 flows through', () => {
    const effect = applyMechDamage({ currentSP: 10, amount: 3, kind: 'sp', vulnerable: true })
    expect(effect.effectiveDamage).toBe(6)
    expect(effect.nextSP).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// criticalDamageOutcome — table band mapping (p.240)
// ---------------------------------------------------------------------------

describe('criticalDamageOutcome', () => {
  test('1 → catastrophic', () => {
    expect(criticalDamageOutcome(1)).toBe('catastrophic')
  })

  test('2-5 → system-destruction', () => {
    expect(criticalDamageOutcome(2)).toBe('system-destruction')
    expect(criticalDamageOutcome(5)).toBe('system-destruction')
  })

  test('6-10 → module-destruction', () => {
    expect(criticalDamageOutcome(6)).toBe('module-destruction')
    expect(criticalDamageOutcome(10)).toBe('module-destruction')
  })

  test('11-19 → core-damage', () => {
    expect(criticalDamageOutcome(11)).toBe('core-damage')
    expect(criticalDamageOutcome(19)).toBe('core-damage')
  })

  test('20 → miraculous-survival', () => {
    expect(criticalDamageOutcome(20)).toBe('miraculous-survival')
  })
})

// ---------------------------------------------------------------------------
// performCriticalDamage — deterministic effects per band
// ---------------------------------------------------------------------------

describe('performCriticalDamage', () => {
  test('20 → mech Intact at 1 SP, nothing else', () => {
    const effect = performCriticalDamage({ roll: seqRoll(20), now: fixedNow })
    expect(effect.result.outcome).toBe('miraculous-survival')
    expect(effect.nextSP).toBe(1)
    expect(effect.destroyed).toBe(false)
    expect(effect.chassisDamaged).toBe(false)
    expect(effect.requiresPlayerChoice).toBeNull()
  })

  test('11-19 → chassis damaged, no player choice, SP unchanged', () => {
    const effect = performCriticalDamage({ roll: seqRoll(14), now: fixedNow })
    expect(effect.result.outcome).toBe('core-damage')
    expect(effect.nextSP).toBeNull()
    expect(effect.chassisDamaged).toBe(true)
    expect(effect.destroyed).toBe(false)
    expect(effect.requiresPlayerChoice).toBeNull()
  })

  test('6-10 → player marks a Module + chassis damaged', () => {
    const effect = performCriticalDamage({ roll: seqRoll(8), now: fixedNow })
    expect(effect.result.outcome).toBe('module-destruction')
    expect(effect.requiresPlayerChoice).toBe('module')
    expect(effect.chassisDamaged).toBe(true)
  })

  test('2-5 → player marks a System + chassis damaged', () => {
    const effect = performCriticalDamage({ roll: seqRoll(3), now: fixedNow })
    expect(effect.result.outcome).toBe('system-destruction')
    expect(effect.requiresPlayerChoice).toBe('system')
    expect(effect.chassisDamaged).toBe(true)
  })

  test('1 → mech destroyed (no chassis-damaged bookkeeping needed)', () => {
    const effect = performCriticalDamage({ roll: seqRoll(1), now: fixedNow })
    expect(effect.result.outcome).toBe('catastrophic')
    expect(effect.destroyed).toBe(true)
    expect(effect.chassisDamaged).toBe(false)
    expect(effect.requiresPlayerChoice).toBeNull()
  })

  test('records the raw roll and timestamp', () => {
    const effect = performCriticalDamage({ roll: seqRoll(7), now: fixedNow })
    expect(effect.result.roll).toBe(7)
    expect(effect.result.rolledAt).toBe('2026-07-01T00:00:00.000Z')
  })
})

// ---------------------------------------------------------------------------
// pilotEffectiveDamage — SP↔HP conversion + Vulnerable (p.241)
// ---------------------------------------------------------------------------

describe('pilotEffectiveDamage', () => {
  test('HP-listed damage applies 1:1', () => {
    expect(pilotEffectiveDamage(2, 'hp', false)).toBe(2)
  })

  test('SP-listed damage is doubled vs pilots', () => {
    expect(pilotEffectiveDamage(3, 'sp', false)).toBe(6)
  })

  test('Vulnerable doubles again after the conversion', () => {
    expect(pilotEffectiveDamage(2, 'hp', true)).toBe(4)
    expect(pilotEffectiveDamage(3, 'sp', true)).toBe(12)
  })

  test('non-positive amounts deal 0', () => {
    expect(pilotEffectiveDamage(0, 'sp', true)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// applyPilotDamage
// ---------------------------------------------------------------------------

describe('applyPilotDamage', () => {
  test('reduces HP and does not prompt above 0', () => {
    const effect = applyPilotDamage({ currentHP: 10, amount: 2, kind: 'hp', vulnerable: false })
    expect(effect.nextHP).toBe(8)
    expect(effect.criticalDue).toBe(false)
  })

  test('HP clamps at 0 and prompts the Critical Injury roll', () => {
    const effect = applyPilotDamage({ currentHP: 3, amount: 2, kind: 'sp', vulnerable: false })
    expect(effect.effectiveDamage).toBe(4)
    expect(effect.nextHP).toBe(0)
    expect(effect.criticalDue).toBe(true)
  })

  test('0 damage never prompts', () => {
    const effect = applyPilotDamage({ currentHP: 0, amount: 0, kind: 'hp', vulnerable: true })
    expect(effect.criticalDue).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// criticalInjuryOutcome — table band mapping (p.241)
// ---------------------------------------------------------------------------

describe('criticalInjuryOutcome', () => {
  test('1 → fatal', () => {
    expect(criticalInjuryOutcome(1)).toBe('fatal')
  })

  test('2-5 → major-injury', () => {
    expect(criticalInjuryOutcome(2)).toBe('major-injury')
    expect(criticalInjuryOutcome(5)).toBe('major-injury')
  })

  test('6-10 → minor-injury', () => {
    expect(criticalInjuryOutcome(6)).toBe('minor-injury')
    expect(criticalInjuryOutcome(10)).toBe('minor-injury')
  })

  test('11-19 → unconscious', () => {
    expect(criticalInjuryOutcome(11)).toBe('unconscious')
    expect(criticalInjuryOutcome(19)).toBe('unconscious')
  })

  test('20 → miraculous-survival', () => {
    expect(criticalInjuryOutcome(20)).toBe('miraculous-survival')
  })
})

// ---------------------------------------------------------------------------
// performCriticalInjury — deterministic effects per band
// ---------------------------------------------------------------------------

describe('performCriticalInjury', () => {
  test('20 → 1 HP, conscious, no injury', () => {
    const effect = performCriticalInjury({ roll: seqRoll(20), now: fixedNow })
    expect(effect.result.outcome).toBe('miraculous-survival')
    expect(effect.nextHP).toBe(1)
    expect(effect.unconscious).toBe(false)
    expect(effect.injury).toBeNull()
    expect(effect.fatal).toBe(false)
  })

  test('11-19 → unconscious, stable at 0 (HP unchanged)', () => {
    const effect = performCriticalInjury({ roll: seqRoll(15), now: fixedNow })
    expect(effect.result.outcome).toBe('unconscious')
    expect(effect.nextHP).toBeNull()
    expect(effect.unconscious).toBe(true)
    expect(effect.injury).toBeNull()
  })

  test('6-10 → minor injury offered + unconscious', () => {
    const effect = performCriticalInjury({ roll: seqRoll(7), now: fixedNow })
    expect(effect.result.outcome).toBe('minor-injury')
    expect(effect.injury).toBe('minor')
    expect(effect.unconscious).toBe(true)
  })

  test('2-5 → major injury offered + unconscious', () => {
    const effect = performCriticalInjury({ roll: seqRoll(4), now: fixedNow })
    expect(effect.result.outcome).toBe('major-injury')
    expect(effect.injury).toBe('major')
    expect(effect.unconscious).toBe(true)
  })

  test('1 → fatal flag only — nothing auto-applied', () => {
    const effect = performCriticalInjury({ roll: seqRoll(1), now: fixedNow })
    expect(effect.result.outcome).toBe('fatal')
    expect(effect.fatal).toBe(true)
    expect(effect.nextHP).toBeNull()
    expect(effect.unconscious).toBe(false)
    expect(effect.injury).toBeNull()
  })

  test('records the raw roll and timestamp', () => {
    const effect = performCriticalInjury({ roll: seqRoll(12), now: fixedNow })
    expect(effect.result.roll).toBe(12)
    expect(effect.result.rolledAt).toBe('2026-07-01T00:00:00.000Z')
  })
})

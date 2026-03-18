import { describe, it, expect } from 'bun:test'
import {
  classifyInjuryRoll,
  applyInjuryToMaxHp,
  canHealInjury,
  createInjuryFromRoll,
  computeInjuryHealingUpdate,
  hasActiveInjuries,
  injuryLabel,
  getInjuries,
  getInjuryRollDescription,
  getInjuryRollLabel,
} from './injuryUtils'
import type { PilotInjury } from './injuryUtils'

// ---------------------------------------------------------------------------
// classifyInjuryRoll
// ---------------------------------------------------------------------------

describe('classifyInjuryRoll', () => {
  it('roll 1 is fatal', () => {
    expect(classifyInjuryRoll(1)).toBe('fatal')
  })

  it('rolls 2-5 are major', () => {
    expect(classifyInjuryRoll(2)).toBe('major')
    expect(classifyInjuryRoll(3)).toBe('major')
    expect(classifyInjuryRoll(5)).toBe('major')
  })

  it('rolls 6-10 are minor', () => {
    expect(classifyInjuryRoll(6)).toBe('minor')
    expect(classifyInjuryRoll(7)).toBe('minor')
    expect(classifyInjuryRoll(10)).toBe('minor')
  })

  it('rolls 11-19 are unconscious (no persistent injury)', () => {
    expect(classifyInjuryRoll(11)).toBe('unconscious')
    expect(classifyInjuryRoll(15)).toBe('unconscious')
    expect(classifyInjuryRoll(19)).toBe('unconscious')
  })

  it('roll 20 is miraculous survival', () => {
    expect(classifyInjuryRoll(20)).toBe('miraculous')
  })
})

// ---------------------------------------------------------------------------
// applyInjuryToMaxHp
// ---------------------------------------------------------------------------

describe('applyInjuryToMaxHp', () => {
  it('minor injury reduces max_hp by 1', () => {
    expect(applyInjuryToMaxHp(8, 'minor')).toBe(7)
  })

  it('major injury reduces max_hp by 2', () => {
    expect(applyInjuryToMaxHp(8, 'major')).toBe(6)
  })

  it('does not reduce below 1', () => {
    expect(applyInjuryToMaxHp(1, 'minor')).toBe(1)
    expect(applyInjuryToMaxHp(1, 'major')).toBe(1)
    expect(applyInjuryToMaxHp(2, 'major')).toBe(1)
  })

  it('returns unchanged max HP for non-injury severities', () => {
    expect(applyInjuryToMaxHp(8, 'fatal')).toBe(8)
    expect(applyInjuryToMaxHp(8, 'unconscious')).toBe(8)
    expect(applyInjuryToMaxHp(8, 'miraculous')).toBe(8)
  })
})

// ---------------------------------------------------------------------------
// canHealInjury
// ---------------------------------------------------------------------------

describe('canHealInjury', () => {
  it('minor injury can be healed at tech level 3', () => {
    expect(canHealInjury('minor', 3)).toBe(true)
  })

  it('minor injury can be healed at tech level 4', () => {
    expect(canHealInjury('minor', 4)).toBe(true)
  })

  it('minor injury cannot be healed below tech level 3', () => {
    expect(canHealInjury('minor', 2)).toBe(false)
    expect(canHealInjury('minor', 1)).toBe(false)
  })

  it('major injury can be healed at tech level 5', () => {
    expect(canHealInjury('major', 5)).toBe(true)
  })

  it('major injury can be healed at tech level 6', () => {
    expect(canHealInjury('major', 6)).toBe(true)
  })

  it('major injury cannot be healed below tech level 5', () => {
    expect(canHealInjury('major', 4)).toBe(false)
    expect(canHealInjury('major', 3)).toBe(false)
  })

  it('fatal, unconscious, and miraculous cannot be healed', () => {
    expect(canHealInjury('fatal', 6)).toBe(false)
    expect(canHealInjury('unconscious', 6)).toBe(false)
    expect(canHealInjury('miraculous', 6)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createInjuryFromRoll
// ---------------------------------------------------------------------------

describe('createInjuryFromRoll', () => {
  it('creates minor injury for "minor" result', () => {
    const injury = createInjuryFromRoll('minor')
    expect(injury).not.toBeNull()
    expect(injury!.severity).toBe('minor')
    expect(injury!.maxHpReduction).toBe(1)
  })

  it('creates major injury for "major" result', () => {
    const injury = createInjuryFromRoll('major')
    expect(injury).not.toBeNull()
    expect(injury!.severity).toBe('major')
    expect(injury!.maxHpReduction).toBe(2)
  })

  it('returns null for fatal', () => {
    expect(createInjuryFromRoll('fatal')).toBeNull()
  })

  it('returns null for unconscious', () => {
    expect(createInjuryFromRoll('unconscious')).toBeNull()
  })

  it('returns null for miraculous', () => {
    expect(createInjuryFromRoll('miraculous')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computeInjuryHealingUpdate
// ---------------------------------------------------------------------------

describe('computeInjuryHealingUpdate', () => {
  const minor: PilotInjury = { severity: 'minor', maxHpReduction: 1 }
  const major: PilotInjury = { severity: 'major', maxHpReduction: 2 }

  it('heals minor injury at med bay TL 3, major remains', () => {
    const result = computeInjuryHealingUpdate([minor, major], 10, 3)
    expect(result.healedCount).toBe(1)
    expect(result.maxHpRestored).toBe(1)
    expect(result.remainingInjuries).toHaveLength(1)
    expect(result.remainingInjuries[0]!.severity).toBe('major')
    expect(result.newMaxHp).toBe(11)
  })

  it('heals minor injury at med bay TL 4', () => {
    const result = computeInjuryHealingUpdate([minor], 10, 4)
    expect(result.healedCount).toBe(1)
    expect(result.maxHpRestored).toBe(1)
    expect(result.newMaxHp).toBe(11)
  })

  it('heals both injuries at med bay TL 5', () => {
    const result = computeInjuryHealingUpdate([minor, major], 10, 5)
    expect(result.healedCount).toBe(2)
    expect(result.maxHpRestored).toBe(3)
    expect(result.remainingInjuries).toHaveLength(0)
    expect(result.newMaxHp).toBe(13)
  })

  it('heals both injuries at med bay TL 6', () => {
    const result = computeInjuryHealingUpdate([minor, major], 10, 6)
    expect(result.healedCount).toBe(2)
    expect(result.maxHpRestored).toBe(3)
  })

  it('heals nothing at med bay TL 1 or 2', () => {
    const result1 = computeInjuryHealingUpdate([minor, major], 10, 1)
    expect(result1.healedCount).toBe(0)
    expect(result1.maxHpRestored).toBe(0)
    expect(result1.remainingInjuries).toHaveLength(2)
    expect(result1.newMaxHp).toBe(10)

    const result2 = computeInjuryHealingUpdate([minor, major], 10, 2)
    expect(result2.healedCount).toBe(0)
  })

  it('returns no-op for empty injury list', () => {
    const result = computeInjuryHealingUpdate([], 10, 5)
    expect(result.healedCount).toBe(0)
    expect(result.maxHpRestored).toBe(0)
    expect(result.remainingInjuries).toHaveLength(0)
    expect(result.newMaxHp).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// hasActiveInjuries
// ---------------------------------------------------------------------------

describe('hasActiveInjuries', () => {
  it('returns false for null', () => {
    expect(hasActiveInjuries(null)).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(hasActiveInjuries([])).toBe(false)
  })

  it('returns true when there are injuries', () => {
    const injuries: PilotInjury[] = [{ severity: 'minor', maxHpReduction: 1 }]
    expect(hasActiveInjuries(injuries)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// injuryLabel
// ---------------------------------------------------------------------------

describe('injuryLabel', () => {
  it('returns correct label for minor', () => {
    expect(injuryLabel('minor')).toBe('Minor Injury')
  })

  it('returns correct label for major', () => {
    expect(injuryLabel('major')).toBe('Major Injury')
  })
})

// ---------------------------------------------------------------------------
// getInjuries
// ---------------------------------------------------------------------------

describe('getInjuries', () => {
  it('returns empty array for pilot with no injuries field', () => {
    expect(getInjuries({})).toEqual([])
  })

  it('returns empty array for null injuries', () => {
    expect(getInjuries({ injuries: null })).toEqual([])
  })

  it('returns empty array for empty injuries', () => {
    expect(getInjuries({ injuries: [] })).toEqual([])
  })

  it('returns the injuries array when present', () => {
    const injuries: PilotInjury[] = [{ severity: 'minor', maxHpReduction: 1 }]
    expect(getInjuries({ injuries })).toBe(injuries)
  })
})

// ---------------------------------------------------------------------------
// getInjuryRollLabel / getInjuryRollDescription
// ---------------------------------------------------------------------------

describe('getInjuryRollLabel', () => {
  it('returns correct labels for all result types', () => {
    expect(getInjuryRollLabel('fatal')).toBe('Fatal Injury')
    expect(getInjuryRollLabel('major')).toBe('Major Injury')
    expect(getInjuryRollLabel('minor')).toBe('Minor Injury')
    expect(getInjuryRollLabel('unconscious')).toBe('Unconscious')
    expect(getInjuryRollLabel('miraculous')).toBe('Miraculous Survival')
  })
})

describe('getInjuryRollDescription', () => {
  it('returns non-empty description for all result types', () => {
    const results = ['fatal', 'major', 'minor', 'unconscious', 'miraculous'] as const
    for (const r of results) {
      expect(getInjuryRollDescription(r).length).toBeGreaterThan(0)
    }
  })
})

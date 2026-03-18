import { describe, it, expect } from 'bun:test'
import {
  getAbilityCost,
  getAvailableTiers,
  getClassTrees,
  countAbilitiesByTier,
  meetsPrerequisites,
  meetsNamedPrerequisites,
  getTrainableAbilities,
  hasReceivedTP,
} from './trainingUtils'
import type { TrainingReceipt } from './trainingUtils'
import type { EntityRefRow } from '../types/common'

// Class IDs from data/classes.json
const SALVAGER_ID = '6bf071e2-c1b1-4ea2-a831-354c75dd1ba2'

function makeAbilityRef(schemaRefId: string, overrides: Partial<EntityRefRow> = {}): EntityRefRow {
  return {
    id: `ref-${schemaRefId}`,
    parent_id: 'pilot-1',
    parent_type: 'pilot',
    schema_name: 'abilities',
    schema_ref_id: schemaRefId,
    condition: 'intact',
    sort_order: 0,
    metadata: null,
    user_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as EntityRefRow
}

describe('getAbilityCost', () => {
  it('returns 1 for level 1 (core)', () => {
    expect(getAbilityCost(1)).toBe(1)
  })

  it('returns 2 for level 2 (advanced/hybrid)', () => {
    expect(getAbilityCost(2)).toBe(2)
  })

  it('returns 3 for level 3 (legendary)', () => {
    expect(getAbilityCost(3)).toBe(3)
  })

  it('returns 3 for level "L" (legendary)', () => {
    expect(getAbilityCost('L')).toBe(3)
  })

  it('defaults to 1 for unknown levels', () => {
    expect(getAbilityCost(99)).toBe(1)
  })
})

describe('getAvailableTiers', () => {
  it('only includes core (1) at TL 1', () => {
    const tiers = getAvailableTiers(1)
    expect(tiers.has(1)).toBe(true)
    expect(tiers.has(2)).toBe(false)
    expect(tiers.has(3)).toBe(false)
    expect(tiers.has('L')).toBe(false)
  })

  it('only includes core (1) at TL 2', () => {
    const tiers = getAvailableTiers(2)
    expect(tiers.has(1)).toBe(true)
    expect(tiers.has(2)).toBe(false)
  })

  it('includes core and advanced at TL 3', () => {
    const tiers = getAvailableTiers(3)
    expect(tiers.has(1)).toBe(true)
    expect(tiers.has(2)).toBe(true)
    expect(tiers.has(3)).toBe(false)
  })

  it('includes core and advanced at TL 4', () => {
    const tiers = getAvailableTiers(4)
    expect(tiers.has(1)).toBe(true)
    expect(tiers.has(2)).toBe(true)
    expect(tiers.has(3)).toBe(false)
  })

  it('includes all tiers at TL 5', () => {
    const tiers = getAvailableTiers(5)
    expect(tiers.has(1)).toBe(true)
    expect(tiers.has(2)).toBe(true)
    expect(tiers.has(3)).toBe(true)
    expect(tiers.has('L')).toBe(true)
  })

  it('includes all tiers at TL 6', () => {
    const tiers = getAvailableTiers(6)
    expect(tiers.has(1)).toBe(true)
    expect(tiers.has(2)).toBe(true)
    expect(tiers.has(3)).toBe(true)
    expect(tiers.has('L')).toBe(true)
  })
})

describe('getClassTrees', () => {
  it('returns empty coreTrees for unknown class', () => {
    const result = getClassTrees('nonexistent-class-xyz')
    expect(result.coreTrees).toEqual([])
  })

  it('returns core trees for a valid class', () => {
    const result = getClassTrees(SALVAGER_ID)
    expect(result.coreTrees.length).toBeGreaterThan(0)
  })
})

describe('countAbilitiesByTier', () => {
  it('returns zeroes for empty array', () => {
    expect(countAbilitiesByTier([])).toEqual({ core: 0, advanced: 0, legendary: 0 })
  })

  it('ignores non-ability refs', () => {
    const refs = [makeAbilityRef('some-id', { schema_name: 'systems' })]
    expect(countAbilitiesByTier(refs)).toEqual({ core: 0, advanced: 0, legendary: 0 })
  })

  it('ignores unresolvable ability refs', () => {
    const refs = [makeAbilityRef('does-not-exist-xyz')]
    expect(countAbilitiesByTier(refs)).toEqual({ core: 0, advanced: 0, legendary: 0 })
  })
})

describe('meetsPrerequisites', () => {
  it('always returns true for level 1 (core)', () => {
    expect(meetsPrerequisites(1, { core: 0, advanced: 0, legendary: 0 })).toBe(true)
  })

  it('requires 6 core for level 2 (advanced)', () => {
    expect(meetsPrerequisites(2, { core: 5, advanced: 0, legendary: 0 })).toBe(false)
    expect(meetsPrerequisites(2, { core: 6, advanced: 0, legendary: 0 })).toBe(true)
    expect(meetsPrerequisites(2, { core: 10, advanced: 0, legendary: 0 })).toBe(true)
  })

  it('requires 6 core and 3 advanced for level 3 (legendary)', () => {
    expect(meetsPrerequisites(3, { core: 6, advanced: 2, legendary: 0 })).toBe(false)
    expect(meetsPrerequisites(3, { core: 5, advanced: 3, legendary: 0 })).toBe(false)
    expect(meetsPrerequisites(3, { core: 6, advanced: 3, legendary: 0 })).toBe(true)
  })

  it('requires 6 core and 3 advanced for level "L"', () => {
    expect(meetsPrerequisites('L', { core: 6, advanced: 2, legendary: 0 })).toBe(false)
    expect(meetsPrerequisites('L', { core: 6, advanced: 3, legendary: 0 })).toBe(true)
  })

  it('returns true for unknown levels', () => {
    expect(meetsPrerequisites(99, { core: 0, advanced: 0, legendary: 0 })).toBe(true)
  })
})

describe('meetsNamedPrerequisites', () => {
  it('returns true for abilities with no named prerequisites', () => {
    // "Mech-Tech" is a core ability with no entry in ability-tree-requirements
    expect(meetsNamedPrerequisites('Mech-Tech', new Set())).toBe(true)
  })

  it('blocks an ability when its named prerequisite is not learned', () => {
    // "Advanced Engineer" requires ["Mech-Tech"]
    expect(meetsNamedPrerequisites('Advanced Engineer', new Set())).toBe(false)
    expect(meetsNamedPrerequisites('Advanced Engineer', new Set(['Hacking']))).toBe(false)
  })

  it('allows an ability when its named prerequisite is learned', () => {
    // "Advanced Engineer" requires ["Mech-Tech"]
    expect(meetsNamedPrerequisites('Advanced Engineer', new Set(['Mech-Tech']))).toBe(true)
  })

  it('blocks an ability requiring multiple prerequisites when only some are met', () => {
    // "Cyborg" requires ["Augmentation", "Gladiatorial Combat"]
    expect(meetsNamedPrerequisites('Cyborg', new Set(['Augmentation']))).toBe(false)
    expect(meetsNamedPrerequisites('Cyborg', new Set(['Gladiatorial Combat']))).toBe(false)
  })

  it('allows an ability when all multiple named prerequisites are learned', () => {
    // "Cyborg" requires ["Augmentation", "Gladiatorial Combat"]
    expect(
      meetsNamedPrerequisites('Cyborg', new Set(['Augmentation', 'Gladiatorial Combat']))
    ).toBe(true)
  })

  it('allows a legendary ability when its chain is fully learned', () => {
    // "Legendary Engineer" requires ["Advanced Engineer"], which requires ["Mech-Tech"]
    expect(meetsNamedPrerequisites('Legendary Engineer', new Set(['Advanced Engineer']))).toBe(true)
  })

  it('blocks a legendary ability when intermediate chain ability is missing', () => {
    // "Legendary Engineer" requires ["Advanced Engineer"] directly
    expect(meetsNamedPrerequisites('Legendary Engineer', new Set(['Mech-Tech']))).toBe(false)
  })
})

describe('getTrainableAbilities', () => {
  it('returns abilities for a valid class at TL 1', () => {
    const abilities = getTrainableAbilities(SALVAGER_ID, 1, new Set())
    expect(abilities.length).toBeGreaterThan(0)
    // At TL 1, only core (level 1) should be available
    for (const a of abilities) {
      if ('level' in a) {
        expect(a.level).toBe(1)
      }
    }
  })

  it('excludes already-known abilities', () => {
    const all = getTrainableAbilities(SALVAGER_ID, 1, new Set())
    const firstId = all[0]!.id
    const filtered = getTrainableAbilities(SALVAGER_ID, 1, new Set([firstId]))
    expect(filtered.length).toBe(all.length - 1)
    expect(filtered.find((a) => a.id === firstId)).toBeUndefined()
  })

  it('returns empty for unknown class', () => {
    const abilities = getTrainableAbilities('nonexistent-class-xyz-00000', 3, new Set())
    expect(abilities).toEqual([])
  })

  it('includes more abilities at higher TL', () => {
    const tl1 = getTrainableAbilities(SALVAGER_ID, 1, new Set())
    const tl5 = getTrainableAbilities(SALVAGER_ID, 5, new Set())
    expect(tl5.length).toBeGreaterThanOrEqual(tl1.length)
  })
})

describe('hasReceivedTP', () => {
  it('returns false for undefined receipt', () => {
    expect(hasReceivedTP(undefined)).toBe(false)
  })

  it('returns false when tp_granted is 0', () => {
    const receipt: TrainingReceipt = {
      tp_granted: 0,
      abilities_learned: [],
      tp_remaining: 0,
    }
    expect(hasReceivedTP(receipt)).toBe(false)
  })

  it('returns true when tp_granted is positive', () => {
    const receipt: TrainingReceipt = {
      tp_granted: 3,
      abilities_learned: [],
      tp_remaining: 3,
    }
    expect(hasReceivedTP(receipt)).toBe(true)
  })
})

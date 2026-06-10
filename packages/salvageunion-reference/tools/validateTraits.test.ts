import { describe, it, expect, test } from 'bun:test'
import {
  collectTraitTypes,
  findTraitCasingIssues,
  findUnresolvableRemoveTraitIssues,
  findUnknownTraitTypes,
} from './validateTraitsLogic.js'

describe('collectTraitTypes', () => {
  it('collects trait types from a top-level traits[] array', () => {
    const entity = {
      name: 'X',
      traits: [{ type: 'heavy' }, { type: 'explosive', amount: 1 }],
    }
    expect(collectTraitTypes(entity)).toEqual(['heavy', 'explosive'])
  })

  it('collects trait types nested under actions[].traits', () => {
    const entity = {
      name: 'X',
      actions: [{ name: 'A', traits: [{ type: 'melee' }] }],
    }
    expect(collectTraitTypes(entity)).toEqual(['melee'])
  })

  it('ignores datavalue rows (they are not traits[] arrays)', () => {
    const entity = {
      name: 'X',
      content: [{ type: 'datavalues', value: [{ label: 'Heavy', type: 'trait' }] }],
    }
    expect(collectTraitTypes(entity)).toEqual([])
  })
})

describe('findTraitCasingIssues', () => {
  it('flags a capitalized trait type', () => {
    const issues = findTraitCasingIssues('equipment.json', [
      { name: 'Launcher', traits: [{ type: 'Heavy' }] },
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ entity: 'Launcher', kind: 'casing' })
    expect(issues[0]?.detail).toContain('"heavy"')
  })

  it('accepts all-lowercase trait types', () => {
    const entities = [{ name: 'OK', traits: [{ type: 'heavy' }, { type: 'anti-organic' }] }]
    expect(findTraitCasingIssues('equipment.json', entities)).toEqual([])
  })

  it('flags capitalized types nested under actions', () => {
    const entities = [{ name: 'A', actions: [{ name: 'Act', traits: [{ type: 'Melee' }] }] }]
    expect(findTraitCasingIssues('actions.json', entities)).toHaveLength(1)
  })
})

describe('findUnresolvableRemoveTraitIssues', () => {
  const choice = (effects: { op: string; value: string }[]) => ({
    choices: [
      {
        id: 'c',
        name: 'Mod',
        choiceOptions: [{ label: 'O', value: 'O', effects }],
      },
    ],
  })

  it('accepts removeTrait targeting a base trait', () => {
    const entities = [
      {
        name: 'X',
        traits: [{ type: 'heavy' }],
        ...choice([{ op: 'removeTrait', value: 'Heavy' }]),
      },
    ]
    expect(findUnresolvableRemoveTraitIssues('equipment.json', entities)).toEqual([])
  })

  it('accepts removeTrait targeting a trait added by an addTrait effect', () => {
    const entities = [
      {
        name: 'X',
        choices: [
          {
            id: 'c',
            name: 'Mod',
            choiceOptions: [
              {
                label: 'add',
                value: 'add',
                effects: [{ op: 'addTrait', value: 'Shielded' }],
              },
              {
                label: 'rm',
                value: 'rm',
                effects: [{ op: 'removeTrait', value: 'Shielded' }],
              },
            ],
          },
        ],
      },
    ]
    expect(findUnresolvableRemoveTraitIssues('equipment.json', entities)).toEqual([])
  })

  it('flags a removeTrait whose target the entity does not carry', () => {
    const entities = [
      {
        name: 'X',
        traits: [{ type: 'missile' }],
        ...choice([{ op: 'removeTrait', value: 'Heavy' }]),
      },
    ]
    const issues = findUnresolvableRemoveTraitIssues('equipment.json', entities)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      entity: 'X',
      kind: 'unresolvable-removeTrait',
    })
  })

  it('catches the original bug shape: base trait stored as a datavalue, not in traits[]', () => {
    // Heavy lives in the datavalues block (where the resolver can't see it), so a
    // removeTrait Heavy would be a silent no-op — exactly what this check guards.
    const entities = [
      {
        name: 'Custom Missile Launcher',
        content: [{ type: 'datavalues', value: [{ label: 'Heavy', type: 'trait' }] }],
        ...choice([{ op: 'removeTrait', value: 'Heavy' }]),
      },
    ]
    expect(findUnresolvableRemoveTraitIssues('equipment.json', entities)).toHaveLength(1)
  })
})

describe('findUnknownTraitTypes', () => {
  test('returns no unknown types after armor→armour fix and allowlist covers pending types', () => {
    const issues = findUnknownTraitTypes()
    expect(issues).toEqual([])
  })
})

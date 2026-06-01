import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectChoice } from 'salvageunion-reference'
import {
  getChoiceCardOptions,
  isFreeTextChoice,
  isMultiSelectChoice,
  resolveMultiSelectCap,
  toggleSelection,
} from '../choiceSelectionHelpers'

const traitChoice: SURefObjectChoice = {
  id: 'weapon-type',
  name: 'Weapon Type',
  schema: ['traits'],
  schemaEntities: ['Ballistic', 'Energy'],
}

const optionChoice: SURefObjectChoice = {
  id: 'mod',
  name: 'Modification',
  multiSelect: true,
  constraints: { scalesWithField: 'techLevel' },
  choiceOptions: [
    { label: 'Rangefinder', value: 'Rangefinder', description: 'Range to Far.' },
    { label: 'Flashy', value: 'Flashy' },
  ],
}

const freeformChoice: SURefObjectChoice = {
  id: 'name',
  name: 'Name',
  choiceType: 'freeform',
}

describe('isFreeTextChoice', () => {
  test('true for freeform choiceType', () => {
    expect(isFreeTextChoice(freeformChoice)).toBe(true)
  })
  test('true when no option source is present', () => {
    expect(isFreeTextChoice({ id: 'x', name: 'X' })).toBe(true)
  })
  test('false for schemaEntities and choiceOptions choices', () => {
    expect(isFreeTextChoice(traitChoice)).toBe(false)
    expect(isFreeTextChoice(optionChoice)).toBe(false)
  })
})

describe('isMultiSelectChoice', () => {
  test('reflects the multiSelect flag', () => {
    expect(isMultiSelectChoice(optionChoice)).toBe(true)
    expect(isMultiSelectChoice(traitChoice)).toBe(false)
  })
})

describe('getChoiceCardOptions', () => {
  test('maps choiceOptions to value/label/description', () => {
    const options = getChoiceCardOptions(optionChoice)
    expect(options).toEqual([
      { value: 'Rangefinder', label: 'Rangefinder', description: 'Range to Far.' },
      { value: 'Flashy', label: 'Flashy', description: undefined },
    ])
  })
  test('maps schemaEntities to value/label, carrying the schema', () => {
    const options = getChoiceCardOptions(traitChoice)
    expect(options).toEqual([
      { value: 'Ballistic', label: 'Ballistic', schema: 'traits' },
      { value: 'Energy', label: 'Energy', schema: 'traits' },
    ])
  })
})

describe('resolveMultiSelectCap', () => {
  test('resolves scalesWithField against the parent entity', () => {
    expect(resolveMultiSelectCap(optionChoice, { techLevel: 3 })).toBe(3)
  })
  test('prefers an explicit max', () => {
    const choice: SURefObjectChoice = {
      id: 'm',
      name: 'M',
      multiSelect: true,
      constraints: { max: 2 },
    }
    expect(resolveMultiSelectCap(choice, { techLevel: 5 })).toBe(2)
  })
  test('undefined when no constraint or field resolves', () => {
    expect(resolveMultiSelectCap(traitChoice, { techLevel: 3 })).toBeUndefined()
    expect(resolveMultiSelectCap(optionChoice, undefined)).toBeUndefined()
    expect(resolveMultiSelectCap(optionChoice, {})).toBeUndefined()
  })
})

describe('toggleSelection', () => {
  test('exclusive: selecting replaces, re-toggling clears', () => {
    expect(toggleSelection([], 'a', false)).toEqual(['a'])
    expect(toggleSelection(['a'], 'b', false)).toEqual(['b'])
    expect(toggleSelection(['a'], 'a', false)).toEqual([])
  })
  test('multi-select: adds and removes', () => {
    expect(toggleSelection(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleSelection(['a', 'b'], 'a', true)).toEqual(['b'])
  })
  test('multi-select: rejects a new value at cap', () => {
    expect(toggleSelection(['a'], 'b', true, 1)).toEqual(['a'])
  })
  test('multi-select: still allows deselect at cap', () => {
    expect(toggleSelection(['a'], 'a', true, 1)).toEqual([])
  })
})

describe('real data — Custom Sniper Rifle choices', () => {
  test('Weapon Type is exclusive trait choice, Modification is capped multi-select', () => {
    const rifle = SalvageUnionReference.Equipment.find((e) => e.name === 'Custom Sniper Rifle')
    expect(rifle).toBeTruthy()
    const choices = rifle?.choices ?? []
    const weaponType = choices.find((c) => c.name === 'Weapon Type')
    const modification = choices.find((c) => c.name === 'Modification')

    expect(weaponType).toBeTruthy()
    expect(modification).toBeTruthy()

    expect(isFreeTextChoice(weaponType as SURefObjectChoice)).toBe(false)
    expect(isMultiSelectChoice(weaponType as SURefObjectChoice)).toBe(false)
    expect(getChoiceCardOptions(weaponType as SURefObjectChoice).map((o) => o.value)).toEqual([
      'Ballistic',
      'Energy',
    ])

    expect(isMultiSelectChoice(modification as SURefObjectChoice)).toBe(true)
    // techLevel 3 → cap 3.
    expect(resolveMultiSelectCap(modification as SURefObjectChoice, rifle)).toBe(3)
  })
})

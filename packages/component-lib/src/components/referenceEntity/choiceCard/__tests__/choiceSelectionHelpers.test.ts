import { describe, expect, test } from 'bun:test'
import type { SURefObjectChoice } from 'salvageunion-reference'
import {
  getChoiceCardOptions,
  getChoiceSourceKind,
  isMultiSelectChoice,
  resolveMultiSelectCap,
  toggleSelection,
} from '../choiceSelectionHelpers'

const traitChoice: SURefObjectChoice = {
  id: 'weapon-type',
  name: 'Weapon Type',
  source: { kind: 'catalog', schema: ['traits'], entities: ['Ballistic', 'Energy'] },
}

const optionChoice: SURefObjectChoice = {
  id: 'mod',
  name: 'Modification',
  cardinality: { min: 0, max: { scalesWith: 'techLevel' } },
  source: {
    kind: 'options',
    options: [
      { label: 'Rangefinder', value: 'Rangefinder', description: 'Range to Far.' },
      { label: 'Flashy', value: 'Flashy' },
    ],
  },
}

describe('isMultiSelectChoice', () => {
  test('a scalesWith cardinality is multi-select; no cardinality is single', () => {
    expect(isMultiSelectChoice(optionChoice)).toBe(true)
    expect(isMultiSelectChoice(traitChoice)).toBe(false)
  })
  test('cardinality max:1 is single-select', () => {
    expect(isMultiSelectChoice({ ...traitChoice, cardinality: { min: 1, max: 1 } })).toBe(false)
  })
})

describe('getChoiceCardOptions', () => {
  test('maps source.options to value/label/description', () => {
    const options = getChoiceCardOptions(optionChoice)
    expect(options).toEqual([
      { value: 'Rangefinder', label: 'Rangefinder', description: 'Range to Far.' },
      { value: 'Flashy', label: 'Flashy', description: undefined },
    ])
  })
  test('maps catalog entities to value/label, carrying the schema', () => {
    const options = getChoiceCardOptions(traitChoice)
    expect(options).toEqual([
      { value: 'Ballistic', label: 'Ballistic', schema: 'traits' },
      { value: 'Energy', label: 'Energy', schema: 'traits' },
    ])
  })
})

describe('resolveMultiSelectCap', () => {
  test('resolves cardinality.max.scalesWith against the parent entity', () => {
    expect(resolveMultiSelectCap(optionChoice, { techLevel: 3 })).toBe(3)
  })
  test('a fixed max above one is the cap', () => {
    const choice: SURefObjectChoice = { id: 'm', name: 'M', cardinality: { min: 0, max: 2 } }
    expect(resolveMultiSelectCap(choice, { techLevel: 5 })).toBe(2)
  })
  test('undefined when no cardinality or field resolves', () => {
    expect(resolveMultiSelectCap(traitChoice, { techLevel: 3 })).toBeUndefined()
    expect(
      resolveMultiSelectCap({ ...traitChoice, cardinality: { min: 1, max: 1 } }, undefined)
    ).toBeUndefined()
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

// The discriminant the renderer switches on. A table choice (A.I. Personality)
// is NOT free-text, so it does not render as a bare input.
describe('getChoiceSourceKind — the discriminated source', () => {
  const bySource = (source: SURefObjectChoice['source']): SURefObjectChoice => ({
    id: 'x',
    name: 'X',
    source,
  })

  test('reads source.kind', () => {
    expect(getChoiceSourceKind(bySource({ kind: 'text' }))).toBe('text')
    expect(getChoiceSourceKind(bySource({ kind: 'table', rollTable: 'A.I. Personality' }))).toBe(
      'table'
    )
    expect(getChoiceSourceKind(bySource({ kind: 'options', options: [] }))).toBe('options')
    expect(getChoiceSourceKind(bySource({ kind: 'catalog', schema: ['systems'] }))).toBe('catalog')
    expect(getChoiceSourceKind(bySource({ kind: 'systemVariant', options: [] }))).toBe(
      'systemVariant'
    )
  })

  test('a choice without a source is free text', () => {
    expect(getChoiceSourceKind({ id: 'n', name: 'Name' })).toBe('text')
  })
})

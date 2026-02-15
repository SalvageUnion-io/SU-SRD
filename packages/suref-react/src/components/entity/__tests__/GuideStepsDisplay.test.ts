import { describe, it, expect } from 'bun:test'
import { getStepNumbers, matchesFilter } from '../guideStepsHelpers'
import type { SURefObjectGuideStep } from 'salvageunion-reference'

/** Helper to create a minimal step for testing */
function makeStep(overrides: Partial<SURefObjectGuideStep> = {}): SURefObjectGuideStep {
  return {
    id: 'test-step',
    name: 'Test Step',
    stepType: 'info',
    ...overrides,
  }
}

describe('getStepNumbers', () => {
  it('should number steps sequentially starting from 1', () => {
    const steps = [makeStep(), makeStep(), makeStep()]
    expect(getStepNumbers(steps)).toEqual([1, 2, 3])
  })

  it('should reset numbering when a step has a section', () => {
    const steps = [
      makeStep(),
      makeStep(),
      makeStep({ section: 'New Section' }),
      makeStep(),
      makeStep(),
    ]
    expect(getStepNumbers(steps)).toEqual([1, 2, 1, 2, 3])
  })

  it('should reset numbering at multiple sections', () => {
    const steps = [
      makeStep({ section: 'Section A' }),
      makeStep(),
      makeStep({ section: 'Section B' }),
      makeStep(),
      makeStep({ section: 'Section C' }),
    ]
    expect(getStepNumbers(steps)).toEqual([1, 2, 1, 2, 1])
  })

  it('should handle single step', () => {
    expect(getStepNumbers([makeStep()])).toEqual([1])
  })

  it('should handle empty array', () => {
    expect(getStepNumbers([])).toEqual([])
  })

  it('should count section step itself as step 1', () => {
    const steps = [makeStep({ section: 'First Section' })]
    expect(getStepNumbers(steps)).toEqual([1])
  })
})

describe('matchesFilter', () => {
  it('should return true when the field does not exist on the entity', () => {
    const entity = { name: 'Test' }
    const filter = { field: 'missing', value: 'anything' }
    expect(matchesFilter(entity, filter)).toBe(true)
  })

  it('should return true when field value matches exact value', () => {
    const entity = { hybrid: false }
    const filter = { field: 'hybrid', value: false }
    expect(matchesFilter(entity, filter)).toBe(true)
  })

  it('should return false when field value does not match exact value', () => {
    const entity = { hybrid: true }
    const filter = { field: 'hybrid', value: false }
    expect(matchesFilter(entity, filter)).toBe(false)
  })

  it('should match string values', () => {
    const entity = { guideType: 'character-creation' }
    expect(matchesFilter(entity, { field: 'guideType', value: 'character-creation' })).toBe(true)
    expect(matchesFilter(entity, { field: 'guideType', value: 'downtime' })).toBe(false)
  })

  it('should match numeric values', () => {
    const entity = { techLevel: 3 }
    expect(matchesFilter(entity, { field: 'techLevel', value: 3 })).toBe(true)
    expect(matchesFilter(entity, { field: 'techLevel', value: 2 })).toBe(false)
  })

  it('should check min range', () => {
    const entity = { techLevel: 3 }
    expect(matchesFilter(entity, { field: 'techLevel', min: 1 })).toBe(true)
    expect(matchesFilter(entity, { field: 'techLevel', min: 3 })).toBe(true)
    expect(matchesFilter(entity, { field: 'techLevel', min: 4 })).toBe(false)
  })

  it('should check max range', () => {
    const entity = { techLevel: 3 }
    expect(matchesFilter(entity, { field: 'techLevel', max: 5 })).toBe(true)
    expect(matchesFilter(entity, { field: 'techLevel', max: 3 })).toBe(true)
    expect(matchesFilter(entity, { field: 'techLevel', max: 2 })).toBe(false)
  })

  it('should check min and max together', () => {
    const entity = { techLevel: 3 }
    expect(matchesFilter(entity, { field: 'techLevel', min: 1, max: 5 })).toBe(true)
    expect(matchesFilter(entity, { field: 'techLevel', min: 3, max: 3 })).toBe(true)
    expect(matchesFilter(entity, { field: 'techLevel', min: 4, max: 6 })).toBe(false)
    expect(matchesFilter(entity, { field: 'techLevel', min: 1, max: 2 })).toBe(false)
  })

  it('should fail min check when field is not a number', () => {
    const entity = { name: 'test' }
    expect(matchesFilter(entity, { field: 'name', min: 1 })).toBe(false)
  })

  it('should fail max check when field is not a number', () => {
    const entity = { name: 'test' }
    expect(matchesFilter(entity, { field: 'name', max: 10 })).toBe(false)
  })
})

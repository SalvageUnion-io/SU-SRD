import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide } from 'salvageunion-reference'
import { getDigitalSteps } from './pilotUtils'

// Test that all the guides used by the 4 components can be resolved
// This verifies the guide resolution logic that will be moved into useMemo

describe('Guide Resolution (for refactored components)', () => {
  test('downtime guide can be resolved by ID', () => {
    const downtimeGuide = SalvageUnionReference.Guides.find(
      (g) => g.id === '5b57c66c-ad03-4184-b081-366c98c44fbe'
    )! as SURefGuide

    expect(downtimeGuide).toBeTruthy()
    expect(downtimeGuide.name).toBe('Crawler Downtime')
    expect(downtimeGuide.steps).toBeTruthy()
    expect(downtimeGuide.steps.length).toBeGreaterThan(0)
  })

  test('crawler guide can be resolved by name', () => {
    const crawlerGuide = SalvageUnionReference.Guides.find(
      (g) => g.name === 'Create a Crawler'
    )! as SURefGuide

    expect(crawlerGuide).toBeTruthy()
    expect(crawlerGuide.steps).toBeTruthy()

    // Verify digital steps can be computed
    const digitalSteps = getDigitalSteps(crawlerGuide)
    expect(digitalSteps.length).toBeGreaterThan(0)
    expect(digitalSteps.every((s) => !s.paperOnly)).toBe(true)

    // Verify derived values can be computed
    const crawlerTypeStep = digitalSteps.find(
      (s) => s.stepType === 'select-one' && s.schema?.[0] === 'crawlers'
    )
    expect(crawlerTypeStep).toBeTruthy()

    const npcStep = digitalSteps.find(
      (s) => s.stepType === 'freeform' && s.schema?.[0] === 'crawler-bays'
    )
    expect(npcStep).toBeTruthy()

    // Verify interactive guide can be created
    const interactiveGuide = { ...crawlerGuide, steps: digitalSteps } as SURefGuide
    expect(interactiveGuide.steps).toEqual(digitalSteps)
  })

  test('mech guide can be resolved by name', () => {
    const mechGuide = SalvageUnionReference.Guides.find(
      (g) => g.name === 'Create a Mech'
    )! as SURefGuide

    expect(mechGuide).toBeTruthy()
    expect(mechGuide.steps).toBeTruthy()

    // Verify digital steps can be computed
    const mechDigitalSteps = getDigitalSteps(mechGuide)
    expect(mechDigitalSteps.length).toBeGreaterThan(0)
    expect(mechDigitalSteps.every((s) => !s.paperOnly)).toBe(true)

    // Verify interactive guide can be created
    const interactiveMechGuide = { ...mechGuide, steps: mechDigitalSteps } as SURefGuide
    expect(interactiveMechGuide.steps).toEqual(mechDigitalSteps)
  })

  test('pilot guide can be resolved by name', () => {
    const pilotGuide = SalvageUnionReference.Guides.find(
      (g) => g.name === 'Create a Pilot'
    )! as SURefGuide

    expect(pilotGuide).toBeTruthy()
    expect(pilotGuide.steps).toBeTruthy()

    // Verify digital steps can be computed
    const digitalSteps = getDigitalSteps(pilotGuide)
    expect(digitalSteps.length).toBeGreaterThan(0)
    expect(digitalSteps.every((s) => !s.paperOnly)).toBe(true)

    // Verify interactive guide can be created
    const interactiveGuide = { ...pilotGuide, steps: digitalSteps } as SURefGuide
    expect(interactiveGuide.steps).toEqual(digitalSteps)
  })
})

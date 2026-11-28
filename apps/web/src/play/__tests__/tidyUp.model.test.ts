import { describe, expect, test } from 'bun:test'
import { tidyPlan, trayRowDown } from '../tidyUp.model'

const WORDS = {
  endEncounter: (name: string) => `End ${name}`,
  clearTheDowned: 'Clear the downed',
  clearTheField: (n: number) => `Clear the field (${n} still standing)`,
  endConditions: (names: string) => `End ${names}`,
}

describe('the one tidy step between phases (r6 C2)', () => {
  test('a fight that is over ticks every box: the encounter, the downed and the storm', () => {
    const plan = tidyPlan(
      { running: 'Ambush at the Pylon', field: [true, true], conditions: 'Radiation Storm' },
      WORDS
    )
    expect(plan.choices.map((c) => c.label)).toEqual([
      'End Ambush at the Pylon',
      'Clear the downed',
      'End Radiation Storm',
    ])
    expect(plan.ticked).toEqual(['encounter', 'field', 'scene'])
  })

  test('one still standing leaves every box unticked, and says how many stand', () => {
    const plan = tidyPlan({ running: 'Ambush', field: [true, false], conditions: '' }, WORDS)
    expect(plan.choices.map((c) => c.label)).toEqual([
      'End Ambush',
      'Clear the field (1 still standing)',
    ])
    expect(plan.ticked).toEqual([])
  })

  test('with no fight there is nothing to ask', () => {
    expect(tidyPlan({ running: null, field: [], conditions: 'Freezing' }, WORDS).choices).toEqual(
      []
    )
  })

  test('a tray row is down at 0 HP; unset HP is full; no maximum, never down', () => {
    expect(trayRowDown({ maxHp: 6, currentHp: 0 })).toBe(true)
    expect(trayRowDown({ maxHp: 6 })).toBe(false)
    expect(trayRowDown({ currentHp: 0 })).toBe(false)
  })
})

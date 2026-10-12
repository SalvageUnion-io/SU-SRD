import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import { dieForTable, rollD20 } from '../dice'

/** Randsum's roller draws `Math.floor(Math.random() * 20) + 1`: pin the face. */
const face = (value: number) => spyOn(Math, 'random').mockReturnValue((value - 1) / 20)

afterEach(() => {
  mock.restore()
})

describe('dieForTable', () => {
  test("a named table rolls through @randsum/salvageunion, as /su roll's typed name", async () => {
    const die = await dieForTable('core mechanic')
    expect(die).not.toBe(rollD20)
    face(14)
    const total = die()
    expect(total).toBe(14)
    // The reply's row is read from our data with that total.
    const table = SalvageUnionReference.RollTables.getByName('Core Mechanic')?.table
    const outcome = rollOnTable(table, () => total)
    expect(outcome.success && outcome.kind === 'flat' ? outcome.key : null).toBe('11-19')
  })

  test("an entity's table gets Randsum's plain d20", async () => {
    expect(await dieForTable('Bio-Talon')).toBe(rollD20)
    expect(await dieForTable('No Such Table')).toBe(rollD20)
  })

  test('rollD20 lands on every face', () => {
    for (let value = 1; value <= 20; value++) {
      face(value)
      expect(rollD20()).toBe(value)
    }
  })
})

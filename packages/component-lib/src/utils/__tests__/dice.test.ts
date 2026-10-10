/**
 * The dice: @randsum/salvageunion for a named table, @randsum/roller for the
 * rest — and proof the root `overrides` left one copy of each dependency.
 *
 * Randsum's roller draws from `Math.random` (`Math.floor(r * sides) + 1`), so
 * pinning it to `(face - 1) / sides` makes every roll here a chosen face.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { rollTable, SALVAGE_UNION_TABLE_NAMES } from '@randsum/salvageunion'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import { d20ForTable, rollD20, rollDie, rollForTable } from '../dice'

/** Make Randsum's next d20s land on these faces, in order. */
function faces(...values: number[]) {
  const queue = [...values]
  return spyOn(Math, 'random').mockImplementation(() => ((queue.shift() ?? 1) - 1) / 20)
}

afterEach(() => {
  mock.restore()
})

const tableOf = (name: string) => {
  const table = SalvageUnionReference.RollTables.getByName(name)?.table
  if (!table) throw new Error(`fixture missing: ${name}`)
  return table
}

describe('@randsum/salvageunion', () => {
  test('names the eighteen core tables, read from the workspace data', () => {
    expect([...SALVAGE_UNION_TABLE_NAMES]).toEqual([
      'Core Mechanic',
      'Group Initiative',
      'Critical Injury',
      'Critical Damage',
      'Reactor Overload',
      'Area Salvage',
      'Mech Salvage',
      'Reaction Roll',
      'Meteor Encounter',
      'Harvesting Chimerium',
      'Chimerium Exposure',
      'Chimerium Mutation',
      'NPC Action',
      'Morale',
      'Retreat',
      'Crawler Deterioration',
      'Crawler Damage',
      'Crawler Destruction',
    ])
  })

  test('reads the one, live copy of salvageunion-reference', () => {
    // Identity, not equality: a second copy (its npm 2.3.5) would hand back
    // its own table object, and this workspace's preload would not reach it.
    for (const name of SALVAGE_UNION_TABLE_NAMES) {
      expect(rollTable(name).result.table).toBe(tableOf(name))
    }
  })

  test("its row is rollOnTable's row for the same total, on every face of every table", () => {
    for (const name of SALVAGE_UNION_TABLE_NAMES) {
      for (let face = 1; face <= 20; face++) {
        faces(face)
        const rolled = rollTable(name)
        const outcome = rollOnTable(tableOf(name), () => rolled.total)
        expect(rolled.total).toBe(face)
        if (!outcome.success || outcome.kind !== 'flat') throw new Error(`${name} ${face}`)
        expect(rolled.result.key).toBe(outcome.key)
        expect(rolled.result.label).toBe(outcome.label ?? outcome.value)
      }
    }
  })
})

describe('d20ForTable', () => {
  test("a named table's die is rollTable's total", async () => {
    const die = await d20ForTable('Morale')
    faces(17)
    expect(die()).toBe(17)
    expect(die).not.toBe(rollD20)
  })

  test("any other table's die is Randsum's plain d20", async () => {
    expect(await d20ForTable('Aardvarks Tongue')).toBe(rollD20)
    expect(await d20ForTable('Callsign Table')).toBe(rollD20)
  })
})

describe('rollForTable', () => {
  test('rolls its d20s on the table and any other die plain', async () => {
    const roll = await rollForTable('Crawler Deterioration')
    faces(3, 9)
    expect(roll(20)).toBe(3)
    expect(roll(20)).toBe(9)
    const bay = roll(4)
    expect(bay).toBeGreaterThanOrEqual(1)
    expect(bay).toBeLessThanOrEqual(4)
  })

  test('keeps the leading plain d20s off the table', async () => {
    const roll = await rollForTable('Reactor Overload', { plainD20s: 1 })
    faces(12, 6)
    expect(roll(20)).toBe(12)
    expect(roll(20)).toBe(6)
  })
})

describe('rollDie', () => {
  test('shows every face of the die and nothing else', () => {
    const seen = new Set<number>()
    for (let face = 1; face <= 6; face++) {
      spyOn(Math, 'random').mockReturnValue((face - 1) / 6)
      seen.add(rollDie(6))
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6])
  })
})

import { describe, expect, test } from 'bun:test'
import { digestRollTable, withNothingHappens } from '../digestRollTable'

describe('withNothingHappens — a lone 20 gets the rest of the die (round 4)', () => {
  test('a table printing only its 20 reads "Nothing happens." on 1–19', () => {
    const table = withNothingHappens({ type: 'standard', '20': { value: 'Blinded.' } } as never)
    expect(table).toMatchObject({
      '1-19': { value: 'Nothing happens.' },
      '20': { value: 'Blinded.' },
    })
    expect(digestRollTable(table).map((row) => row.key)).toEqual(['20', '1-19'])
  })

  test('every other table comes back as it is', () => {
    const banded = { type: 'standard', '20': { value: 'A' }, '1-19': { value: 'B' } } as never
    expect(withNothingHappens(banded)).toBe(banded)
    const columns = { type: 'columns' } as never
    expect(withNothingHappens(columns)).toBe(columns)
  })
})

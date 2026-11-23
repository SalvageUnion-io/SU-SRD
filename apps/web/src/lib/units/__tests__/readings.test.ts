import { describe, expect, test } from 'bun:test'
import { downReading } from '../readings'

describe('downReading (r6 C6)', () => {
  test('0 SP is Down and needs repair', () => {
    expect(downReading([{ label: 'SP', value: '0/15' }])).toEqual([
      { label: 'Down', value: 'needs repair', chip: 'state' },
    ])
  })
  test('0 HP is Down', () => {
    expect(downReading([{ label: 'HP', value: '0/10' }])).toEqual([
      { label: 'Down', value: '', chip: 'state' },
    ])
  })
  test('a unit with something left, or no max, is not Down', () => {
    expect(downReading([{ label: 'SP', value: '10/15' }])).toEqual([])
    expect(downReading([{ label: 'HP', value: '0/0' }])).toEqual([])
    expect(downReading([{ label: 'EP', value: '0/6' }])).toEqual([])
  })
})

/** Two copies, two conditions (r6 E16). */
import { describe, expect, test } from 'bun:test'
import { copiesOf, copyCondition, withCopyCondition } from '../equipmentCopies'

const IMW = 'improvised-melee-weapon'

describe('equipment copies keep their own condition', () => {
  test('marking one copy Damaged leaves the other Intact', () => {
    const map = withCopyCondition(undefined, IMW, 1, 2, 'damaged')
    expect(copyCondition(map, IMW, 1, 2)).toBe('damaged')
    expect(copyCondition(map, IMW, 2, 2)).toBe('intact')
    const next = withCopyCondition(map, IMW, 2, 2, 'destroyed')
    expect(copyCondition(next, IMW, 1, 2)).toBe('damaged')
    expect(copyCondition(next, IMW, 2, 2)).toBe('destroyed')
  })

  test('an older shared condition reads for each copy, and the first change splits the pair', () => {
    const old = { [IMW]: 'damaged' as const }
    expect(copyCondition(old, IMW, 1, 2)).toBe('damaged')
    expect(copyCondition(old, IMW, 2, 2)).toBe('damaged')
    const split = withCopyCondition(old, IMW, 2, 2, 'destroyed')
    expect(split).toEqual({ [`${IMW}#1`]: 'damaged', [`${IMW}#2`]: 'destroyed' })
  })

  test('an item carried once stays keyed by its slug', () => {
    expect(withCopyCondition({ rope: 'intact' }, IMW, 1, 1, 'damaged')).toEqual({
      rope: 'intact',
      [IMW]: 'damaged',
    })
  })

  test('a list numbers each slug’s copies', () => {
    expect(copiesOf([IMW, 'rope', IMW])).toEqual([
      { slug: IMW, copy: 1, count: 2 },
      { slug: 'rope', copy: 1, count: 1 },
      { slug: IMW, copy: 2, count: 2 },
    ])
  })
})

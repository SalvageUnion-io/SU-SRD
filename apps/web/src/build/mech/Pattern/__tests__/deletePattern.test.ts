/** Deleting a pattern names the mechs built from it (r3 G3). */
import { beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture } from '../../../../components/__tests__/fixtures'
import { resetStores } from '../../../../replica/__tests__/resetStores'
import { useUnits } from '../../../../replica/units'
import { deletePatternLines } from '../buildConfirm.model'

beforeEach(() => {
  resetStores()
})

describe('deletePatternLines', () => {
  test('counts the mechs built from it and says they keep their loadout', async () => {
    const { adopt } = useUnits.getState()
    await adopt('mech', mechFixture({ id: 'm1', sourcePattern: 'p1' }))
    await adopt('mech', mechFixture({ id: 'm2', sourcePattern: 'p1' }))
    await adopt('mech', mechFixture({ id: 'm3', sourcePattern: 'p2' }))
    await adopt('mech', mechFixture({ id: 'm4' }))
    expect(deletePatternLines('p1')).toEqual([
      '2 Mechs were built from this pattern. They keep their loadout.',
      'The pattern’s page, and any link shared to it, stops working.',
    ])
    expect(deletePatternLines('p2')[0]).toBe(
      '1 Mech was built from this pattern. It keeps its loadout.'
    )
  })

  test('with none built it says only that the page goes', () => {
    expect(deletePatternLines('p9')).toEqual([
      'The pattern’s page, and any link shared to it, stops working.',
    ])
  })
})

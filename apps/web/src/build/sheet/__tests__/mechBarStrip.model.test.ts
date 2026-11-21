/** The mech sheet's sticky bar (r2 G7): the build's figures in Edit, the table's otherwise. */
import { describe, expect, test } from 'bun:test'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { mechBarStrip } from '../mechBarStrip.model'

const mech = mechFixture({ id: 'm-bar', chassisRef: 'mule' })
const vitals = [{ key: 'sp', label: 'SP', value: 5, max: 5 }]
const cargo = { value: 0, max: 6 }

describe('mechBarStrip', () => {
  test('in Edit it reads slots and Scrap, then Cargo', () => {
    const strip = mechBarStrip({ building: true, mech, vitals, cargo })
    expect(strip.map((item) => item.key)).toEqual(['systemSlots', 'moduleSlots', 'scrap', 'cargo'])
    expect(strip[2]?.value).toBeGreaterThan(0)
    expect(strip[0]?.max).toBeGreaterThan(0)
  })

  test('otherwise it reads the table’s numbers, and what it carries is Cargo', () => {
    const strip = mechBarStrip({ building: false, mech, vitals, cargo })
    expect(strip.map((item) => item.key)).toEqual(['sp', 'cargo'])
    expect(strip[1]?.label).toBe('Cargo')
  })
})

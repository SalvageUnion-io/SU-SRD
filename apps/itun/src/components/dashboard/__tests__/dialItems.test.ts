/**
 * Unit tests for dialItems — the Dial's item list from the entity graph.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import { dialItems } from '../dialItems'
import { crawlerFixture, mechFixture, pilotFixture } from '../../__tests__/fixtures'

const mech = mechFixture({ id: 'm1', name: 'Iron Mongrel', chassisRef: 'x' })
const pilot = pilotFixture({ id: 'p1', name: 'Vesh' })
const crawler = crawlerFixture({ id: 'c1', name: 'Union Hauler', techLevel: '3' })

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('dialItems', () => {
  test('boarded: Actions, the counterpart pilot, crawler, Tables, SRD', () => {
    const items = dialItems({ mount: 'mech', mech, pilot, crawler })
    expect(items.map((i) => i.label)).toEqual([
      'Actions',
      'Pilot · Vesh',
      'Crawler · Union Hauler',
      'Tables',
      'SRD Explorer',
    ])
    expect(items[0]?.statless).toBe(true)
  })

  test('on foot: the counterpart is the mech', () => {
    const items = dialItems({ mount: 'pilot', mech, pilot, crawler })
    expect(items.map((i) => i.label)).toContain('Mech · Iron Mongrel')
    expect(items.map((i) => i.label)).not.toContain('Pilot · Vesh')
  })

  test('omits the crawler when none is linked', () => {
    const items = dialItems({ mount: 'mech', mech, pilot, crawler: null })
    expect(items.some((i) => i.label.startsWith('Crawler'))).toBe(false)
  })

  test('a mech with no stored Heat reads 0, not Heat-at-capacity', () => {
    const fresh = mechFixture({ id: 'm2', name: 'Fresh Rig', chassisRef: 'Mule' })
    expect(fresh.currentHeat).toBeUndefined()
    const item = dialItems({ mount: 'pilot', mech: fresh, pilot, crawler: null }).find(
      (i) => i.label === 'Mech · Fresh Rig'
    )
    if (!item || item.statless) throw new Error('expected a statful mech dial item')
    const heat = item.gauges.find((g) => g.label === 'Heat')
    expect(heat?.max).toBeGreaterThan(0)
    expect(heat?.value).toBe(0)
  })

  test('statless views carry no gauges', () => {
    const items = dialItems({ mount: 'mech', mech, pilot: null, crawler: null })
    const actions = items.find((i) => i.label === 'Actions')
    expect(actions?.statless).toBe(true)
  })
})

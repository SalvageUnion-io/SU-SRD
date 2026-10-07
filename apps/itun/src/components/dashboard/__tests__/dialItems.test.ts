/**
 * Unit tests for dialItems — the Dial's item list from the entity graph.
 */

import { describe, expect, test } from 'bun:test'
import { crawlerFixture, mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { dialItems } from '../dialItems'

const mech = mechFixture({ id: 'm1', name: 'Iron Mongrel', chassisRef: 'x' })
const pilot = pilotFixture({ id: 'p1', name: 'Vesh' })
const crawler = crawlerFixture({ id: 'c1', name: 'Union Hauler', techLevel: '3' })

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

  test("the pilot's max HP/AP follow the linked crawler's tech level", () => {
    const fresh = pilotFixture({ id: 'p2', name: 'Kest' })
    const gaugesFor = (c: typeof crawler | null) => {
      const item = dialItems({ mount: 'mech', mech, pilot: fresh, crawler: c }).find(
        (i) => i.label === 'Pilot · Kest'
      )
      if (!item || item.statless) throw new Error('expected a statful pilot dial item')
      return item.gauges
    }
    // Tech 3 crawler: 10 + 4 HP, 5 + 2 AP, with the tier as its own line.
    const [hp, ap] = gaugesFor(crawler)
    expect(hp?.max).toBe(14)
    expect(ap?.max).toBe(7)
    expect(hp?.provenance).toContainEqual(
      expect.objectContaining({ label: 'Crawler Tech 3', amount: 4 })
    )
    // No crawler and no manual level: Tech 1 base.
    const [hp1, ap1] = gaugesFor(null)
    expect(hp1?.max).toBe(10)
    expect(ap1?.max).toBe(5)
  })

  test('statless views carry no gauges', () => {
    const items = dialItems({ mount: 'mech', mech, pilot: null, crawler: null })
    const actions = items.find((i) => i.label === 'Actions')
    expect(actions?.statless).toBe(true)
  })

  test('a pin the crawler tier caught up with is not an override on the dial', () => {
    // Pinned 14 at Tech 1; the Tech 3 crawler now derives 14 — a +0 pin. The
    // marker and the ledger read the same flag, so neither says "override".
    const pinned = pilotFixture({ id: 'p3', name: 'Ora', maxHpOverride: 14 })
    const item = dialItems({ mount: 'mech', mech, pilot: pinned, crawler }).find(
      (i) => i.label === 'Pilot · Ora'
    )
    if (!item || item.statless) throw new Error('expected a statful pilot dial item')
    const hp = item.gauges.find((g) => g.label === 'HP')
    expect(hp?.max).toBe(14)
    expect(hp?.breakdown?.overridden).toBe(false)
    expect(hp?.provenance?.some((line) => line.kind === 'override')).toBe(false)

    // At Tech 4 the same pin is −2 against the derivation, and both agree it is.
    const tech4 = crawlerFixture({ id: 'c4', name: 'Bigger Hauler', techLevel: '4' })
    const after = dialItems({ mount: 'mech', mech, pilot: pinned, crawler: tech4 }).find(
      (i) => i.label === 'Pilot · Ora'
    )
    if (!after || after.statless) throw new Error('expected a statful pilot dial item')
    const hp4 = after.gauges.find((g) => g.label === 'HP')
    expect(hp4?.max).toBe(14)
    expect(hp4?.breakdown?.overridden).toBe(true)
    expect(hp4?.provenance?.some((line) => line.kind === 'override')).toBe(true)
  })
})

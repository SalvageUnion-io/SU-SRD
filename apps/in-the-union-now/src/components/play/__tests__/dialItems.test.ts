/**
 * Unit tests for dialItems — the Dial's item list from the entity graph.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { dialItems } from '../dialItems'

const mech = {
  id: 'm1',
  name: 'Iron Mongrel',
  chassisRef: 'x',
  systems: [],
  modules: [],
} as unknown as Mech
const pilot = { id: 'p1', name: 'Vesh', abilities: [], conditions: [] } as unknown as Pilot
const crawler = { id: 'c1', name: 'Union Hauler', techLevel: '3' } as unknown as Crawler

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

  test('statless views carry no gauges', () => {
    const items = dialItems({ mount: 'mech', mech, pilot: null, crawler: null })
    const actions = items.find((i) => i.label === 'Actions')
    expect(actions?.statless).toBe(true)
  })
})

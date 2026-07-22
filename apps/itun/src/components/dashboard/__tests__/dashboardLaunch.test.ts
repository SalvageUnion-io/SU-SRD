/**
 * dashboardLaunch tests (Dashboard Phase 9 follow-ups, plan §8/§10.5).
 *
 * Exercises the two previously-deferred chooser create paths against the real
 * entityStore (fake-indexeddb via bunfig): a stand-in mech from a pattern, and
 * a default base crawler of a Tech Level. ORM preloaded for chassis/bay lookups.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import type { MechPattern } from '../../../lib/schemas/pattern'
import { useEntityStore } from '../../../stores/entityStore'
import {
  createBaseCrawler,
  instantiateMechFromPattern,
  parseSelToken,
  patternToken,
  tlCrawlerToken,
  type LaunchStore,
} from '../dashboardLaunch'

const pattern: MechPattern = {
  id: 'pat-1',
  schemaVersion: 1,
  name: 'Iron Frame',
  chassisRef: 'titan',
  systems: ['auto-cannon'],
  modules: [],
  cargoLots: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
  await Promise.all([
    useEntityStore.getState().hydrate('mech'),
    useEntityStore.getState().hydrate('crawler'),
  ])
})

afterEach(async () => {
  await _clearAllStores()
})

const store = (): LaunchStore => useEntityStore.getState()

describe('selection tokens', () => {
  test('encode/decode round-trip', () => {
    expect(parseSelToken(patternToken('pat-1'))).toEqual({ kind: 'pattern', value: 'pat-1' })
    expect(parseSelToken(tlCrawlerToken(3))).toEqual({ kind: 'tl', value: '3' })
    expect(parseSelToken('mech-abc')).toEqual({ kind: 'id', value: 'mech-abc' })
  })
})

describe('instantiateMechFromPattern', () => {
  test('creates a stand-in mech seeded from the pattern', async () => {
    const id = await instantiateMechFromPattern(store(), pattern)
    const mech = useEntityStore.getState().get('mech', id)
    expect(mech).toBeTruthy()
    expect(mech?.name).toBe('Iron Frame (stand-in)')
    expect(mech?.chassisRef).toBe('titan')
    expect(mech?.systems).toEqual(['auto-cannon'])
    expect(mech?.currentHeat).toBe(0)
  })
})

describe('createBaseCrawler', () => {
  test('creates a valid base crawler at the given Tech Level with seeded bays', async () => {
    const id = await createBaseCrawler(store(), 3)
    const crawler = useEntityStore.getState().get('crawler', id)
    expect(crawler).toBeTruthy()
    expect(crawler?.name).toBe('Base Crawler (TL 3)')
    expect(crawler?.techLevel).toBe('3')
    // Official sheets pre-print the base bays.
    expect(crawler?.crawlerBays?.length ?? 0).toBeGreaterThan(0)
  })
})

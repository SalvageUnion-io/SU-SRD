/**
 * Tests for resolveSheetComposition — the ported SoftLink composition-mode
 * resolver (plan 4.0). Pure-function tests: snapshot lookups, full link list.
 */

import { describe, expect, test } from 'bun:test'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { makeEntityLookupMock } from '../../__tests__/mockEntityStore'
import type { EntityLookup } from '../composition'
import { resolveSheetComposition } from '../composition'

const now = FIXTURE_NOW

const pilot: Pilot = {
  id: 'p1',
  schemaVersion: 1,
  name: 'Vex',
  callsign: 'VX',
  classRef: 'engineer',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  createdAt: now,
  updatedAt: now,
}

const pilot2: Pilot = { ...pilot, id: 'p2', name: 'Rook' }

const mech: Mech = {
  id: 'm1',
  schemaVersion: 1,
  name: 'Mongrel',
  chassisRef: 'none',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  createdAt: now,
  updatedAt: now,
}

const crawler: Crawler = {
  id: 'c1',
  schemaVersion: 1,
  name: 'Kettle',
  techLevel: 'tech-3',
  systems: [],
  createdAt: now,
  updatedAt: now,
}

function lookup(entities: Array<Pilot | Mech | Crawler>): EntityLookup {
  return makeEntityLookupMock(entities)
}

function link(id: string, type: SoftLink['type'], fromId: string, toId: string): SoftLink {
  const [fromType, toType] =
    type === 'mech-to-pilot' ? (['mech', 'pilot'] as const) : (['pilot', 'crawler'] as const)
  return {
    id,
    type,
    from: { type: fromType, id: fromId },
    to: { type: toType, id: toId },
    createdAt: now,
  }
}

describe('resolveSheetComposition — only modes', () => {
  test('pilot with no links → pilot-only', () => {
    const c = resolveSheetComposition({
      kind: 'pilot',
      id: 'p1',
      links: [],
      store: lookup([pilot]),
    })
    expect(c.mode).toBe('pilot-only')
    expect(c.pilot?.name).toBe('Vex')
    expect(c.mech).toBeNull()
    expect(c.crawler).toBeNull()
  })

  test('mech with no links → mech-only', () => {
    const c = resolveSheetComposition({
      kind: 'mech',
      id: 'm1',
      links: [],
      store: lookup([mech]),
    })
    expect(c.mode).toBe('mech-only')
    expect(c.mech?.name).toBe('Mongrel')
    expect(c.pilot).toBeNull()
  })

  test('crawler with no links → crawler-only', () => {
    const c = resolveSheetComposition({
      kind: 'crawler',
      id: 'c1',
      links: [],
      store: lookup([crawler]),
    })
    expect(c.mode).toBe('crawler-only')
    expect(c.crawler?.name).toBe('Kettle')
    expect(c.crawlerPilots).toEqual([])
  })
})

describe('resolveSheetComposition — wired one-hop', () => {
  test('mech with pilot link resolves the pilot', () => {
    const c = resolveSheetComposition({
      kind: 'mech',
      id: 'm1',
      links: [link('l1', 'mech-to-pilot', 'm1', 'p1')],
      store: lookup([mech, pilot]),
    })
    expect(c.mode).toBe('wired')
    expect(c.pilot?.id).toBe('p1')
    expect(c.crawler).toBeNull()
  })

  test('pilot resolves incoming mech and outgoing crawler', () => {
    const c = resolveSheetComposition({
      kind: 'pilot',
      id: 'p1',
      links: [link('l1', 'mech-to-pilot', 'm1', 'p1'), link('l2', 'pilot-to-crawler', 'p1', 'c1')],
      store: lookup([pilot, mech, crawler]),
    })
    expect(c.mode).toBe('wired')
    expect(c.mech?.id).toBe('m1')
    expect(c.crawler?.id).toBe('c1')
  })

  test('crawler resolves every wired pilot, first is the lead', () => {
    const c = resolveSheetComposition({
      kind: 'crawler',
      id: 'c1',
      links: [
        link('l1', 'pilot-to-crawler', 'p1', 'c1'),
        link('l2', 'pilot-to-crawler', 'p2', 'c1'),
      ],
      store: lookup([crawler, pilot, pilot2]),
    })
    expect(c.mode).toBe('wired')
    expect(c.crawlerPilots.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(c.pilot?.id).toBe('p1')
  })
})

describe('resolveSheetComposition — two-hop resolution', () => {
  test('mech sheet reaches the home crawler through its pilot', () => {
    const c = resolveSheetComposition({
      kind: 'mech',
      id: 'm1',
      links: [link('l1', 'mech-to-pilot', 'm1', 'p1'), link('l2', 'pilot-to-crawler', 'p1', 'c1')],
      store: lookup([mech, pilot, crawler]),
    })
    expect(c.mode).toBe('wired')
    expect(c.crawler?.id).toBe('c1')
  })

  test('crawler sheet reaches the docked mech through its lead pilot', () => {
    const c = resolveSheetComposition({
      kind: 'crawler',
      id: 'c1',
      links: [link('l1', 'pilot-to-crawler', 'p1', 'c1'), link('l2', 'mech-to-pilot', 'm1', 'p1')],
      store: lookup([crawler, pilot, mech]),
    })
    expect(c.mode).toBe('wired')
    expect(c.mech?.id).toBe('m1')
  })
})

describe('resolveSheetComposition — orphaned links', () => {
  test('a link to a deleted pilot leaves the mech un-wired', () => {
    const c = resolveSheetComposition({
      kind: 'mech',
      id: 'm1',
      links: [link('l1', 'mech-to-pilot', 'm1', 'gone')],
      store: lookup([mech]),
    })
    expect(c.mode).toBe('mech-only')
    expect(c.pilot).toBeNull()
  })

  test('crawler skips orphaned pilot links when collecting crawlerPilots', () => {
    const c = resolveSheetComposition({
      kind: 'crawler',
      id: 'c1',
      links: [
        link('l1', 'pilot-to-crawler', 'gone', 'c1'),
        link('l2', 'pilot-to-crawler', 'p2', 'c1'),
      ],
      store: lookup([crawler, pilot2]),
    })
    expect(c.mode).toBe('wired')
    expect(c.crawlerPilots.map((p) => p.id)).toEqual(['p2'])
    expect(c.pilot?.id).toBe('p2')
  })
})

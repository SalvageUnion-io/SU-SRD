/**
 * publishedSnapshots — local revoke-ledger tests.
 *
 * happy-dom provides localStorage via the bunfig preload. Each test starts from
 * a cleared store.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  listPublishedSnapshots,
  listPublishedSnapshotsFor,
  recordPublishedSnapshot,
  removePublishedSnapshot,
} from '../publishedSnapshots'
import type { PublishedSnapshot } from '../publishedSnapshots'

function entry(overrides: Partial<PublishedSnapshot> = {}): PublishedSnapshot {
  return {
    id: 'SNAP0001',
    kind: 'mech',
    entityId: 'mech-1',
    name: 'Iron Jaw',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('publishedSnapshots', () => {
  test('records and lists a published snapshot', () => {
    recordPublishedSnapshot(entry())
    const all = listPublishedSnapshots()
    expect(all.length).toBe(1)
    expect(all[0]?.id).toBe('SNAP0001')
  })

  test('lists newest first', () => {
    recordPublishedSnapshot(entry({ id: 'OLD00001', publishedAt: '2026-01-01T00:00:00.000Z' }))
    recordPublishedSnapshot(entry({ id: 'NEW00001', publishedAt: '2026-06-01T00:00:00.000Z' }))
    const all = listPublishedSnapshots()
    expect(all.map((s) => s.id)).toEqual(['NEW00001', 'OLD00001'])
  })

  test('de-dupes by id (re-publish overwrites the record)', () => {
    recordPublishedSnapshot(entry({ name: 'First' }))
    recordPublishedSnapshot(entry({ name: 'Second' }))
    const all = listPublishedSnapshots()
    expect(all.length).toBe(1)
    expect(all[0]?.name).toBe('Second')
  })

  test('listPublishedSnapshotsFor filters by entity kind + id', () => {
    recordPublishedSnapshot(entry({ id: 'A0000000', kind: 'mech', entityId: 'mech-1' }))
    recordPublishedSnapshot(entry({ id: 'B0000000', kind: 'mech', entityId: 'mech-2' }))
    recordPublishedSnapshot(entry({ id: 'C0000000', kind: 'pilot', entityId: 'mech-1' }))

    const forMech1 = listPublishedSnapshotsFor('mech', 'mech-1')
    expect(forMech1.map((s) => s.id)).toEqual(['A0000000'])
  })

  test('removePublishedSnapshot forgets one record', () => {
    recordPublishedSnapshot(entry({ id: 'KEEP0001' }))
    recordPublishedSnapshot(entry({ id: 'DROP0001' }))
    removePublishedSnapshot('DROP0001')
    expect(listPublishedSnapshots().map((s) => s.id)).toEqual(['KEEP0001'])
  })

  test('tolerates malformed stored JSON (returns empty, no throw)', () => {
    localStorage.setItem('itun-snapshots:published', 'not-json{{{')
    expect(listPublishedSnapshots()).toEqual([])
  })
})

/**
 * Change Log (provenance) tests — ADR-022.
 *
 * Verifies the write-through chokepoint: every entityStore.update appends
 * append-only, ordered Change Log entries (one per changed field), tagged with
 * provenance, and readable per-entity. fake-indexeddb/auto is preloaded via
 * bunfig.toml.
 */

import { beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton, changeLog } from '../../lib/db/index'
import { useEntityStore } from '../entityStore'

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Everything burns.',
  keepsake: 'A compass.',
  appearance: 'Tall.',
  background: '',
  conditions: [],
}

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

async function seedPilot() {
  return useEntityStore.getState().create('pilot', basePilotInput)
}

describe('Change Log — write-through chokepoint', () => {
  test('a single-field update appends exactly one entry, correctly shaped', async () => {
    const pilot = await seedPilot()
    await useEntityStore.getState().update('pilot', pilot.id, { callsign: 'Wraith' })

    const entries = await changeLog.listForEntity(pilot.id)
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    if (!entry) throw new Error('expected exactly one Change Log entry')
    expect(entry.entityType).toBe('pilot')
    expect(entry.entityId).toBe(pilot.id)
    expect(entry.field).toBe('callsign')
    expect(entry.before).toBe('Ghost')
    expect(entry.after).toBe('Wraith')
    expect(entry.kind).toBe('manual')
    expect(entry.source).toBe('unknown')
    expect(entry.seq).toBeGreaterThan(0)
    expect(typeof entry.ts).toBe('number')
  })

  test('a multi-field update appends one entry per changed field', async () => {
    const pilot = await seedPilot()
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith', motto: 'Rise again.' })

    const entries = await changeLog.listForEntity(pilot.id)
    expect(entries).toHaveLength(2)
    const fields = entries.map((e) => e.field).sort()
    expect(fields).toEqual(['callsign', 'motto'])
  })

  test('a no-op field (value unchanged) produces no entry', async () => {
    const pilot = await seedPilot()
    // callsign is already 'Ghost'; motto changes.
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Ghost', motto: 'A new creed.' })

    const entries = await changeLog.listForEntity(pilot.id)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.field).toBe('motto')
  })

  test('meta tags the entry kind + source (override / live-sheet)', async () => {
    const pilot = await seedPilot()
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith' }, { kind: 'override', source: 'live-sheet' })

    const entry = (await changeLog.listForEntity(pilot.id))[0]
    if (!entry) throw new Error('expected a Change Log entry')
    expect(entry.kind).toBe('override')
    expect(entry.source).toBe('live-sheet')
  })

  test('the log is append-only and ordered across successive updates', async () => {
    const pilot = await seedPilot()
    const store = useEntityStore.getState()
    await store.update('pilot', pilot.id, { callsign: 'A' })
    await store.update('pilot', pilot.id, { callsign: 'B' })
    await store.update('pilot', pilot.id, { callsign: 'C' })

    const entries = await changeLog.listForEntity(pilot.id)
    expect(entries.map((e) => e.after)).toEqual(['A', 'B', 'C'])
    // seq is strictly increasing — the total order.
    const seqs = entries.map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
    // before chains from the prior after.
    expect(entries.map((e) => e.before)).toEqual(['Ghost', 'A', 'B'])
  })

  test('listForEntity isolates one entity from another', async () => {
    const a = await seedPilot()
    const b = await useEntityStore
      .getState()
      .create('pilot', { ...basePilotInput, name: 'Rex', callsign: 'Hammer' })
    await useEntityStore.getState().update('pilot', a.id, { callsign: 'A-new' })
    await useEntityStore.getState().update('pilot', b.id, { callsign: 'B-new' })

    const aEntries = await changeLog.listForEntity(a.id)
    const bEntries = await changeLog.listForEntity(b.id)
    expect(aEntries).toHaveLength(1)
    expect(bEntries).toHaveLength(1)
    expect(aEntries[0]?.entityId).toBe(a.id)
    expect(bEntries[0]?.entityId).toBe(b.id)
  })
})

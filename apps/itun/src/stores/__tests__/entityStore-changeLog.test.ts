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
import { DASHBOARD_TXN, LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE } from '../surfaceProvenance'

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
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith' }, LIVE_SHEET_MANUAL)

    const entries = await changeLog.listForEntity(pilot.id)
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    if (!entry) throw new Error('expected exactly one Change Log entry')
    expect(entry.entityType).toBe('pilot')
    expect(entry.entityId).toBe(pilot.id)
    expect(entry.field).toBe('callsign')
    expect(entry.before).toBe('Ghost')
    expect(entry.after).toBe('Wraith')
    // The tag comes from the surface constant, never from a default — `meta` is
    // a required argument precisely so an untagged write cannot compile.
    expect(entry.kind).toBe('manual')
    expect(entry.source).toBe('live-sheet')
    expect(entry.seq).toBeGreaterThan(0)
    expect(typeof entry.ts).toBe('number')
  })

  test('transfer() logs every updated entity — the chokepoint hole (ADR-022)', async () => {
    // transfer() commits cross-entity writes in one IDB transaction, bypassing
    // update(). Before this was wired it emitted nothing, so cargo stow/load
    // and scrap hand-offs mutated entities with no provenance at all.
    const pilot = await seedPilot()
    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'pilot', id: pilot.id, patch: { callsign: 'Wraith' } }],
      },
      LIVE_SHEET_MANUAL
    )

    const entries = await changeLog.listForEntity(pilot.id)
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    if (!entry) throw new Error('expected a Change Log entry from transfer()')
    expect(entry.field).toBe('callsign')
    expect(entry.before).toBe('Ghost')
    expect(entry.after).toBe('Wraith')
  })

  test('transfer() carries its provenance tag through to the entry', async () => {
    const pilot = await seedPilot()
    await useEntityStore
      .getState()
      .transfer(
        { updates: [{ type: 'pilot', id: pilot.id, patch: { callsign: 'Wraith' } }] },
        { kind: 'transaction', source: 'dashboard' }
      )

    const entry = (await changeLog.listForEntity(pilot.id))[0]
    if (!entry) throw new Error('expected a Change Log entry from transfer()')
    expect(entry.kind).toBe('transaction')
    expect(entry.source).toBe('dashboard')
  })

  test('transfer() emits nothing for a patch that changes no field', async () => {
    const pilot = await seedPilot()
    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'pilot', id: pilot.id, patch: { callsign: 'Ghost' } }],
      },
      LIVE_SHEET_MANUAL
    )
    expect(await changeLog.listForEntity(pilot.id)).toHaveLength(0)
  })

  test("kind 'transaction' is reachable — it was defined but emitted nowhere", async () => {
    const pilot = await seedPilot()
    await useEntityStore.getState().update('pilot', pilot.id, { callsign: 'Wraith' }, DASHBOARD_TXN)

    const entry = (await changeLog.listForEntity(pilot.id))[0]
    if (!entry) throw new Error('expected a Change Log entry')
    expect(entry.kind).toBe('transaction')
    expect(entry.source).toBe('dashboard')
  })

  test('a multi-field update appends one entry per changed field', async () => {
    const pilot = await seedPilot()
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith', motto: 'Rise again.' }, LIVE_SHEET_MANUAL)

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
      .update('pilot', pilot.id, { callsign: 'Ghost', motto: 'A new creed.' }, LIVE_SHEET_MANUAL)

    const entries = await changeLog.listForEntity(pilot.id)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.field).toBe('motto')
  })

  test('meta tags the entry kind + source (override / live-sheet)', async () => {
    const pilot = await seedPilot()
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith' }, LIVE_SHEET_OVERRIDE)

    const entry = (await changeLog.listForEntity(pilot.id))[0]
    if (!entry) throw new Error('expected a Change Log entry')
    expect(entry.kind).toBe('override')
    expect(entry.source).toBe('live-sheet')
  })

  test('the log is append-only and ordered across successive updates', async () => {
    const pilot = await seedPilot()
    const store = useEntityStore.getState()
    await store.update('pilot', pilot.id, { callsign: 'A' }, LIVE_SHEET_MANUAL)
    await store.update('pilot', pilot.id, { callsign: 'B' }, LIVE_SHEET_MANUAL)
    await store.update('pilot', pilot.id, { callsign: 'C' }, LIVE_SHEET_MANUAL)

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
    await useEntityStore.getState().update('pilot', a.id, { callsign: 'A-new' }, LIVE_SHEET_MANUAL)
    await useEntityStore.getState().update('pilot', b.id, { callsign: 'B-new' }, LIVE_SHEET_MANUAL)

    const aEntries = await changeLog.listForEntity(a.id)
    const bEntries = await changeLog.listForEntity(b.id)
    expect(aEntries).toHaveLength(1)
    expect(bEntries).toHaveLength(1)
    expect(aEntries[0]?.entityId).toBe(a.id)
    expect(bEntries[0]?.entityId).toBe(b.id)
  })
})

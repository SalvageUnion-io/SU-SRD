/**
 * Change Log (provenance) tests — ADR-022.
 *
 * Verifies the write-through chokepoint: every entityStore.update sends
 * append-only, ordered Change Log entries (one per changed field), tagged with
 * provenance, to the server of record — the only copy of the log — and a batch
 * the server refuses is reported once rather than failing the edit.
 *
 * The Convex client is a recorder (`appendChangeLog` batches are kept, every
 * other commit answers as `upsertByAppId` does), so the store runs signed in
 * against fake-indexeddb with its server commits observed.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { installConvexMocks } from '../../components/__tests__/convexMock'

type Logged = {
  gameId: string | null
  entityType: string
  entityId: string
  ts: number
  kind: string
  field: string
  before: unknown
  after: unknown
  source: string
}

const appended: Logged[] = []
const captured: { error: unknown; options: unknown }[] = []
/** Set to make the server refuse the next Change Log batch. */
let refuseAppend = false

// Spread before anything is mocked: every other export stays real.
const realObservability = { ...(await import('../../lib/observability')) }

const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (ref: unknown, args: { entries?: Logged[] }) => {
      if (getFunctionName(ref as FunctionReference<'mutation'>) === 'changeLog:appendChangeLog') {
        if (refuseAppend) throw new Error('[CONVEX M(changeLog:appendChangeLog)] Server Error')
        appended.push(...(args.entries ?? []))
        return null
      }
      return { updatedAt: 1 }
    },
  },
  also: {
    '../../lib/observability': () => ({
      ...realObservability,
      captureException: (error: unknown, _context: unknown, options: unknown) => {
        captured.push({ error, options })
      },
    }),
  },
})

const { _resetDbSingleton, clearCache } = await import('../../lib/db/index')
const { useEntityStore } = await import('../entityStore')
const { DASHBOARD_TXN, LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE } = await import(
  '../surfaceProvenance'
)
const { withSignedInBackend } = await import('./signedInBackend')

afterAll(() => {
  convexMocks.restore()
})

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

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
  appended.length = 0
  captured.length = 0
  refuseAppend = false
  _resetDbSingleton()
  await clearCache()
  resetEntityStore()
})

async function seedPilot() {
  return useEntityStore.getState().create('pilot', basePilotInput)
}

const forEntity = (id: string) => appended.filter((e) => e.entityId === id)

describe('Change Log — write-through chokepoint', () => {
  test('a single-field update sends exactly one entry, correctly shaped', async () => {
    const pilot = await seedPilot()
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith' }, LIVE_SHEET_MANUAL)

    const entries = forEntity(pilot.id)
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
    // A shelf build files against no Game.
    expect(entry.gameId).toBeNull()
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

    const entries = forEntity(pilot.id)
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

    const entry = forEntity(pilot.id)[0]
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
    expect(forEntity(pilot.id)).toHaveLength(0)
  })

  test("kind 'transaction' is reachable — it was defined but emitted nowhere", async () => {
    const pilot = await seedPilot()
    await useEntityStore.getState().update('pilot', pilot.id, { callsign: 'Wraith' }, DASHBOARD_TXN)

    const entry = forEntity(pilot.id)[0]
    if (!entry) throw new Error('expected a Change Log entry')
    expect(entry.kind).toBe('transaction')
    expect(entry.source).toBe('dashboard')
  })

  test('a multi-field update sends one entry per changed field', async () => {
    const pilot = await seedPilot()
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith', motto: 'Rise again.' }, LIVE_SHEET_MANUAL)

    const entries = forEntity(pilot.id)
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

    const entries = forEntity(pilot.id)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.field).toBe('motto')
  })

  test('meta tags the entry kind + source (override / live-sheet)', async () => {
    const pilot = await seedPilot()
    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith' }, LIVE_SHEET_OVERRIDE)

    const entry = forEntity(pilot.id)[0]
    if (!entry) throw new Error('expected a Change Log entry')
    expect(entry.kind).toBe('override')
    expect(entry.source).toBe('live-sheet')
  })

  test('successive updates are sent in order, each before chaining from the prior after', async () => {
    const pilot = await seedPilot()
    const store = useEntityStore.getState()
    await store.update('pilot', pilot.id, { callsign: 'A' }, LIVE_SHEET_MANUAL)
    await store.update('pilot', pilot.id, { callsign: 'B' }, LIVE_SHEET_MANUAL)
    await store.update('pilot', pilot.id, { callsign: 'C' }, LIVE_SHEET_MANUAL)

    const entries = forEntity(pilot.id)
    expect(entries.map((e) => e.after)).toEqual(['A', 'B', 'C'])
    expect(entries.map((e) => e.before)).toEqual(['Ghost', 'A', 'B'])
  })

  test('each entry names the entity it is about', async () => {
    const a = await seedPilot()
    const b = await useEntityStore
      .getState()
      .create('pilot', { ...basePilotInput, name: 'Rex', callsign: 'Hammer' })
    await useEntityStore.getState().update('pilot', a.id, { callsign: 'A-new' }, LIVE_SHEET_MANUAL)
    await useEntityStore.getState().update('pilot', b.id, { callsign: 'B-new' }, LIVE_SHEET_MANUAL)

    expect(forEntity(a.id).map((e) => e.after)).toEqual(['A-new'])
    expect(forEntity(b.id).map((e) => e.after)).toEqual(['B-new'])
  })
})

describe('Change Log — a refused batch', () => {
  test('does not fail the edit, and is reported once under one fingerprint', async () => {
    const pilot = await seedPilot()
    refuseAppend = true

    await useEntityStore
      .getState()
      .update('pilot', pilot.id, { callsign: 'Wraith' }, LIVE_SHEET_MANUAL)
    // The append is not awaited by the store; let its rejection settle.
    await Promise.resolve()

    expect(useEntityStore.getState().get('pilot', pilot.id)?.callsign).toBe('Wraith')
    expect(captured).toHaveLength(1)
    expect(captured[0]?.options).toEqual({ fingerprint: ['convex', 'changeLog:appendChangeLog'] })
  })
})

/**
 * Ops, the store's one write to a unit (ADR-063).
 *
 * Every entityStore.update and transfer sends ops, each naming only the fields
 * it moved, tagged with provenance, made against the copy this tab holds; the
 * server applies them and keeps them as the unit's history
 * (`test/convex/__tests__/changeLogForEntity.test.ts` reads it back).
 *
 * The Convex client is a recorder (`ops.apply` and `ops.transfer` are kept,
 * every other commit answers as `upsertByAppId` does), so the in-memory store
 * runs signed in with its server commits observed.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { OpInput } from 'game-domain/ops/applyOp'
import { installConvexMocks } from '../../components/__tests__/convexMock'

type Sent = { unit: string; gameId: string | null; op: OpInput }

const sent: Sent[] = []
let seq = 0

const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (ref: unknown, args: { ops?: Sent[] } & Partial<Sent>) => {
      const name = getFunctionName(ref as FunctionReference<'mutation'>)
      if (name === 'ops:apply') {
        sent.push(args as Sent)
        return { headSeq: ++seq, updatedAt: seq }
      }
      if (name === 'ops:transfer') {
        sent.push(...(args.ops ?? []))
        return {
          applied: (args.ops ?? []).map((o) => ({
            unitId: o.op.unitId,
            headSeq: ++seq,
            updatedAt: seq,
          })),
        }
      }
      return { updatedAt: 1 }
    },
  },
})

const { useUnits } = await import('../units')
const { LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE, PLAY_TXN } = await import('../provenance')
const { resetStores } = await import('./resetStores')
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

beforeEach(() => {
  sent.length = 0
  seq = 0
  resetStores()
})

async function seedPilot() {
  return useUnits.getState().create('pilot', basePilotInput)
}

const opsFor = (id: string) => sent.filter((s) => s.op.unitId === id)
/** The fields an op writes, the bookkeeping stamp aside. */
const fields = (s: Sent | undefined) =>
  Object.keys(s?.op.patch ?? {}).filter((f) => f !== 'updatedAt')

describe('ops — the write-through chokepoint', () => {
  test('an update sends one op naming only what moved, tagged and made against the copy held', async () => {
    const pilot = await seedPilot()
    await useUnits
      .getState()
      .update(
        'pilot',
        pilot.id,
        { callsign: 'Wraith', motto: basePilotInput.motto },
        LIVE_SHEET_MANUAL
      )

    const [only, ...rest] = opsFor(pilot.id)
    expect(rest).toEqual([])
    expect(only?.unit).toBe('pilot')
    // A shelf build is in no Game.
    expect(only?.gameId).toBeNull()
    expect(fields(only)).toEqual(['callsign'])
    expect(only?.op.patch.callsign).toBe('Wraith')
    // A create is its unit's snapshot at seq 0.
    expect(only?.op.baseSeq).toBe(0)
    // The tag comes from the surface constant, never from a default.
    expect(only?.op).toMatchObject({ kind: 'manual', source: 'live-sheet' })
  })

  test('each op is made against the seq the last one answered', async () => {
    const pilot = await seedPilot()
    const store = useUnits.getState()
    await store.update('pilot', pilot.id, { callsign: 'A' }, LIVE_SHEET_MANUAL)
    await store.update('pilot', pilot.id, { callsign: 'B' }, LIVE_SHEET_OVERRIDE)
    await store.update('pilot', pilot.id, { callsign: 'C' }, PLAY_TXN)

    const ops = opsFor(pilot.id).map((s) => s.op)
    expect(ops.map((o) => o.patch.callsign)).toEqual(['A', 'B', 'C'])
    expect(ops.map((o) => o.baseSeq)).toEqual([0, 1, 2])
    expect(ops.map((o) => o.kind)).toEqual(['manual', 'override', 'transaction'])
    expect(new Set(ops.map((o) => o.id)).size).toBe(3)
  })

  test('a cleared field travels as unset', async () => {
    const pilot = await seedPilot()
    await useUnits.getState().update('pilot', pilot.id, { maxHpOverride: 9 }, LIVE_SHEET_OVERRIDE)
    await useUnits
      .getState()
      .update('pilot', pilot.id, { maxHpOverride: undefined }, LIVE_SHEET_OVERRIDE)

    expect(opsFor(pilot.id)[1]?.op.unset).toEqual(['maxHpOverride'])
  })

  test('transfer() sends an op per updated unit, with its provenance', async () => {
    const pilot = await seedPilot()
    await useUnits
      .getState()
      .transfer(
        { updates: [{ type: 'pilot', id: pilot.id, patch: { callsign: 'Wraith' } }] },
        { kind: 'transaction', source: 'play' }
      )

    const [op] = opsFor(pilot.id)
    expect(fields(op)).toEqual(['callsign'])
    expect(op?.op).toMatchObject({ kind: 'transaction', source: 'play' })
  })

  test('an update that changes nothing sends nothing', async () => {
    const pilot = await seedPilot()
    await useUnits.getState().update('pilot', pilot.id, { callsign: 'Ghost' }, LIVE_SHEET_MANUAL)
    expect(opsFor(pilot.id)).toHaveLength(0)
  })
})

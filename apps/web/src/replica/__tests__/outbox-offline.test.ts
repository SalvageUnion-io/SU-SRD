/**
 * The outbox (ADR-063 decision 9), the client half: offline, an edit to the
 * player's own sheet is held and waits; a crawler edit or a move is still
 * refused; back live, what waits goes up as `ops.replay`, one op per unit,
 * and one the server declines is answered with why.
 *
 * The server half (`ops.replay` applying or keeping an op `declined`) is
 * `test/convex/__tests__/opReplay.test.ts`.
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getFunctionName } from 'convex/server'
import { crawlerFixture, pilotFixture } from '../../components/__tests__/fixtures'

type Sent = { name: string; args: { op: { unitId: string; patch: Record<string, unknown> } } }

const sent: Sent[] = []
let answer: unknown = { updatedAt: 5, headSeq: 2, fresh: true }

const { installConvexMocks } = await import('../../components/__tests__/convexMock')
const mocks = await installConvexMocks({
  convexClient: {
    mutation: async (ref: unknown, args: Sent['args']) => {
      if (answer instanceof Error) throw answer
      sent.push({ name: getFunctionName(ref as never), args })
      return answer
    },
  },
})
afterAll(() => mocks.restore())

const { flushOutbox, forgetOutbox } = await import('../outbox')
const { resetSync, setSyncStatus, WritesBlockedOffline } = await import('../sync')
const { useUnits } = await import('../units')
const { resetStores } = await import('./resetStores')

const TXN = { kind: 'manual', source: 'test' } as const

beforeEach(async () => {
  resetStores()
  forgetOutbox()
  sent.length = 0
  answer = { updatedAt: 5, headSeq: 2, fresh: true }
  const units = useUnits.getState()
  await units.adopt('pilot', pilotFixture({ id: 'p1', callsign: 'Before', name: 'Before' }))
  await units.adopt('crawler', crawlerFixture({ id: 'c1', name: 'Before' }))
  setSyncStatus('offline')
})

afterEach(() => {
  resetSync()
  forgetOutbox()
})

describe('offline', () => {
  test('an edit to your own pilot is held, and nothing is sent', async () => {
    await useUnits.getState().update('pilot', 'p1', { callsign: 'Offline' }, TXN)

    expect(useUnits.getState().get('pilot', 'p1')?.callsign).toBe('Offline')
    expect(sent).toEqual([])
  })

  test('a crawler edit is still refused', async () => {
    await expect(
      useUnits.getState().update('crawler', 'c1', { name: 'Offline' }, TXN)
    ).rejects.toBeInstanceOf(WritesBlockedOffline)
  })

  test('a move is still refused: a container is Game-wide', async () => {
    await expect(
      useUnits.getState().update('pilot', 'p1', { gameId: 'g1' }, TXN)
    ).rejects.toBeInstanceOf(WritesBlockedOffline)
  })
})

describe('back live', () => {
  test('the unit’s edits go up as one replay, and nothing waits after', async () => {
    const units = useUnits.getState()
    await units.update('pilot', 'p1', { callsign: 'One' }, TXN)
    await units.update('pilot', 'p1', { callsign: 'Two', name: 'Renamed' }, TXN)
    setSyncStatus('live')

    expect(await flushOutbox()).toEqual([])
    expect(sent.map((s) => [s.name, s.args.op.patch.callsign, s.args.op.patch.name])).toEqual([
      ['ops:replay', 'Two', 'Renamed'],
    ])
    expect(await flushOutbox()).toEqual([])
    expect(sent).toHaveLength(1)
  })

  test('a declined op is answered with why', async () => {
    await useUnits.getState().update('pilot', 'p1', { callsign: 'Late' }, TXN)
    answer = { declined: 'That sheet is no longer yours' }
    setSyncStatus('live')

    expect(await flushOutbox()).toEqual(['That sheet is no longer yours'])
  })

  test('a send that fails keeps the op for next time', async () => {
    await useUnits.getState().update('pilot', 'p1', { callsign: 'Kept' }, TXN)
    setSyncStatus('live')
    answer = new Error('Connection lost')
    expect(await flushOutbox()).toEqual([])

    answer = { updatedAt: 5, headSeq: 2, fresh: true }
    expect(await flushOutbox()).toEqual([])
    expect(sent.map((s) => s.args.op.patch.callsign)).toEqual(['Kept'])
  })
})

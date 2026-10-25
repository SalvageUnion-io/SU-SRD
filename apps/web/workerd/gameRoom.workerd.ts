import { runDurableObjectAlarm } from 'cloudflare:test'
import { exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { pilotFixture } from '../src/components/__tests__/fixtures'
import { handOff } from '../src/rooms/handoff'
import type { GameRoomStub } from '../src/worker/rooms'

const exports = workerExports as unknown as {
  GameRoom: { getByName(name: string): GameRoomStub }
}

const ORGANIZER = 'd-org'
const PLAYER = 'd-player'
const profile = (displayName: string) => ({ displayName, avatarUrl: null })

/** A Game in room `gameId`, joined by `PLAYER`, who holds pilot `p1`. */
async function game(gameId: string) {
  const room = exports.GameRoom.getByName(gameId)
  expect(
    await room.act(ORGANIZER, 'create', { name: 'Tenacity', profile: profile('Org') })
  ).toEqual({ ok: true })
  const code = await room.act(ORGANIZER, 'inviteCode', undefined as never)
  if (!code.ok) throw new Error(code.refusal)
  await room.act(PLAYER, 'redeem', { code: code.value, profile: profile('Player') })
  const pilot = pilotFixture({ id: 'p1', name: 'Pilot p1', callsign: 'p1', classRef: 'salvager' })
  await room.act(PLAYER, 'createUnit', { id: 'p1', kind: 'pilot', body: pilot })
  return room
}

const motto = (motto: string, over: object = {}) => ({
  id: crypto.randomUUID(),
  unitId: 'p1',
  baseSeq: 0,
  at: Date.now(),
  kind: 'manual' as const,
  source: 'live-sheet',
  patch: { motto },
  ...over,
})

describe('the Game room over RPC', () => {
  it('runs acts with the real applyOp, and answers a refusal', async () => {
    const room = await game('g-acts')
    const op = motto('Keep moving')
    expect(await room.act(PLAYER, 'submit', { ops: [op] })).toEqual({
      ok: true,
      value: { ok: true, applied: [{ id: op.id, seq: 1 }] },
    })
    expect(await room.unitsFor(PLAYER)).toMatchObject([
      { id: 'p1', body: { motto: 'Keep moving' } },
    ])
    expect(await room.unit(PLAYER, 'p1')).toMatchObject({ ownerName: 'Player' })
    expect(await room.act('d-stranger', 'beginDowntime', undefined as never)).toEqual({
      ok: false,
      refusal: 'Not a member of this Game',
    })
    // Not a pilot's field: the schema refuses it, and nothing lands.
    const bad = await room.act(PLAYER, 'submit', { ops: [motto('x', { patch: { motto: 3 } })] })
    expect(bad.ok && bad.value.ok).toBe(false)
  })

  it('moves a unit to another Game room', async () => {
    const from = await game('g-from')
    const to = await game('g-to')
    // The target holds a p1 of its own, so move a second pilot.
    const p2 = pilotFixture({ id: 'p2', name: 'Pilot p2', callsign: 'p2', classRef: 'salvager' })
    await from.act(PLAYER, 'createUnit', { id: 'p2', kind: 'pilot', body: p2 })
    await handOff(from, to, {
      leaseId: 'L-p2',
      unitId: 'p2',
      actor: PLAYER,
      to: { kind: 'game', gameId: 'g-to' },
      at: Date.now(),
    })
    expect((await from.unitsFor(PLAYER)).map((u) => u.id)).toEqual(['p1'])
    expect((await to.unitsFor(PLAYER)).map((u) => u.id).sort()).toEqual(['p1', 'p2'])
  })

  it('the alarm settles an offer its target never answered', async () => {
    const from = await game('g-stale')
    await game('g-stale-to')
    await from.offer({
      leaseId: 'L-stale',
      unitId: 'p1',
      actor: PLAYER,
      to: { kind: 'game', gameId: 'g-stale-to' },
      at: Date.now() - 120_000,
    })
    const leaving = await from.act(PLAYER, 'submit', { ops: [motto('Wait', { baseSeq: null })] })
    expect(leaving).toMatchObject({ ok: false, refusal: expect.stringContaining('on its way') })
    expect(await runDurableObjectAlarm(from as unknown as DurableObjectStub)).toBe(true)
    const back = await from.act(PLAYER, 'submit', { ops: [motto('Back', { baseSeq: null })] })
    expect(back.ok && back.value.ok).toBe(true)
  })
})

describe('ending a Game', () => {
  it('lands each unit on its holder’s shelf, and leaves the room empty', async () => {
    const room = await game('g-end')
    expect(await room.disband(ORGANIZER)).toEqual({ ok: true, value: null })
    const shelf = (
      workerExports as unknown as {
        AccountRoom: {
          getByName(name: string): { unitsFor(actor: string): Promise<{ id: string }[]> }
        }
      }
    ).AccountRoom.getByName(PLAYER)
    expect((await shelf.unitsFor(PLAYER)).map((u) => u.id)).toEqual(['p1'])
    expect(await room.act(ORGANIZER, 'read', undefined as never)).toEqual({ ok: true, value: null })
  })
})

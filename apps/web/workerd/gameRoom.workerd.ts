import type { D1Migration } from 'cloudflare:test'
import { applyD1Migrations, runDurableObjectAlarm } from 'cloudflare:test'
import { env, exports as workerExports } from 'cloudflare:workers'
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

describe('the table’s state', () => {
  it('keeps its Scene, area, ledger and Safety Protocols in the room’s own SQLite', async () => {
    const room = await game('g-table')
    await room.act(ORGANIZER, 'setMediator', { userId: ORGANIZER, mediator: true })
    await room.act(ORGANIZER, 'scenes.setConditions', { conditions: ['freezing'] })
    expect(await room.act(ORGANIZER, 'scenes.passHour', undefined as never)).toEqual({
      ok: true,
      value: 1,
    })
    await room.act(ORGANIZER, 'salvageAreas.set', {
      area: { name: 'Camp', techLevel: 2, supply: 3 },
    })
    expect(await room.act(PLAYER, 'salvageAreas.spend', { pilotId: 'p1' })).toEqual({
      ok: true,
      value: { techLevel: 2, supply: 2 },
    })
    const faction = { id: 'f1', name: 'Union', standing: 'friendly' as const, deal: true }
    await room.act(ORGANIZER, 'ledger.setFaction', { faction })
    expect(await room.act(PLAYER, 'ledger.get', undefined as never)).toMatchObject({
      value: { factions: [faction] },
    })
    await room.act(PLAYER, 'safety.addBoundary', { kind: 'offCamera', text: 'Spiders' })
    await room.act(PLAYER, 'safety.showStop', undefined as never)
    expect(await room.act(ORGANIZER, 'safety.stopSign', undefined as never)).toMatchObject({
      value: { stop: { mine: false }, mayLift: true },
    })
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

describe('what the Game room publishes', () => {
  it('writes its shared units to the shared database, and drops them once it is wiped', async () => {
    const { SHARED, TEST_MIGRATIONS } = env as unknown as {
      SHARED: D1Database
      TEST_MIGRATIONS: D1Migration[]
    }
    await applyD1Migrations(SHARED, TEST_MIGRATIONS)
    const room = exports.GameRoom.getByName('g-publish')
    const pilot = pilotFixture({ id: 'p9', name: 'Rosa', callsign: 'Rosa', classRef: 'salvager' })
    await room.importGame({
      gameId: 'g-publish',
      name: 'Tenacity',
      members: [{ discordId: PLAYER, mediator: false, organizer: true, joinedAt: 1 }],
      inviteCode: null,
      primaryCrawler: null,
      units: [
        {
          kind: 'pilot',
          appId: 'p9',
          owner: PLAYER,
          publicRead: true,
          body: pilot,
          headSeq: 0,
          fieldSeqs: {},
          updatedAt: 1,
          ops: [],
        },
      ],
      opposition: [],
      links: [],
      seats: [],
      downtime: null,
      runningEncounter: null,
      channelBindings: [],
      crewPatterns: [],
    })
    expect(await room.republish()).toEqual({ sheets: 1, homebrew: 0 })
    const row = await SHARED.prepare(
      "select room, preview from public_sheets where kind = 'pilot' and app_id = 'p9'"
    ).first<{ room: string; preview: string }>()
    expect(row?.room).toBe('game:g-publish')
    expect(JSON.parse(row?.preview ?? '{}')).toMatchObject({ gameName: 'Tenacity' })
    expect(await room.disband(PLAYER)).toEqual({ ok: true, value: null })
    expect(await room.republish()).toEqual({ sheets: 0, homebrew: 0 })
    const after = await SHARED.prepare("select room from public_sheets where app_id = 'p9'").first<{
      room: string
    }>()
    // Back on its player's Shelf, whose room now writes its row.
    expect(after?.room).toBe(`account:${PLAYER}`)
  })
})

describe('the Game room’s socket', () => {
  it('opens on a snapshot, and answers an ops batch with applied and ack', async () => {
    const room = (await game('g-socket')) as unknown as GameRoomStub & {
      fetch(url: string, init: RequestInit): Promise<Response>
    }
    const res = await room.fetch('https://room/', {
      headers: { upgrade: 'websocket', 'x-su-member': PLAYER, 'x-su-seat': '0' },
    })
    const ws = res.webSocket
    if (ws === null) throw new Error('no socket')
    const heard: { type: string; [key: string]: unknown }[] = []
    ws.addEventListener('message', (e) => heard.push(JSON.parse(String(e.data))))
    ws.accept()
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
    await settle()
    expect(heard[0]).toMatchObject({
      type: 'snapshot',
      units: [{ appId: 'p1', gameId: 'g-socket' }],
    })

    const op = motto('Up')
    ws.send(JSON.stringify({ type: 'ops', ops: [op] }))
    await settle()
    expect(heard.slice(-2)).toMatchObject([
      { type: 'applied', unit: { appId: 'p1', headSeq: 1 } },
      { type: 'ack', opIds: [op.id] },
    ])
    ws.close(1000)
  })
})

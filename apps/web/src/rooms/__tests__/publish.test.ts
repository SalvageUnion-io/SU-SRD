import { describe, expect, test } from 'bun:test'
import { seedShelf } from '../account/__tests__/seedShelf'
import { AccountRoomLogic } from '../account/accountRoomLogic'
import {
  AT,
  bodies,
  MEDIATOR,
  ORGANIZER,
  PLAYER,
  STRANGER,
  stubApplyOp,
  table,
} from '../game/__tests__/harness'
import type { GameStore, UnitRow } from '../game/store'
import { migrate } from '../migrate'
import { gamePublished, shelfPublished } from '../publish'
import { ACCOUNT_ROOM } from '../schemas'
import { bunSql } from './bunSql'

type Kind = UnitRow['kind']

function put(store: GameStore, kind: Kind, id: string, over: Partial<UnitRow> = {}) {
  store.putUnit({
    id,
    kind,
    ownerId: PLAYER,
    body: bodies[kind](id) as Record<string, unknown>,
    headSeq: 0,
    fieldSeqs: {},
    publicRead: false,
    createdAt: AT,
    updatedAt: AT,
    leaseId: null,
    ...over,
  })
}

function mechToPilot(store: GameStore, mech: string, pilot: string) {
  store.putLink(
    { type: 'mech-to-pilot', from: { type: 'mech', id: mech }, to: { type: 'pilot', id: pilot } },
    AT
  )
}

describe('what a Game room publishes', () => {
  test('a shared unit only, with what its page and preview may say', () => {
    const { room } = table('g1')
    const { store } = room
    put(store, 'pilot', 'p1', {
      publicRead: true,
      body: { ...bodies.pilot('p1'), abilities: ['a'] },
    })
    put(store, 'mech', 'm1', { publicRead: true })
    put(store, 'mech', 'm2')
    mechToPilot(store, 'm1', 'p1')
    const { sheets, homebrew } = gamePublished(store, 'g1')
    expect(homebrew).toEqual([])
    expect(sheets.map((s) => [s.kind, s.appId])).toEqual([
      ['mech', 'm1'],
      ['pilot', 'p1'],
    ])
    const [mech, pilot] = sheets
    expect(mech?.page).toMatchObject({
      kind: 'mech',
      appId: 'm1',
      pilotAbilities: ['a'],
      linked: [{ kind: 'pilot', id: 'p1', name: 'p1' }],
      withheld: [],
    })
    expect(pilot?.preview).toEqual({
      kind: 'pilot',
      body: expect.objectContaining({ id: 'p1' }),
      ownerName: 'Player',
      gameName: 'Tenacity',
      mechChassisRef: 'iron-mongrel',
    })
  })

  test('a private far end is withheld by kind, and a stranger’s pilot lends no abilities', () => {
    const { room } = table('g1')
    const { store } = room
    put(store, 'pilot', 'p1', {
      ownerId: STRANGER,
      body: { ...bodies.pilot('p1'), abilities: ['secret'] },
    })
    put(store, 'mech', 'm1', { publicRead: true })
    mechToPilot(store, 'm1', 'p1')
    const [mech] = gamePublished(store, 'g1').sheets
    expect(mech?.page).toMatchObject({ pilotAbilities: [], links: [], linked: [] })
    expect(mech?.page).toMatchObject({ withheld: [{ kind: 'pilot' }] })
    expect(JSON.stringify(mech)).not.toContain('secret')
  })

  test('a unit on its way out is not this room’s to publish, and a wiped room publishes nothing', () => {
    const { room, sql } = table('g1')
    put(room.store, 'pilot', 'p1', { publicRead: true, leaseId: 'lease-1' })
    expect(gamePublished(room.store, 'g1').sheets).toEqual([])
    sql.exec('delete from game')
    put(room.store, 'pilot', 'p2', { publicRead: true })
    expect(gamePublished(room.store, 'g1')).toEqual({
      sheets: [],
      homebrew: [],
      roster: { gameId: 'g1', game: null },
    })
  })

  test('its roster: name, Mediator, members and the invite that opens it now', () => {
    const { room, code } = table('g1')
    expect(gamePublished(room.store, 'g1').roster).toEqual({
      gameId: 'g1',
      game: {
        name: 'Tenacity',
        mediatedBy: 'Med',
        members: [
          { discordId: ORGANIZER, mediator: false, organizer: true },
          { discordId: PLAYER, mediator: false, organizer: false },
          { discordId: MEDIATOR, mediator: true, organizer: false },
        ],
        invite: code,
      },
    })
    const { code: next } = room.roster.resetInvite(ORGANIZER, AT + 5)
    expect(gamePublished(room.store, 'g1').roster?.game?.invite).toBe(next)
  })
})

describe('what an account room publishes', () => {
  function shelf(
    patterns: { id: string; body: Record<string, unknown>; extra?: Record<string, unknown> }[]
  ) {
    const sql = bunSql()
    migrate(sql, ACCOUNT_ROOM)
    const room = new AccountRoomLogic(sql, { applyOp: stubApplyOp })
    const records = patterns.map((p) => ({ table: 'patterns' as const, ...p }))
    seedShelf(room, { owner: PLAYER, name: 'Rosa', records }, AT)
    return room.shelf.store
  }

  test('a pattern shared by link gets a page; on the Reference too, a Homebrew listing', () => {
    const store = shelf([
      { id: 'pat-private', body: { name: 'Mine' }, extra: {} },
      {
        id: 'pat-link',
        body: { name: 'Linked', chassisRef: 'iron-mongrel' },
        extra: { publicRead: true, sharedAt: AT, builtCount: 2 },
      },
      {
        id: 'pat-home',
        body: { name: ' Homebrewed ', chassisRef: 'iron-mongrel' },
        extra: { publicRead: true, sharedAt: AT, homebrew: true },
      },
      { id: 'pat-crew', body: { name: 'Crew' }, extra: { homebrew: true } },
    ])
    put(store, 'npc', 'n1', { publicRead: true })
    const { sheets, homebrew } = shelfPublished(store)
    expect(sheets.map((s) => [s.kind, s.appId])).toEqual([
      ['npc', 'n1'],
      ['pattern', 'pat-home'],
      ['pattern', 'pat-link'],
    ])
    expect(sheets[0]?.page).toMatchObject({ madeBy: 'Rosa' })
    expect(sheets[2]).toMatchObject({
      ownerId: PLAYER,
      page: { appId: 'pat-link', madeBy: 'Rosa', sharedAt: AT, builtCount: 2, mine: false },
      preview: { kind: 'pattern', ownerName: 'Rosa', gameName: null },
    })
    expect(homebrew).toEqual([
      {
        appId: 'pat-home',
        ownerId: PLAYER,
        chassisRef: 'iron-mongrel',
        name: 'Homebrewed',
        body: expect.objectContaining({ name: ' Homebrewed ' }),
        madeBy: 'Rosa',
        sharedAt: AT,
      },
    ])
  })
})

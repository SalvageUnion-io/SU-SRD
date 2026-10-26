import { describe, expect, test } from 'bun:test'
import type { AccountBundle } from 'game-domain/migration/bundle'
import { AccountRoomLogic } from '../account/accountRoomLogic'
import { AT, bodies, PLAYER, STRANGER, stubApplyOp, table } from '../game/__tests__/harness'
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
    const { sheets, homebrew } = gamePublished(store)
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
    const [mech] = gamePublished(store).sheets
    expect(mech?.page).toMatchObject({ pilotAbilities: [], links: [], linked: [] })
    expect(mech?.page).toMatchObject({ withheld: [{ kind: 'pilot' }] })
    expect(JSON.stringify(mech)).not.toContain('secret')
  })

  test('a unit on its way out is not this room’s to publish, and a wiped room publishes nothing', () => {
    const { room, sql } = table('g1')
    put(room.store, 'pilot', 'p1', { publicRead: true, leaseId: 'lease-1' })
    expect(gamePublished(room.store).sheets).toEqual([])
    sql.exec('delete from game')
    put(room.store, 'pilot', 'p2', { publicRead: true })
    expect(gamePublished(room.store)).toEqual({ sheets: [], homebrew: [] })
  })
})

describe('what an account room publishes', () => {
  function shelf(patterns: AccountBundle['patterns']) {
    const sql = bunSql()
    migrate(sql, ACCOUNT_ROOM)
    const room = new AccountRoomLogic(sql, { applyOp: stubApplyOp })
    room.transit.importAccount(
      {
        discordId: PLAYER,
        name: 'Rosa',
        avatarUrl: null,
        units: [],
        patterns,
        encounters: [],
        npcTray: [],
        links: [],
        seats: [],
        channelBindings: [],
        salvageArea: null,
      },
      AT
    )
    return room.shelf.store
  }

  test('a pattern shared by link gets a page; on the Reference too, a Homebrew listing', () => {
    const store = shelf([
      { appId: 'pat-private', body: { name: 'Mine' }, extra: {} },
      {
        appId: 'pat-link',
        body: { name: 'Linked', chassisRef: 'iron-mongrel' },
        extra: { publicRead: true, sharedAt: AT, builtCount: 2 },
      },
      {
        appId: 'pat-home',
        body: { name: ' Homebrewed ', chassisRef: 'iron-mongrel' },
        extra: { publicRead: true, sharedAt: AT, homebrew: true },
      },
      { appId: 'pat-crew', body: { name: 'Crew' }, extra: { homebrew: true } },
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

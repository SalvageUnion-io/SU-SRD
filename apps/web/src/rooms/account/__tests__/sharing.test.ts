import { describe, expect, test } from 'bun:test'
import { bunSql } from '../../__tests__/bunSql'
import { AT, bodies, PLAYER, STRANGER, stubApplyOp } from '../../game/__tests__/harness'
import { migrate } from '../../migrate'
import { shelfPublished } from '../../publish'
import { RoomRefusal } from '../../refusal'
import { ACCOUNT_ROOM } from '../../schemas'
import { AccountRoomLogic } from '../accountRoomLogic'
import { shelfSnapshot } from '../feed'

/** `PLAYER`'s claimed room, holding one pilot. */
function shelf() {
  const sql = bunSql()
  migrate(sql, ACCOUNT_ROOM)
  const room = new AccountRoomLogic(sql, { applyOp: stubApplyOp, newId: () => 'x' })
  room.shelf.claim(PLAYER, AT)
  room.shelf.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  return room
}

const pattern = (id: string, name = 'Tow Rig') => ({
  id,
  schemaVersion: 1,
  name,
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  createdAt: new Date(AT).toISOString(),
})

const GAME = { id: 'g1', name: 'The Long Haul' }

describe('the Shelf records', () => {
  test('a pattern is written by the id in its body, once, and deleted', () => {
    const room = shelf()
    room.sharing.putRecord(PLAYER, 'patterns', pattern('pat1'), AT)
    room.sharing.putRecord(PLAYER, 'patterns', pattern('pat1', 'Renamed'), AT + 1)
    expect(room.shelf.records(PLAYER, 'patterns')).toEqual([
      { appId: 'pat1', body: pattern('pat1', 'Renamed') },
    ])
    room.sharing.removeRecord(PLAYER, 'patterns', 'pat1')
    room.sharing.removeRecord(PLAYER, 'patterns', 'pat1')
    expect(room.shelf.records(PLAYER, 'patterns')).toEqual([])
  })

  test('a body its schema refuses, or another player, writes nothing', () => {
    const room = shelf()
    expect(() => room.sharing.putRecord(PLAYER, 'patterns', { id: 'pat1' }, AT)).toThrow()
    expect(() => room.sharing.putRecord(STRANGER, 'patterns', pattern('pat1'), AT)).toThrow(
      RoomRefusal
    )
    expect(room.shelf.records(PLAYER, 'patterns')).toEqual([])
  })

  test('a tray NPC may be partial but is named', () => {
    const room = shelf()
    room.sharing.putRecord(PLAYER, 'npcTray', { id: 'n1', name: 'Scav' }, AT)
    expect(() => room.sharing.putRecord(PLAYER, 'npcTray', { id: 'n2' }, AT)).toThrow()
    expect(room.shelf.records(PLAYER, 'npcTray')).toEqual([
      { appId: 'n1', body: { id: 'n1', name: 'Scav' } },
    ])
  })
})

describe('who may read a pattern', () => {
  test('by link, then on the Reference; withdrawing the link takes it off', () => {
    const room = shelf()
    room.sharing.putRecord(PLAYER, 'patterns', pattern('pat1'), AT)
    expect(() => room.sharing.setHomebrew(PLAYER, 'pat1', true, AT)).toThrow(
      'Share it with anyone with the link first'
    )
    room.sharing.setPatternVisibility(PLAYER, 'pat1', 'link', null, AT)
    room.sharing.setHomebrew(PLAYER, 'pat1', true, AT)
    expect(room.sharing.patternSharing(PLAYER)).toEqual([
      {
        appId: 'pat1',
        sharing: {
          visibility: 'link',
          gameId: null,
          gameName: null,
          builtCount: 0,
          homebrew: true,
        },
      },
    ])
    expect(shelfPublished(room.shelf.store).homebrew.map((p) => p.appId)).toEqual(['pat1'])

    room.sharing.setPatternVisibility(PLAYER, 'pat1', 'game', GAME, AT)
    const published = shelfPublished(room.shelf.store)
    expect(published.homebrew).toEqual([])
    expect(published.sheets).toEqual([])
    expect(published.crew).toEqual([
      expect.objectContaining({ appId: 'pat1', gameId: 'g1', ownerId: PLAYER }),
    ])
    expect(room.sharing.patternSharing(PLAYER)[0]?.sharing).toMatchObject({
      visibility: 'game',
      gameId: 'g1',
      gameName: 'The Long Haul',
      homebrew: false,
    })

    room.sharing.setPatternVisibility(PLAYER, 'pat1', 'private', null, AT)
    expect(shelfPublished(room.shelf.store).crew).toEqual([])
  })

  test('a Game must be named, and the pattern must be there', () => {
    const room = shelf()
    room.sharing.putRecord(PLAYER, 'patterns', pattern('pat1'), AT)
    expect(() => room.sharing.setPatternVisibility(PLAYER, 'pat1', 'game', null, AT)).toThrow(
      RoomRefusal
    )
    expect(() => room.sharing.setPatternVisibility(PLAYER, 'gone', 'link', null, AT)).toThrow(
      'That pattern no longer exists'
    )
  })

  test('the sharing reaches its maker on their snapshot, and nobody else', () => {
    const room = shelf()
    room.sharing.putRecord(PLAYER, 'patterns', pattern('pat1'), AT)
    const mine = shelfSnapshot(room, PLAYER)
    expect(mine.type === 'snapshot' && mine.records.sharing?.map((r) => r.appId)).toEqual(['pat1'])
    const theirs = shelfSnapshot(room, STRANGER)
    expect(theirs.type === 'snapshot' && theirs.records.sharing).toBeUndefined()
  })
})

describe('sharing a sheet by link', () => {
  test('the player shares and unshares their own unit', () => {
    const room = shelf()
    expect(room.sharing.setPublic(PLAYER, 'pilot', 'p1', true)).toBe(true)
    expect(room.shelf.store.unit('p1')?.publicRead).toBe(true)
    expect(shelfPublished(room.shelf.store).sheets.map((s) => s.appId)).toEqual(['p1'])
    room.sharing.setPublic(PLAYER, 'pilot', 'p1', false)
    expect(shelfPublished(room.shelf.store).sheets).toEqual([])
  })

  test('nobody else, and not under another kind', () => {
    const room = shelf()
    expect(() => room.sharing.setPublic(STRANGER, 'pilot', 'p1', true)).toThrow(RoomRefusal)
    expect(() => room.sharing.setPublic(PLAYER, 'mech', 'p1', true)).toThrow(RoomRefusal)
  })
})

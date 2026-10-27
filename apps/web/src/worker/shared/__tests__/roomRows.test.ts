import { describe, expect, test } from 'bun:test'
import type { Published, PublishedSheet } from '../../../rooms/publish'
import { gameOfInvite, gamesOf, invitePreview } from '../games'
import { homebrewPatterns } from '../homebrew'
import { publicPage, publicPreview } from '../publicSheets'
import { RoomPublisher } from '../roomRows'
import { testDb } from './d1'

/** A room's rows in the shared database, as `RoomPublisher` keeps them. */

function sheet(appId: string, name = appId): PublishedSheet {
  return {
    kind: 'pilot',
    appId,
    ownerId: 'd-1',
    page: { kind: 'pilot', appId, body: { name }, links: [], linked: [], withheld: [] },
    preview: { kind: 'pilot', body: { name }, ownerName: 'Rosa', gameName: null },
  }
}

const listing = (appId: string) => ({
  appId,
  ownerId: 'd-1',
  chassisRef: 'iron-mongrel',
  name: appId,
  body: { name: appId },
  madeBy: 'Rosa',
  sharedAt: 1,
})

function publisher(db: ReturnType<typeof testDb>, room: string, maker: string | null) {
  let rows: Published = { sheets: [], homebrew: [] }
  const it = new RoomPublisher(db, room, maker, () => rows)
  return {
    it,
    set(next: Partial<Published>) {
      rows = { sheets: [], homebrew: [], ...next }
    },
  }
}

describe('a room’s rows in the shared database', () => {
  test('republish writes them all, and an unshare after deletes its row', async () => {
    const db = testDb()
    const shelf = publisher(db, 'account:d-1', 'd-1')
    shelf.set({ sheets: [sheet('p1'), sheet('p2')], homebrew: [listing('pat1')] })
    expect(await shelf.it.republish()).toEqual({ sheets: 2, homebrew: 1 })
    expect(await publicPage(db, 'pilot', 'p1')).toMatchObject({ appId: 'p1' })
    expect(await publicPreview(db, 'pilot', 'p2')).toMatchObject({ ownerName: 'Rosa' })
    expect((await homebrewPatterns(db)).map((row) => row.appId)).toEqual(['pat1'])

    shelf.set({ sheets: [sheet('p1', 'Renamed')] })
    await shelf.it.changed()
    expect(await publicPage(db, 'pilot', 'p1')).toMatchObject({ body: { name: 'Renamed' } })
    expect(await publicPage(db, 'pilot', 'p2')).toBeNull()
    expect(await homebrewPatterns(db)).toEqual([])
  })

  test('a unit that moved keeps the row its new room wrote', async () => {
    const db = testDb()
    const shelf = publisher(db, 'account:d-1', 'd-1')
    const game = publisher(db, 'game:g1', null)
    shelf.set({ sheets: [sheet('p1')] })
    await shelf.it.changed()
    game.set({ sheets: [sheet('p1', 'In the Game')] })
    await game.it.changed()
    shelf.set({})
    await shelf.it.changed()
    expect(await publicPage(db, 'pilot', 'p1')).toMatchObject({ body: { name: 'In the Game' } })
  })

  test('changes while a write is out land as one more write, of the latest', async () => {
    const db = testDb()
    const shelf = publisher(db, 'account:d-1', 'd-1')
    shelf.set({ sheets: [sheet('p1', 'First')] })
    const first = shelf.it.changed()
    shelf.set({ sheets: [sheet('p1', 'Last')] })
    const second = shelf.it.changed()
    expect(second).toBe(first)
    await second
    expect(await publicPage(db, 'pilot', 'p1')).toMatchObject({ body: { name: 'Last' } })
  })

  test('a Game room keeps its row, members and invite, and takes them with it when wiped', async () => {
    const db = testDb()
    const game = publisher(db, 'game:g1', null)
    const roster = (members: string[], invite: string | null) => ({
      gameId: 'g1',
      game: {
        name: 'Tenacity',
        mediatedBy: 'Med',
        members: members.map((discordId, i) => ({
          discordId,
          mediator: false,
          organizer: i === 0,
        })),
        invite,
      },
    })
    game.set({ roster: roster(['d-1', 'd-2'], 'CODE1') })
    await game.it.changed()
    expect(await gamesOf(db, 'd-2')).toEqual([
      { gameId: 'g1', name: 'Tenacity', mediator: false, organizer: false },
    ])
    expect(await invitePreview(db, 'CODE1')).toEqual({ gameName: 'Tenacity', mediatedBy: 'Med' })

    game.set({ roster: roster(['d-1'], 'CODE2') })
    await game.it.changed()
    expect(await gamesOf(db, 'd-2')).toEqual([])
    expect(await gameOfInvite(db, 'CODE1')).toBeNull()
    expect(await gameOfInvite(db, 'CODE2')).toBe('g1')

    game.set({ roster: { gameId: 'g1', game: null } })
    await game.it.changed()
    expect(await gamesOf(db, 'd-1')).toEqual([])
    expect(await gameOfInvite(db, 'CODE2')).toBeNull()
  })

  test('without a shared database it writes nothing and does not fail', async () => {
    const none = new RoomPublisher(undefined, 'game:g1', null, () => ({
      sheets: [sheet('p1')],
      homebrew: [],
    }))
    expect(await none.republish()).toEqual({ sheets: 1, homebrew: 0 })
  })
})

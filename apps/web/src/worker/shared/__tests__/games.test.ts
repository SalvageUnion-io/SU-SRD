import { describe, expect, it } from 'bun:test'
import { exportedRows } from '../accounts'
import { gameOfInvite, gamesOf, invitePreview, membershipOf } from '../games'
import { publishGame, testDb } from './d1'

/** Games as the rooms write them and the Worker reads them. */

async function table() {
  const db = testDb()
  await publishGame(db, 'g-1', {
    name: 'Reclamation',
    mediatedBy: 'Jrvs',
    members: [
      { discordId: 'u-1', mediator: true, organizer: true },
      { discordId: 'u-2', mediator: false, organizer: false },
    ],
    invite: 'K7QR2XA',
  })
  await publishGame(db, 'g-2', {
    name: 'Ashfall',
    mediatedBy: null,
    members: [{ discordId: 'u-1', mediator: false, organizer: false }],
  })
  return db
}

describe('memberships', () => {
  it("lists an account's Games by name, with its roles in each", async () => {
    const db = await table()
    expect(await gamesOf(db, 'u-1')).toEqual([
      { gameId: 'g-2', name: 'Ashfall', mediator: false, organizer: false },
      { gameId: 'g-1', name: 'Reclamation', mediator: true, organizer: true },
    ])
    expect(await gamesOf(db, 'nobody')).toEqual([])
    expect((await membershipOf(db, 'g-1', 'u-2'))?.mediator).toBe(false)
    expect(await membershipOf(db, 'g-2', 'u-2')).toBeNull()
  })
})

describe('invites', () => {
  it('names the Game and its Mediator, never the crew', async () => {
    const db = await table()
    expect(await invitePreview(db, ' k7qr2xa ')).toEqual({
      gameName: 'Reclamation',
      mediatedBy: 'Jrvs',
    })
    expect(await gameOfInvite(db, 'K7QR2XA')).toBe('g-1')
  })
})

describe('a player’s Games, for export and deletion', () => {
  it('exports every Game deletion would reach: the room’s notes beside the memberships', async () => {
    const db = await table()
    // g-3 is noted by the player's room, its publish not landed yet.
    expect((await exportedRows(db, 'u-1', ['g-3', 'g-1'])).games).toEqual([
      { gameId: 'g-3', mediator: false, organizer: false },
      { gameId: 'g-1', mediator: true, organizer: true },
      { gameId: 'g-2', mediator: false, organizer: false },
    ])
  })
})

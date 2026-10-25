import { describe, expect, it } from 'bun:test'
import {
  dropGame,
  dropMembership,
  gameOfInvite,
  gamesOf,
  invitePreview,
  membershipOf,
  putGame,
  putInvite,
  putMembership,
} from '../games'
import { testDb } from './d1'

/** Games as the rooms write them and the Worker reads them. */

async function table() {
  const db = testDb()
  await putGame(db, { gameId: 'g-1', name: 'Reclamation', mediatedBy: 'Jrvs' })
  await putGame(db, { gameId: 'g-2', name: 'Ashfall', mediatedBy: null })
  await putMembership(db, { gameId: 'g-1', accountId: 'u-1', mediator: true, organizer: true })
  await putMembership(db, { gameId: 'g-2', accountId: 'u-1', mediator: false, organizer: false })
  await putMembership(db, { gameId: 'g-1', accountId: 'u-2', mediator: false, organizer: false })
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
  })

  it('replaces a role, and forgets a member who left', async () => {
    const db = await table()
    await putMembership(db, { gameId: 'g-1', accountId: 'u-2', mediator: true, organizer: false })
    expect((await membershipOf(db, 'g-1', 'u-2'))?.mediator).toBe(true)
    await dropMembership(db, 'g-1', 'u-2')
    expect(await membershipOf(db, 'g-1', 'u-2')).toBeNull()
  })

  it('goes with its Game, and the invite too', async () => {
    const db = await table()
    await putInvite(db, 'g-1', 'K7QR2XA')
    await dropGame(db, 'g-1')
    expect(await gamesOf(db, 'u-1')).toEqual([
      { gameId: 'g-2', name: 'Ashfall', mediator: false, organizer: false },
    ])
    expect(await gameOfInvite(db, 'K7QR2XA')).toBeNull()
  })
})

describe('invites', () => {
  it('names the Game and its Mediator, never the crew', async () => {
    const db = await table()
    await putInvite(db, 'g-1', 'K7QR2XA')
    expect(await invitePreview(db, 'K7QR2XA')).toEqual({
      gameName: 'Reclamation',
      mediatedBy: 'Jrvs',
    })
    expect(await gameOfInvite(db, 'K7QR2XA')).toBe('g-1')
  })

  it('a reset code stops the old one at once', async () => {
    const db = await table()
    await putInvite(db, 'g-1', 'OLDCODE')
    await putInvite(db, 'g-1', 'NEWCODE')
    expect(await invitePreview(db, 'OLDCODE')).toBeNull()
    expect(await gameOfInvite(db, 'NEWCODE')).toBe('g-1')
  })
})

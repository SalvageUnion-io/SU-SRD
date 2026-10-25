import { describe, expect, it } from 'bun:test'
import { FEEDBACK_REFUSAL, FEEDBACK_THANKS } from 'game-domain/feedback'
import { answerBot as answer } from '../botGateway'
import { testDb } from '../shared/__tests__/d1'
import { markFilled } from '../shared/db'
import { putGame, putMembership } from '../shared/games'

/**
 * The bot's gateway answers from the shared database once it is filled, as
 * `/bot/*` would, and leaves everything else to Convex (null).
 */

/** A filled database with Rosa signed in with Discord and in one Game. */
async function filled() {
  const db = testDb()
  // The sign-in creates `accounts` on first use; the rows here are its columns.
  db.sqlite.exec(`create table accounts (account_id text primary key, discord_id text unique,
    name text, display_name text, avatar_url text)`)
  db.sqlite.exec(`insert into accounts values ('acct-rosa', 'd-rosa', 'rosa', 'Rosa', null)`)
  await putGame(db, { gameId: 'g-1', name: 'Reclamation', mediatedBy: 'Rosa' })
  await putMembership(db, {
    gameId: 'g-1',
    discordId: 'd-rosa',
    mediator: true,
    organizer: true,
  })
  await markFilled(db, 1)
  return db
}

/** The gateway's answer, untyped: these tests read the wire body itself. */
const answerBot = (...args: Parameters<typeof answer>): Promise<unknown> => answer(...args)

const RECLAMATION = { gameId: 'g-1', name: 'Reclamation', mediator: true, organizer: true }

describe('answerBot', () => {
  it('leaves every op to Convex until the database is filled', async () => {
    const db = testDb()
    expect(await answerBot(undefined, 'me', { discordId: 'd-rosa' })).toBeNull()
    expect(await answerBot(db, 'me', { discordId: 'd-rosa' })).toBeNull()
    expect(await answerBot(db, 'usage', { name: 'roll' })).toBeNull()
    expect(db.sqlite.query('select count(*) as n from usage_counts').get()).toEqual({ n: 0 })
  })

  it('answers me and games from the account and its memberships', async () => {
    const db = await filled()
    expect(await answerBot(db, 'me', { discordId: 'd-rosa' })).toEqual({
      ok: true,
      user: { userId: 'acct-rosa', displayName: 'Rosa', avatarUrl: null },
      games: [RECLAMATION],
    })
    expect(await answerBot(db, 'games', { discordId: 'd-rosa' })).toEqual({
      ok: true,
      games: [RECLAMATION],
    })
  })

  it('refuses a Discord user no account carries', async () => {
    const db = await filled()
    expect(await answerBot(db, 'games', { discordId: 'd-nobody' })).toMatchObject({
      ok: false,
      reason: 'unlinked',
    })
  })

  it('counts a command and its server', async () => {
    const db = await filled()
    expect(await answerBot(db, 'usage', { name: ' roll ', guildId: 'guild-1' })).toEqual({
      ok: true,
    })
    expect(db.sqlite.query('select key, count from usage_counts').all()).toEqual([
      { key: 'bot:roll', count: 1 },
    ])
    expect(db.sqlite.query('select guild_id from bot_guilds').all()).toEqual([
      { guild_id: 'guild-1' },
    ])
  })

  it('takes feedback, and words a refusal', async () => {
    const db = await filled()
    const note = { discordId: 'd-rosa', kind: 'report', text: 'The Mule page lists no systems.' }
    expect(await answerBot(db, 'feedback', note)).toEqual({
      ok: true,
      accepted: true,
      message: FEEDBACK_THANKS,
    })
    expect(await answerBot(db, 'feedback', { ...note, text: 'hm' })).toEqual({
      ok: true,
      accepted: false,
      message: FEEDBACK_REFUSAL.short,
    })
    expect(db.sqlite.query('select sender, source from feedback').all()).toEqual([
      { sender: 'd-rosa', source: 'bot' },
    ])
  })

  it('binds and unbinds a channel, naming the Game by id or by name', async () => {
    const db = await filled()
    const bind = { discordId: 'd-rosa', channelId: 'c-1', channelName: 'salvage-run' }
    expect(await answerBot(db, 'bindChannel', { ...bind, game: 'reclamation' })).toMatchObject({
      ok: true,
      binding: { channelId: 'c-1', gameId: 'g-1', gameName: 'Reclamation' },
    })
    expect(await answerBot(db, 'bindChannel', { ...bind, game: 'g-1' })).toMatchObject({ ok: true })
    expect(await answerBot(db, 'bindChannel', { ...bind, game: 'Nowhere' })).toMatchObject({
      reason: 'not-found',
    })
    expect(
      await answerBot(db, 'unbindChannel', { discordId: 'd-rosa', channelId: 'c-1' })
    ).toMatchObject({
      ok: true,
      unbound: { channelId: 'c-1' },
    })
    expect(await answerBot(db, 'bindChannel', { ...bind, discordId: 'd-nobody' })).toMatchObject({
      reason: 'unlinked',
    })
  })

  it('leaves the rooms’ ops to Convex without the rooms', async () => {
    const db = await filled()
    for (const op of ['sheet', 'mine'] as const) {
      expect(await answerBot(db, op, { discordId: 'd-rosa' })).toBeNull()
    }
  })

  it('leaves the rooms’ ops to Convex when a room cannot answer', async () => {
    const db = await filled()
    const cannot = () => ({
      unitsFor: async () => {
        throw new TypeError('unitsFor is not a function')
      },
      unit: async () => {
        throw new TypeError('unit is not a function')
      },
    })
    const rooms = { account: cannot, game: cannot }
    const args = { discordId: 'd-rosa', table: 'pilots', entityId: 'p-1' }
    for (const op of ['sheet', 'mine'] as const) {
      expect(await answerBot(db, op, args, rooms)).toBeNull()
    }
  })
})

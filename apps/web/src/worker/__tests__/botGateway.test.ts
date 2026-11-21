import { describe, expect, it } from 'bun:test'
import { FEEDBACK_REFUSAL, FEEDBACK_THANKS } from 'game-domain/feedback'
import { answerBot as answer } from '../botGateway'
import type { BotRooms } from '../botSheets'
import { publishGame, signedIn, testDb } from '../shared/__tests__/d1'

/**
 * The bot's gateway answers from the shared database and the rooms, and null
 * (which the bot says as unavailable) where it cannot.
 */

/** A database with Rosa signed in with Discord and in one Game. */
async function filled() {
  const db = testDb()
  signedIn(db, { accountId: 'acct-rosa', discordId: 'd-rosa', name: 'rosa' })
  await publishGame(db, 'g-1', {
    name: 'Reclamation',
    mediatedBy: 'Rosa',
    members: [{ discordId: 'd-rosa', mediator: true, organizer: true }],
  })
  return db
}

/** The gateway's answer, untyped: these tests read the wire body itself. */
const answerBot = (...args: Parameters<typeof answer>): Promise<unknown> => answer(...args)

const RECLAMATION = { gameId: 'g-1', name: 'Reclamation', mediator: true, organizer: true }

describe('answerBot', () => {
  it('answers nothing without the database', async () => {
    expect(await answerBot(undefined, 'me', { discordId: 'd-rosa' })).toBeNull()
  })

  it('answers me and games from the account and its memberships', async () => {
    const db = await filled()
    expect(await answerBot(db, 'me', { discordId: 'd-rosa' })).toEqual({
      ok: true,
      user: { userId: 'acct-rosa', displayName: 'rosa', avatarUrl: null },
      games: [RECLAMATION],
    })
    // The name she set herself, which her account room keeps, wins over Discord's.
    const named = {
      account: () => ({ profile: async () => ({ displayName: 'Rosa', avatarUrl: null }) }),
    } as unknown as BotRooms
    expect(await answerBot(db, 'me', { discordId: 'd-rosa' }, named)).toMatchObject({
      user: { displayName: 'Rosa' },
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
      { sender: 'discord:d-rosa', source: 'bot' },
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

  it('passes Manage Channels through to the binding rules', async () => {
    const db = await filled()
    signedIn(db, { accountId: 'acct-tam', discordId: 'd-tam', name: 'tam' })
    const bind = { discordId: 'd-rosa', channelId: 'c-1' }
    expect(await answerBot(db, 'bindChannel', { ...bind, manageChannels: false })).toMatchObject({
      reason: 'forbidden',
    })
    expect(await answerBot(db, 'bindChannel', { ...bind, manageChannels: true })).toMatchObject({
      ok: true,
    })
    const unbind = { discordId: 'd-tam', channelId: 'c-1' }
    expect(await answerBot(db, 'unbindChannel', unbind)).toMatchObject({ reason: 'forbidden' })
    expect(await answerBot(db, 'unbindChannel', { ...unbind, manageChannels: true })).toMatchObject(
      { ok: true, unbound: { channelId: 'c-1' } }
    )
  })

  it('puts a public roll in a Game’s bound channel on that Game’s log, as its roller', async () => {
    const db = await filled()
    signedIn(db, { accountId: 'acct-sol', discordId: 'd-sol', name: 'sol' })
    await answerBot(db, 'bindChannel', { discordId: 'd-rosa', channelId: 'c-1', game: 'g-1' })
    const acts: unknown[] = []
    const rooms = {
      account: () => ({ profile: async () => null }),
    } as unknown as BotRooms
    const log = (gameId: string) => ({
      act: async (actor: string, name: string, args: unknown) => {
        acts.push({ gameId, actor, name, args })
        return { ok: true }
      },
    })
    const roll = { channelId: 'c-1', tableName: 'Core Mechanic', rolls: [14], outcome: 'Success' }
    expect(await answerBot(db, 'logRoll', { ...roll, discordId: 'd-rosa' }, rooms, log)).toEqual({
      ok: true,
      logged: true,
    })
    expect(acts).toHaveLength(1)
    expect(acts[0]).toMatchObject({
      gameId: 'g-1',
      actor: 'd-rosa',
      name: 'changeLog.appendChangeLog',
      args: {
        entries: [
          {
            entityType: 'game',
            field: 'roll',
            source: 'discord',
            after: {
              description: 'rosa · Core Mechanic · 14 · Success',
              result: { kind: 'core', roll: 14, outcome: 'Success' },
            },
          },
        ],
      },
    })
    // Somebody not in the Game, an unbound channel, a roll no die made: nothing is logged.
    const none = { ok: true, logged: false }
    expect(await answerBot(db, 'logRoll', { ...roll, discordId: 'd-sol' }, rooms, log)).toEqual(
      none
    )
    expect(
      await answerBot(db, 'logRoll', { ...roll, discordId: 'd-rosa', channelId: 'c-9' }, rooms, log)
    ).toEqual(none)
    expect(
      await answerBot(db, 'logRoll', { ...roll, discordId: 'd-rosa', rolls: [99] }, rooms, log)
    ).toEqual(none)
    expect(acts).toHaveLength(1)
  })

  it('cannot answer the rooms’ ops without the rooms', async () => {
    const db = await filled()
    for (const op of ['sheet', 'mine'] as const) {
      expect(await answerBot(db, op, { discordId: 'd-rosa' })).toBeNull()
    }
  })

  it('cannot answer the rooms’ ops when a room cannot answer', async () => {
    const db = await filled()
    const cannot = () => ({
      unitsFor: async () => {
        throw new TypeError('unitsFor is not a function')
      },
      unit: async () => {
        throw new TypeError('unit is not a function')
      },
    })
    const rooms = { account: () => ({ ...cannot(), profile: async () => null }), game: cannot }
    const args = { discordId: 'd-rosa', table: 'pilots', entityId: 'p-1' }
    for (const op of ['sheet', 'mine'] as const) {
      expect(await answerBot(db, op, args, rooms)).toBeNull()
    }
  })
})

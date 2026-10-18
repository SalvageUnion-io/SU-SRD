import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { api, internal } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Ctx, User } from '../fixtures'
import { addPilot, makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Discord channel bindings (`/su bind`, `/su unbind`) and posting Play's rolls
 * through them (`channelBindings.postRoll`).
 *
 * The bot reaches the bindings through `botClient.bindChannel` /
 * `unbindChannel` (its `/bot/*` door forwards there), so the permissions are
 * proven against those: who may bind a Game's channel, solo bindings, taking
 * over a channel. `postRoll` reaches Discord through the bot Worker's relay,
 * which is `fetch` here.
 */

/** A Game whose Organiser (`organizer`, who runs it while it has no Mediator) and player both have Discord. */
async function seedDiscordTable(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer', 'd-org')
  const player = await makeUser(t, 'Player', 'd-player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.link, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  return { organizer, player, gameId }
}

async function bind(
  t: Ctx,
  discordId: string,
  channelId: string,
  game?: string,
  channelName?: string
) {
  return await t.mutation(internal.botClient.bindChannel, {
    discordId,
    channelId,
    ...(game === undefined ? {} : { game }),
    ...(channelName === undefined ? {} : { channelName }),
  })
}

async function unbind(t: Ctx, discordId: string, channelId: string) {
  return await t.mutation(internal.botClient.unbindChannel, { discordId, channelId })
}

async function bindings(t: Ctx) {
  const rows = await t.run(async (ctx) => await ctx.db.query('channelBindings').collect())
  return rows.map((row) => ({ channelId: row.channelId, gameId: row.gameId ?? null }))
}

describe('/su bind', () => {
  test('the Organiser binds a channel to the Game', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    expect(await bind(t, 'd-org', 'chan-1', gameId)).toEqual({
      ok: true,
      binding: { channelId: 'chan-1', channelName: null, gameId, gameName: 'Tenacity' },
      previousChannelId: null,
    })
    expect(await bindings(t)).toEqual([{ channelId: 'chan-1', gameId }])
  })

  test('the Mediator binds a channel to the Game', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedDiscordTable(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: player.userId,
      mediator: true,
    })
    expect(await bind(t, 'd-player', 'chan-1', gameId)).toMatchObject({ ok: true })
  })

  test('a player who neither mediates nor organises is refused', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    expect(await bind(t, 'd-player', 'chan-1', gameId)).toMatchObject({
      ok: false,
      reason: 'forbidden',
    })
    expect(await bindings(t)).toEqual([])
  })

  test('a Game the caller is not in is not-found, whatever its id', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    await makeUser(t, 'Stranger', 'd-stranger')
    expect(await bind(t, 'd-stranger', 'chan-1', gameId)).toMatchObject({
      ok: false,
      reason: 'not-found',
    })
    expect(await bind(t, 'd-stranger', 'chan-1', 'not-an-id')).toMatchObject({
      ok: false,
      reason: 'not-found',
    })
  })

  test('a Game name typed by hand finds the caller’s Game', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    expect(await bind(t, 'd-org', 'chan-1', 'tenacity')).toMatchObject({
      ok: true,
      binding: { gameId },
    })
  })

  test('somebody with no account is unlinked', async () => {
    const t = testConvex()
    expect(await bind(t, 'd-nobody', 'chan-1')).toMatchObject({ ok: false, reason: 'unlinked' })
  })

  test('with no Game, anyone binds their own solo play', async () => {
    const t = testConvex()
    await seedDiscordTable(t)
    expect(await bind(t, 'd-player', 'chan-solo')).toEqual({
      ok: true,
      binding: { channelId: 'chan-solo', channelName: null, gameId: null, gameName: null },
      previousChannelId: null,
    })
    expect(await bindings(t)).toEqual([{ channelId: 'chan-solo', gameId: null }])
  })

  test('binding again moves the binding: one channel per Game, one per person', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', 'chan-1', gameId)
    expect(await bind(t, 'd-org', 'chan-2', gameId)).toMatchObject({
      ok: true,
      previousChannelId: 'chan-1',
    })
    await bind(t, 'd-player', 'solo-1')
    expect(await bind(t, 'd-player', 'solo-2')).toMatchObject({ previousChannelId: 'solo-1' })
    expect(await bindings(t)).toEqual([
      { channelId: 'chan-2', gameId },
      { channelId: 'solo-2', gameId: null },
    ])
  })

  test('binding a channel to what it already holds changes nothing', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', 'chan-1', gameId)
    expect(await bind(t, 'd-org', 'chan-1', gameId)).toMatchObject({
      ok: true,
      previousChannelId: null,
    })
    expect(await bindings(t)).toHaveLength(1)
  })

  test('the channel’s name is kept, without its #, and a rebind after a rename updates it', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedDiscordTable(t)
    expect(await bind(t, 'd-org', 'chan-1', gameId, ' #salvage-run ')).toMatchObject({
      ok: true,
      binding: { channelId: 'chan-1', channelName: 'salvage-run' },
    })
    expect((await organizer.as.query(api.channelBindings.current, { gameId }))?.channelName).toBe(
      'salvage-run'
    )

    // The channel was renamed in Discord; `/su bind` again keeps the new name.
    expect(await bind(t, 'd-org', 'chan-1', gameId, 'rust-belt-run')).toMatchObject({
      ok: true,
      binding: { channelName: 'rust-belt-run' },
      previousChannelId: null,
    })
    // A bot that sends no name leaves the kept one alone.
    await bind(t, 'd-org', 'chan-1', gameId)
    const mine = await organizer.as.query(api.channelBindings.mine, {})
    expect(mine.games[0]?.binding?.channelName).toBe('rust-belt-run')
    expect(await bindings(t)).toEqual([{ channelId: 'chan-1', gameId }])
  })

  test('a solo binding keeps its name too; a blank one is none', async () => {
    const t = testConvex()
    const { player } = await seedDiscordTable(t)
    await bind(t, 'd-player', 'solo-1', undefined, '   ')
    expect((await player.as.query(api.channelBindings.current, {}))?.channelName).toBeNull()
    await bind(t, 'd-player', 'solo-2', undefined, 'my-salvage')
    expect(await player.as.query(api.channelBindings.current, {})).toMatchObject({
      channelId: 'solo-2',
      channelName: 'my-salvage',
    })
  })

  test('a channel somebody else holds cannot be taken over', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', 'chan-1', gameId)
    // The player binding their solo play into the Game's channel.
    expect(await bind(t, 'd-player', 'chan-1')).toMatchObject({
      ok: false,
      reason: 'forbidden',
    })
    // Nor the Organiser into a player's solo channel.
    await bind(t, 'd-player', 'solo-1')
    expect(await bind(t, 'd-org', 'solo-1', gameId)).toMatchObject({
      ok: false,
      reason: 'forbidden',
    })
    expect(await bindings(t)).toEqual([
      { channelId: 'chan-1', gameId },
      { channelId: 'solo-1', gameId: null },
    ])
  })

  test('whoever could unbind a channel may rebind it to something else', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', 'chan-1', gameId)
    expect(await bind(t, 'd-org', 'chan-1')).toMatchObject({ ok: true })
    expect(await bindings(t)).toEqual([{ channelId: 'chan-1', gameId: null }])
  })
})

describe('/su unbind', () => {
  test('the Organiser unbinds the Game’s channel; a player cannot', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', 'chan-1', gameId)
    expect(await unbind(t, 'd-player', 'chan-1')).toMatchObject({
      ok: false,
      reason: 'forbidden',
    })
    expect(await unbind(t, 'd-org', 'chan-1')).toEqual({
      ok: true,
      unbound: { channelId: 'chan-1', channelName: null, gameId, gameName: 'Tenacity' },
    })
    expect(await bindings(t)).toEqual([])
  })

  test('only its owner unbinds a solo channel', async () => {
    const t = testConvex()
    await seedDiscordTable(t)
    await bind(t, 'd-player', 'solo-1')
    expect(await unbind(t, 'd-org', 'solo-1')).toMatchObject({ ok: false, reason: 'forbidden' })
    expect(await unbind(t, 'd-player', 'solo-1')).toMatchObject({ ok: true })
  })

  test('a channel with nothing bound is already unbound', async () => {
    const t = testConvex()
    await seedDiscordTable(t)
    expect(await unbind(t, 'd-player', 'chan-x')).toEqual({ ok: true, unbound: null })
  })
})

describe('reading the bindings', () => {
  test('mine: each of my Games with its channel, and my solo channel', async () => {
    const t = testConvex()
    const { player, gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', 'chan-1', gameId)
    await bind(t, 'd-player', 'solo-1')

    const mine = await player.as.query(api.channelBindings.mine, {})
    expect(mine.personal?.channelId).toBe('solo-1')
    expect(mine.games).toEqual([
      {
        gameId,
        gameName: 'Tenacity',
        mayBind: false,
        binding: { channelId: 'chan-1', channelName: null, boundAt: expect.any(Number) },
      },
    ])
  })

  test('current: the Game’s channel for a member, mine when solo, null for a stranger', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedDiscordTable(t)
    const stranger = await makeUser(t, 'Stranger')
    await bind(t, 'd-org', 'chan-1', gameId)

    expect((await organizer.as.query(api.channelBindings.current, { gameId }))?.channelId).toBe(
      'chan-1'
    )
    expect(await organizer.as.query(api.channelBindings.current, {})).toBeNull()
    expect(await stranger.as.query(api.channelBindings.current, { gameId })).toBeNull()
  })
})

describe('postRoll', () => {
  const ROLL = { tableName: 'Core Mechanic', rolls: [14] }
  const realFetch = globalThis.fetch
  const savedEnv = { url: process.env.CANTINA_BOT_URL, secret: process.env.CANTINA_BOT_SECRET }
  let calls: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = []

  /** The bot Worker's relay, answering every post with `respond`. */
  function stubRelay(respond: () => Response | Promise<Response>) {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(input),
        auth: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      })
      return await respond()
    }) as typeof fetch
  }

  beforeEach(() => {
    calls = []
    process.env.CANTINA_BOT_URL = 'https://bot.example/'
    process.env.CANTINA_BOT_SECRET = 'shh'
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    process.env.CANTINA_BOT_URL = savedEnv.url
    process.env.CANTINA_BOT_SECRET = savedEnv.secret
    if (savedEnv.url === undefined) delete process.env.CANTINA_BOT_URL
    if (savedEnv.secret === undefined) delete process.env.CANTINA_BOT_SECRET
  })

  async function postAs(
    user: User,
    args: { gameId?: Id<'games'>; pilotId?: string; post?: boolean }
  ) {
    return await user.as.action(api.channelBindings.postRoll, {
      ...(args.gameId === undefined ? {} : { gameId: args.gameId }),
      ...(args.pilotId === undefined ? {} : { pilotId: args.pilotId }),
      roll: ROLL,
      post: args.post ?? true,
    })
  }

  test('posts a Game roll to its channel through the relay', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedDiscordTable(t)
    await addPilot(player, 'p1', gameId)
    await bind(t, 'd-org', '1234', gameId)
    stubRelay(() => Response.json({ ok: true, messageId: 'msg-1' }))

    expect(await postAs(player, { gameId, pilotId: 'p1' })).toEqual({
      kind: 'posted',
      channelId: '1234',
      messageId: 'msg-1',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://bot.example/relay/post-roll')
    expect(calls[0]?.auth).toBe('Bearer shh')
    expect(calls[0]?.body).toEqual({
      channelId: '1234',
      tableName: 'Core Mechanic',
      rolls: [14],
      roller: 'p1',
      ownerDiscordId: 'd-player',
    })
    // Nobody else's pilot names the roller: the Organiser falls back to their name.
    await postAs(organizer, { gameId, pilotId: 'not-theirs' })
    expect(calls[1]?.body.roller).toBe('Organizer')
  })

  test('a failed post is returned with its reason, never silent', async () => {
    const t = testConvex()
    const { player, gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', '1234', gameId)
    const message = 'The bot cannot post in the bound channel.'
    stubRelay(() => Response.json({ ok: false, status: 403, message }))

    expect(await postAs(player, { gameId })).toEqual({
      kind: 'failed',
      channelId: '1234',
      message,
    })
  })

  test('an unreachable bot is a failure with a reason', async () => {
    const t = testConvex()
    const { player, gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', '1234', gameId)
    stubRelay(() => {
      throw new Error('ECONNREFUSED')
    })
    expect(await postAs(player, { gameId })).toMatchObject({
      kind: 'failed',
      message: 'The Discord bot could not be reached.',
    })
  })

  test('an unconfigured deployment fails loudly rather than skipping', async () => {
    const t = testConvex()
    const { player, gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', '1234', gameId)
    delete process.env.CANTINA_BOT_URL
    stubRelay(() => Response.json({ ok: true, messageId: 'x' }))

    expect(await postAs(player, { gameId })).toMatchObject({ kind: 'failed' })
    expect(calls).toHaveLength(0)
  })

  test('nothing bound posts nothing', async () => {
    const t = testConvex()
    const { player, gameId } = await seedDiscordTable(t)
    stubRelay(() => Response.json({ ok: true, messageId: 'x' }))
    expect(await postAs(player, { gameId })).toEqual({ kind: 'unbound' })
    expect(await postAs(player, {})).toEqual({ kind: 'unbound' })
    expect(calls).toHaveLength(0)
  })

  test('unbinding stops posting', async () => {
    const t = testConvex()
    const { player, gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', '1234', gameId)
    await unbind(t, 'd-org', '1234')
    stubRelay(() => Response.json({ ok: true, messageId: 'x' }))
    expect(await postAs(player, { gameId })).toEqual({ kind: 'unbound' })
    expect(calls).toHaveLength(0)
  })

  test('post: false posts nothing, bound or not', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', '1234', gameId)
    stubRelay(() => Response.json({ ok: true, messageId: 'x' }))
    expect(await postAs(organizer, { gameId, post: false })).toEqual({ kind: 'skipped' })
    expect(calls).toHaveLength(0)
  })

  test('solo rolls post to the roller’s own channel', async () => {
    const t = testConvex()
    const { player } = await seedDiscordTable(t)
    await addPilot(player, 'p-solo', null)
    await bind(t, 'd-player', '5678')
    stubRelay(() => Response.json({ ok: true, messageId: 'msg-2' }))
    expect(await postAs(player, { pilotId: 'p-solo' })).toMatchObject({
      kind: 'posted',
      channelId: '5678',
    })
    expect(calls[0]?.body.roller).toBe('p-solo')
  })

  test('a Game the roller is not in is refused', async () => {
    const t = testConvex()
    const { gameId } = await seedDiscordTable(t)
    const stranger = await makeUser(t, 'Stranger')
    await bind(t, 'd-org', '1234', gameId)
    stubRelay(() => Response.json({ ok: true, messageId: 'x' }))
    await expect(postAs(stranger, { gameId })).rejects.toThrow('Not a member')
    expect(calls).toHaveLength(0)
  })

  test('a roll the card cannot replay is refused before anything is sent', async () => {
    const t = testConvex()
    const { player, gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', '1234', gameId)
    stubRelay(() => Response.json({ ok: true, messageId: 'x' }))
    const result = await player.as.action(api.channelBindings.postRoll, {
      gameId,
      roll: { tableName: 'Core Mechanic', rolls: [0] },
      post: true,
    })
    expect(result).toMatchObject({ kind: 'failed' })
    expect(calls).toHaveLength(0)
  })
})

describe('deleting an account', () => {
  test('takes its solo channel with it, and leaves the Game’s', async () => {
    const t = testConvex()
    const { player, gameId } = await seedDiscordTable(t)
    await bind(t, 'd-org', 'chan-1', gameId)
    await bind(t, 'd-player', 'solo-1')
    await player.as.mutation(api.account.deleteAccount, {})
    expect(await bindings(t)).toEqual([{ channelId: 'chan-1', gameId }])
  })
})

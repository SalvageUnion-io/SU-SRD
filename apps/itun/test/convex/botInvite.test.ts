import { describe, expect, test } from 'bun:test'
import { api, internal } from '../../convex/_generated/api'
import { BOT_OPS, isSignedOp, opFromPath } from '../../convex/botHttp'
import {
  isFresh,
  isSignedByDiscord,
  parseInviteInteraction,
  SIGNATURE_MAX_AGE_SECONDS,
} from '../../convex/model/discordInteraction'
import { testConvex } from './harness'

/**
 * `/su invite @user` on the Convex side (ADR-038 §3).
 *
 * The property everything here defends: **the bot's bearer credential cannot
 * mint a membership.** That rests on three things, each tested on its own —
 * the route accepts only Discord's signature over the exact bytes (and only
 * recent ones), the body must actually be a `/su invite`, and the internal
 * mutation reads who, whom and where from that body and nowhere else. Past
 * that it is the web's rules: only the Organizer invites.
 *
 * `botRoute` itself cannot be mounted in convex-test (see `botHttp.test.ts`),
 * so the verifier is tested as the pure function it is, and the mutation is
 * driven with the body the route would have verified.
 */

type Ctx = ReturnType<typeof testConvex>

const ENCODER = new TextEncoder()

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** A fresh Ed25519 keypair standing in for the Discord application's. */
async function discordKey() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const publicHex = hex(await crypto.subtle.exportKey('raw', pair.publicKey))
  const sign = async (timestamp: string, body: string) =>
    hex(
      await crypto.subtle.sign(
        { name: 'Ed25519' },
        pair.privateKey,
        ENCODER.encode(timestamp + body)
      )
    )
  return { publicHex, sign }
}

type BodyOptions = {
  id?: string
  inviter?: string
  invitee?: string
  username?: string
  globalName?: string | null
  bot?: boolean
  seat?: 'player' | 'mediator'
  game?: string
  channel?: string | null
  subcommand?: string
}

/** A `/su invite` interaction body, shaped the way Discord sends one. */
function inviteBody(o: BodyOptions = {}): string {
  const invitee = o.invitee ?? 'snowflake-sam'
  const options: Array<{ name: string; type: number; value: string }> = [
    { name: 'user', type: 6, value: invitee },
  ]
  if (o.seat !== undefined) options.push({ name: 'seat', type: 3, value: o.seat })
  if (o.game !== undefined) options.push({ name: 'game', type: 3, value: o.game })
  return JSON.stringify({
    id: o.id ?? 'interaction-1',
    type: 2,
    channel_id: o.channel === undefined ? 'chan-1' : o.channel,
    member: { user: { id: o.inviter ?? 'snowflake-vex' } },
    data: {
      name: 'su',
      options: [{ name: o.subcommand ?? 'invite', type: 1, options }],
      resolved: {
        users: {
          [invitee]: {
            id: invitee,
            username: o.username ?? 'sam',
            global_name: o.globalName === undefined ? 'Sam' : o.globalName,
            bot: o.bot ?? false,
          },
        },
      },
    },
  })
}

async function makeUser(t: Ctx, name: string, discordId?: string) {
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('users', { name, displayName: name })
    if (discordId !== undefined) {
      await ctx.db.insert('authAccounts', {
        userId: id,
        provider: 'discord',
        providerAccountId: discordId,
      })
    }
    return id
  })
  return { userId, as: t.withIdentity({ subject: userId }) }
}

/** Vex organises Tenacity, bound to chan-1; Pat is a member but not Organizer. */
async function seedBoundGame(t: Ctx) {
  const vex = await makeUser(t, 'Vex', 'snowflake-vex')
  const pat = await makeUser(t, 'Pat', 'snowflake-pat')
  const gameId = await vex.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await vex.as.mutation(api.invites.create, { gameId })
  await pat.as.mutation(api.invites.redeem, { code })
  await t.mutation(internal.botClient.bind, {
    discordId: 'snowflake-vex',
    channelId: 'chan-1',
    gameId,
  })
  return { vex, pat, gameId }
}

function invite(t: Ctx, o: BodyOptions = {}) {
  return t.mutation(internal.botClient.invite, { body: inviteBody(o) })
}

describe('the signature check', () => {
  test('accepts Discord’s signature over the exact bytes, and nothing else', async () => {
    const key = await discordKey()
    const body = inviteBody()
    const ts = '1700000000'
    const signature = await key.sign(ts, body)

    expect(await isSignedByDiscord(key.publicHex, body, signature, ts)).toBe(true)
    // One byte of the body, the timestamp, or the key — each is a forgery.
    expect(await isSignedByDiscord(key.publicHex, body.replace('sam', 'pat'), signature, ts)).toBe(
      false
    )
    expect(await isSignedByDiscord(key.publicHex, body, signature, '1700000001')).toBe(false)
    const other = await discordKey()
    expect(await isSignedByDiscord(other.publicHex, body, signature, ts)).toBe(false)
  })

  test('a re-serialised body fails, even though it parses identically', async () => {
    const key = await discordKey()
    const body = inviteBody()
    const ts = '1700000000'
    const signature = await key.sign(ts, body)
    const reformatted = JSON.stringify(JSON.parse(body), null, 1)

    expect(await isSignedByDiscord(key.publicHex, reformatted, signature, ts)).toBe(false)
  })

  test('missing or malformed headers are unverified, never a throw', async () => {
    const key = await discordKey()
    expect(await isSignedByDiscord(key.publicHex, 'x', null, '1')).toBe(false)
    expect(await isSignedByDiscord(key.publicHex, 'x', 'abc', null)).toBe(false)
    expect(await isSignedByDiscord(key.publicHex, 'x', 'not-hex!', '1')).toBe(false)
    expect(await isSignedByDiscord('zz', 'x', 'ab', '1')).toBe(false)
  })

  test('only a recent timestamp is fresh', () => {
    const now = 1_700_000_000_000
    expect(isFresh('1700000000', now)).toBe(true)
    expect(isFresh(String(1_700_000_000 - SIGNATURE_MAX_AGE_SECONDS - 1), now)).toBe(false)
    expect(isFresh(String(1_700_000_000 + SIGNATURE_MAX_AGE_SECONDS + 1), now)).toBe(false)
    expect(isFresh(null, now)).toBe(false)
    expect(isFresh('soon', now)).toBe(false)
  })
})

describe('reading the interaction', () => {
  test('reads who, whom, where and which seat out of the body', () => {
    expect(parseInviteInteraction(inviteBody({ seat: 'mediator', game: 'g123' }))).toEqual({
      interactionId: 'interaction-1',
      inviterId: 'snowflake-vex',
      channelId: 'chan-1',
      invitee: { id: 'snowflake-sam', username: 'sam', displayName: 'Sam', bot: false },
      role: 'mediator',
      gameId: 'g123',
    })
  })

  test('a signed interaction that is not /su invite is not an invite', () => {
    // Otherwise a captured /su roll, validly signed, could be replayed here.
    expect(parseInviteInteraction(inviteBody({ subcommand: 'roll' }))).toBeNull()
    expect(parseInviteInteraction(inviteBody().replace('"type":2', '"type":3'))).toBeNull()
    expect(parseInviteInteraction('not json')).toBeNull()
  })

  test('falls back to the handle when Discord has no display name', () => {
    expect(parseInviteInteraction(inviteBody({ globalName: null }))?.invitee.displayName).toBe(
      'sam'
    )
  })
})

describe('the route', () => {
  test('invite is a signed op, and nothing else is', () => {
    expect(opFromPath('/bot/invite')).toBe('invite')
    expect(isSignedOp('invite')).toBe(true)
    for (const op of BOT_OPS.filter((name) => name !== 'invite')) {
      expect(isSignedOp(op)).toBe(false)
    }
  })
})

describe('botClient.invite', () => {
  test('the Organizer invites into the bound Game, and only the invitee can redeem it', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)

    const result = await invite(t)
    expect(result).toMatchObject({
      ok: true,
      outcome: 'invited',
      gameName: 'Tenacity',
      invitedBy: 'Vex',
      inviteeDiscordId: 'snowflake-sam',
      inviteeName: 'Sam',
      role: 'player',
      reused: false,
    })
    if (!result.ok || result.outcome !== 'invited') throw new Error('expected an invite')

    const stranger = await makeUser(t, 'Stranger', 'snowflake-stranger')
    await expect(stranger.as.mutation(api.invites.redeem, { code: result.code })).rejects.toThrow(
      /different Discord account/
    )
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')
    expect((await sam.as.mutation(api.invites.redeem, { code: result.code })).kind).toBe('joined')

    const [row] = await t.run((ctx) =>
      ctx.db
        .query('invites')
        .withIndex('by_code', (q) => q.eq('code', result.code))
        .collect()
    )
    expect(row?.gameId).toBe(gameId)
    expect(row?.target).toEqual({ kind: 'discord', discordId: 'snowflake-sam', name: 'sam' })
    expect(row?.delivery?.state).toBe('queued')
  })

  test('a member who is not the Organizer cannot invite', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    const result = await invite(t, { inviter: 'snowflake-pat' })
    expect(result).toMatchObject({ ok: false, reason: 'forbidden' })
  })

  test('someone with no account cannot invite', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    expect(await invite(t, { inviter: 'snowflake-nobody' })).toMatchObject({
      ok: false,
      reason: 'unlinked',
    })
  })

  test('a bot, or yourself, cannot be invited', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    expect(await invite(t, { bot: true })).toMatchObject({ ok: false, reason: 'forbidden' })
    expect(await invite(t, { invitee: 'snowflake-vex', username: 'vex' })).toMatchObject({
      ok: false,
      reason: 'forbidden',
    })
  })

  test('outside a bound channel the game option decides; with neither, it says so', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)

    expect(await invite(t, { channel: 'chan-elsewhere' })).toMatchObject({
      ok: false,
      reason: 'unbound',
    })
    expect(await invite(t, { channel: null, game: gameId })).toMatchObject({
      ok: true,
      outcome: 'invited',
    })
    expect(
      await invite(t, { id: 'interaction-2', channel: null, game: 'typed a name' })
    ).toMatchObject({ ok: false, reason: 'not-found' })
  })

  test('the game option cannot reach a Game the inviter does not organise', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    const other = await makeUser(t, 'Other', 'snowflake-other')
    const theirs = await other.as.mutation(api.games.create, { name: 'Not yours' })

    expect(await invite(t, { channel: null, game: theirs })).toMatchObject({
      ok: false,
      reason: 'forbidden',
    })
  })

  test('someone already seated is reported, not invited', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    expect(
      await invite(t, { invitee: 'snowflake-pat', username: 'pat', globalName: 'Pat' })
    ).toEqual({
      ok: true,
      outcome: 'already-member',
      gameName: 'Tenacity',
      inviteeName: 'Pat',
    })
  })

  test('a replayed interaction answers with the invite it already minted', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    const first = await invite(t)
    const replay = await invite(t)

    if (!first.ok || first.outcome !== 'invited') throw new Error('expected an invite')
    expect(replay).toMatchObject({ ok: true, outcome: 'invited', code: first.code, reused: true })
  })

  test('inviting the same person again re-sends their live invite', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedBoundGame(t)
    const first = await invite(t, { id: 'interaction-1' })
    const again = await invite(t, { id: 'interaction-2' })

    if (!first.ok || first.outcome !== 'invited') throw new Error('expected an invite')
    expect(again).toMatchObject({ outcome: 'invited', code: first.code, reused: true })
    const rows = await vex.as.query(api.invites.list, { gameId })
    expect(rows.filter((row) => row.target !== null)).toHaveLength(1)
  })

  test('changing the seat closes the old invite and sends one for the new seat', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedBoundGame(t)
    const first = await invite(t, { id: 'interaction-1' })
    const mediator = await invite(t, { id: 'interaction-2', seat: 'mediator' })

    if (!first.ok || first.outcome !== 'invited') throw new Error('expected an invite')
    if (!mediator.ok || mediator.outcome !== 'invited') throw new Error('expected an invite')
    expect(mediator.code).not.toBe(first.code)
    expect(mediator.role).toBe('mediator')

    const rows = await vex.as.query(api.invites.list, { gameId })
    expect(rows.find((row) => row.code === first.code)?.status).toBe('revoked')
  })
})

describe('the DM cooldown', () => {
  async function invited(t: Ctx, id: string) {
    const result = await invite(t, { id })
    if (!result.ok || result.outcome !== 'invited') throw new Error('expected an invite')
    return result
  }

  test('a new invite is to be DMed', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    expect((await invited(t, 'interaction-1')).deliver).toBe(true)
  })

  test('once DMed, re-running the command does not DM again, and keeps the outcome', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedBoundGame(t)
    const first = await invited(t, 'interaction-1')
    await t.mutation(internal.botClient.inviteDelivery, {
      discordId: 'snowflake-vex',
      code: first.code,
      state: 'sent',
    })

    const again = await invited(t, 'interaction-2')
    expect(again).toMatchObject({ code: first.code, reused: true, deliver: false })
    const [row] = await vex.as.query(api.invites.list, { gameId })
    expect(row?.delivery?.state).toBe('sent')
  })

  test('a DM still on its way counts as sent', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    await invited(t, 'interaction-1')
    expect((await invited(t, 'interaction-2')).deliver).toBe(false)
  })

  test('a DM that failed may be tried again', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    const first = await invited(t, 'interaction-1')
    await t.mutation(internal.botClient.inviteDelivery, {
      discordId: 'snowflake-vex',
      code: first.code,
      state: 'failed',
      detail: 'their DMs are closed',
    })
    expect((await invited(t, 'interaction-2')).deliver).toBe(true)
  })

  test('a day after the DM, it may be sent again', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    const first = await invited(t, 'interaction-1')
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('invites')
        .withIndex('by_code', (q) => q.eq('code', first.code))
        .unique()
      if (row !== null) {
        await ctx.db.patch(row._id, {
          delivery: { state: 'sent', at: Date.now() - 1000 * 60 * 60 * 25 },
        })
      }
    })
    expect((await invited(t, 'interaction-2')).deliver).toBe(true)
  })
})

describe('botClient.inviteDelivery', () => {
  test('records whether the DM arrived, for the Organizer’s list', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedBoundGame(t)
    const result = await invite(t)
    if (!result.ok || result.outcome !== 'invited') throw new Error('expected an invite')

    expect(
      await t.mutation(internal.botClient.inviteDelivery, {
        discordId: 'snowflake-vex',
        code: result.code,
        state: 'failed',
        detail: 'their DMs are closed',
      })
    ).toEqual({ ok: true })

    const [row] = await vex.as.query(api.invites.list, { gameId })
    expect(row?.delivery).toEqual({ state: 'failed', detail: 'their DMs are closed' })
  })

  test('only the Game’s Organizer can report on its invites', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    const result = await invite(t)
    if (!result.ok || result.outcome !== 'invited') throw new Error('expected an invite')

    expect(
      await t.mutation(internal.botClient.inviteDelivery, {
        discordId: 'snowflake-pat',
        code: result.code,
        state: 'sent',
      })
    ).toMatchObject({ ok: false, reason: 'forbidden' })
  })
})

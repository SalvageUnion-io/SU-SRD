import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { InviteTarget } from '../../convex/model/invites'
import { liveDiscordInvite, mintInvite, TARGETED_EXPIRY_MS } from '../../convex/model/invites'
import type { Ctx } from './fixtures'
import { makeUser } from './fixtures'
import { testConvex } from './harness'

/**
 * Addressed invites (ADR-039).
 *
 * The properties worth defending are the ones a UI cannot enforce: a
 * Discord-addressed invite is worth nothing to anybody but its addressee, an
 * addressed invite is one seat for one person whatever the caller asked for,
 * and nobody can decline on somebody else's behalf.
 *
 * Minting goes through `mintInvite` directly. Its caller that takes a target —
 * the bot's `/su invite` — proves the Organizer with Discord's signature and
 * is tested in `botInvite.test.ts`; this one is about what an addressed invite
 * *is* once it exists.
 */

async function seedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Vex', 'snowflake-vex')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  return { organizer, gameId }
}

/** Mint as the Game's Organizer, the way `/su invite` does. */
async function mint(
  t: Ctx,
  gameId: Id<'games'>,
  organizerId: Id<'users'>,
  args: { target: InviteTarget; requiresApproval?: boolean; usesRemaining?: number }
) {
  return await t.run(async (ctx) => {
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_game_user', (q) => q.eq('gameId', gameId).eq('userId', organizerId))
      .unique()
    if (membership === null) throw new Error('seed: organizer has no membership')
    return await mintInvite(ctx, membership, args)
  })
}

const SAM: InviteTarget = { kind: 'discord', discordId: 'snowflake-sam', name: 'sam' }

describe('a Discord-addressed invite', () => {
  test('seats its addressee', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    const result = await sam.as.mutation(api.invites.redeem, { code: invite.code })
    expect(result.kind).toBe('joined')
  })

  test('refuses anybody else, and the refusal names nobody', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const stranger = await makeUser(t, 'Stranger', 'snowflake-stranger')
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    const attempt = stranger.as.mutation(api.invites.redeem, { code: invite.code })
    await expect(attempt).rejects.toThrow(/different Discord account/)
    await expect(attempt).rejects.not.toThrow(/sam/i)
    // And nothing was spent: the addressee can still use it.
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')
    expect((await sam.as.mutation(api.invites.redeem, { code: invite.code })).kind).toBe('joined')
  })

  test('refuses an account with no Discord sign-in at all', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const passwordOnly = await makeUser(t, 'Test account')
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    await expect(
      passwordOnly.as.mutation(api.invites.redeem, { code: invite.code })
    ).rejects.toThrow(/different Discord account/)
  })

  test('is single use and needs no approval, whatever the caller asked for', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const invite = await mint(t, gameId, organizer.userId, {
      target: SAM,
      requiresApproval: true,
      usesRemaining: 5,
    })

    expect(invite.usesRemaining).toBe(1)
    expect(invite.requiresApproval).toBe(false)
  })

  test('lasts a week by default', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    expect(invite.expiresAt).toBe((invite.createdAt ?? 0) + TARGETED_EXPIRY_MS)
  })

  test('is found again rather than duplicated while it is live', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    const found = await t.run((ctx) => liveDiscordInvite(ctx, gameId, 'snowflake-sam'))
    expect(found?._id).toBe(invite._id)

    await organizer.as.mutation(api.invites.revoke, { inviteId: invite._id })
    const afterRevoke = await t.run((ctx) => liveDiscordInvite(ctx, gameId, 'snowflake-sam'))
    expect(afterRevoke).toBeNull()
  })
})

describe('preview of an addressed invite', () => {
  test('says how it is addressed, never to whom', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    const preview = await t.query(api.invites.preview, { code: invite.code })
    expect(preview?.addressed).toBe('discord')
    // Signed out: it cannot know whether it is yours.
    expect(preview?.forYou).toBeNull()
    expect(JSON.stringify(preview)).not.toContain('snowflake-sam')
    expect(JSON.stringify(preview)).not.toContain('"sam"')
  })

  test('tells a signed-in viewer whether it is theirs', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')
    const stranger = await makeUser(t, 'Stranger', 'snowflake-stranger')
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    expect((await sam.as.query(api.invites.preview, { code: invite.code }))?.forYou).toBe(true)
    expect((await stranger.as.query(api.invites.preview, { code: invite.code }))?.forYou).toBe(
      false
    )
  })
})

describe('declining', () => {
  test('the addressee can decline, and the invite is then dead', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    await sam.as.mutation(api.invites.decline, { code: invite.code })

    const [row] = await organizer.as.query(api.invites.list, { gameId })
    expect(row?.status).toBe('declined')
    await expect(sam.as.mutation(api.invites.redeem, { code: invite.code })).rejects.toThrow(
      /declined/
    )
  })

  test('nobody can decline on the addressee’s behalf', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const stranger = await makeUser(t, 'Stranger', 'snowflake-stranger')
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    await expect(stranger.as.mutation(api.invites.decline, { code: invite.code })).rejects.toThrow(
      /different Discord account/
    )
    const [row] = await organizer.as.query(api.invites.list, { gameId })
    expect(row?.status).toBe('active')
  })

  test('a bearer code cannot be declined — it may be meant for the whole table', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const player = await makeUser(t, 'Player')
    const code = await organizer.as.mutation(api.invites.create, { gameId })

    await expect(player.as.mutation(api.invites.decline, { code })).rejects.toThrow(
      /Only an invite sent to you/
    )
  })

  test('declining twice, or after a revoke, is a no-op', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    await organizer.as.mutation(api.invites.revoke, { inviteId: invite._id })
    await sam.as.mutation(api.invites.decline, { code: invite.code })
    await sam.as.mutation(api.invites.decline, { code: invite.code })

    // Revoked outranks declined: the Organizer closed it first.
    const [row] = await organizer.as.query(api.invites.list, { gameId })
    expect(row?.status).toBe('revoked')
  })
})

describe('invites.forMe — the hub card', () => {
  test('lists live invites addressed to me, with what the link would show', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')
    const invite = await mint(t, gameId, organizer.userId, { target: SAM })

    const mine = await sam.as.query(api.invites.forMe, {})
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({
      code: invite.code,
      gameName: 'Tenacity',
      invitedBy: 'Vex',
      role: 'player',
    })
  })

  test('leaves out invites for others, dead invites, and Games I am already in', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')

    // For somebody else.
    await mint(t, gameId, organizer.userId, {
      target: { kind: 'discord', discordId: 'snowflake-other' },
    })
    // Declined.
    const declined = await mint(t, gameId, organizer.userId, { target: SAM })
    await sam.as.mutation(api.invites.decline, { code: declined.code })
    // Live, but for a Game Sam then joins by another door.
    const otherGame = await organizer.as.mutation(api.games.create, { name: 'Second' })
    await mint(t, otherGame, organizer.userId, { target: SAM })
    const bearer = await organizer.as.mutation(api.invites.create, { gameId: otherGame })
    await sam.as.mutation(api.invites.redeem, { code: bearer })

    expect(await sam.as.query(api.invites.forMe, {})).toEqual([])
  })

  test('is empty, not an error, when signed out or not signed in with Discord', async () => {
    const t = testConvex()
    const passwordOnly = await makeUser(t, 'Test account')

    expect(await t.query(api.invites.forMe, {})).toEqual([])
    expect(await passwordOnly.as.query(api.invites.forMe, {})).toEqual([])
  })
})

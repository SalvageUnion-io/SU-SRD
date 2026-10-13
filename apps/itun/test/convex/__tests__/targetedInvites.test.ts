import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import type { Ctx } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Addressed invites (ADR-039) that `/su invite` minted.
 *
 * Nothing mints one now, but such a row stays spendable until it expires, so
 * `invites.redeem` still holds it to its address: worth nothing to anybody but
 * the account signed in with that Discord snowflake, and the refusal names
 * nobody. The row is inserted as the bot minted it.
 */

async function seedAddressedInvite(t: Ctx) {
  const organizer = await makeUser(t, 'Vex', 'snowflake-vex')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = 'ADDRESSEDTOSAM00'
  await t.run(async (ctx) => {
    const now = Date.now()
    await ctx.db.insert('invites', {
      gameId,
      code,
      createdBy: organizer.userId,
      createdAt: now,
      expiresAt: now + 1000 * 60 * 60 * 24 * 7,
      usesRemaining: 1,
      role: 'player',
      requiresApproval: false,
      target: { kind: 'discord', discordId: 'snowflake-sam', name: 'sam' },
    })
  })
  return code
}

describe('an addressed invite', () => {
  test('seats its addressee', async () => {
    const t = testConvex()
    const code = await seedAddressedInvite(t)
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')

    expect((await sam.as.mutation(api.invites.redeem, { code })).kind).toBe('joined')
  })

  test('refuses anybody else, and the refusal names nobody', async () => {
    const t = testConvex()
    const code = await seedAddressedInvite(t)
    const stranger = await makeUser(t, 'Stranger', 'snowflake-stranger')

    const attempt = stranger.as.mutation(api.invites.redeem, { code })
    await expect(attempt).rejects.toThrow(/different Discord account/)
    await expect(attempt).rejects.not.toThrow(/sam/i)
    // And nothing was spent: the addressee can still use it.
    const sam = await makeUser(t, 'Sam', 'snowflake-sam')
    expect((await sam.as.mutation(api.invites.redeem, { code })).kind).toBe('joined')
  })

  test('refuses an account with no Discord sign-in at all', async () => {
    const t = testConvex()
    const code = await seedAddressedInvite(t)
    const passwordOnly = await makeUser(t, 'Test account')

    await expect(passwordOnly.as.mutation(api.invites.redeem, { code })).rejects.toThrow(
      /different Discord account/
    )
  })
})

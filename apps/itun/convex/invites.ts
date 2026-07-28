import { v } from 'convex/values'

import { generateUniqueId } from '../src/lib/snapshot/id'
import type { Id } from './_generated/dataModel'
import { mutation } from './_generated/server'
import { NotAuthorized, getMembership, requireOrganizer, requireUser } from './model/permissions'

/**
 * Invite codes (ADR-030 §2) — how a player joins a Game.
 *
 * Codes reuse `generateUniqueId` from the snapshot module rather than growing a
 * second generator: it is already Crockford base32 (no I/L/O/U, so a code read
 * aloud across a table cannot be mistyped), already collision-checked against a
 * caller-supplied `exists`, and already backed by `crypto.getRandomValues`.
 * Those are exactly the properties an invite code wants.
 */

const DEFAULT_EXPIRY_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

/** Mint an invite for a Game. Administrative, so Organizer only. */
export const create = mutation({
  args: {
    gameId: v.id('games'),
    usesRemaining: v.optional(v.number()),
    expiresInMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const membership = await requireOrganizer(ctx, args.gameId)

    const code = await generateUniqueId(async (candidate) => {
      const existing = await ctx.db
        .query('invites')
        .withIndex('by_code', (q) => q.eq('code', candidate))
        .unique()
      return existing !== null
    })

    await ctx.db.insert('invites', {
      gameId: args.gameId,
      code,
      createdBy: membership.userId,
      expiresAt: Date.now() + (args.expiresInMs ?? DEFAULT_EXPIRY_MS),
      usesRemaining: args.usesRemaining,
    })
    return code
  },
})

/**
 * Redeem a code and join the Game as a Player.
 *
 * Joining is deliberately the *only* self-serve membership act. Everything
 * downstream of it — what you own, whether you mediate — is assigned by someone
 * already in the Game (ADR-030 §3), so a valid code buys a seat at the table
 * and nothing else.
 *
 * Redeeming twice is a no-op rather than an error: a player who taps a link
 * again should land in the Game, not read a failure. The use is not decremented
 * in that case, because they did not consume a new seat.
 */
export const redeem = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<Id<'games'>> => {
    const userId = await requireUser(ctx)
    const code = args.code.trim().toUpperCase()

    const invite = await ctx.db
      .query('invites')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()
    if (invite === null) throw new NotAuthorized('That invite code is not valid')

    if (invite.expiresAt !== undefined && invite.expiresAt < Date.now()) {
      throw new NotAuthorized('That invite code has expired')
    }
    if (invite.usesRemaining !== undefined && invite.usesRemaining <= 0) {
      throw new NotAuthorized('That invite code has already been used up')
    }

    const existing = await getMembership(ctx, invite.gameId, userId)
    if (existing !== null) return invite.gameId

    await ctx.db.insert('memberships', {
      gameId: invite.gameId,
      userId,
      mediator: false,
      organizer: false,
      joinedAt: Date.now(),
    })
    if (invite.usesRemaining !== undefined) {
      await ctx.db.patch(invite._id, { usesRemaining: invite.usesRemaining - 1 })
    }
    return invite.gameId
  },
})

/** Revoke an invite early. */
export const revoke = mutation({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args): Promise<void> => {
    const invite = await ctx.db.get(args.inviteId)
    if (invite === null) return
    await requireOrganizer(ctx, invite.gameId)
    await ctx.db.delete(args.inviteId)
  },
})

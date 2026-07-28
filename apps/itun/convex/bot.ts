import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { NotAuthorized, requireOrganizer, requireUser } from './model/permissions'

/**
 * The Discord bot as a Game participant (ADR-030, Phase 6).
 *
 * This closes the intent of the old issue #165 — "connect the bot to live
 * campaign state" — **without** the mechanism that issue assumed. It called for
 * a service-role key and RLS policies, which is a bot that can act as anybody.
 * Here the bot acts as a *participant*:
 *
 *  - A **channel binding** says "rolls in this channel belong to this Game".
 *  - The actor is resolved from the Discord user id against `users.discordId`,
 *    so the bot can only ever act as somebody who has linked their own account
 *    and joined the Game. A stranger in the channel is not a member and gets
 *    nothing.
 *
 * That is why Discord was chosen as the sole identity provider: the id the bot
 * already has in hand *is* the account key, so no separate credential, no
 * impersonation surface, and no privileged token to leak.
 */

/** Bind this channel to a Game. Administrative, so Organizer only. */
export const bindChannel = mutation({
  args: { gameId: v.id('games'), channelId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireOrganizer(ctx, args.gameId)
    const channelId = args.channelId.trim()
    if (channelId.length === 0) throw new Error('A binding needs a channel')

    const existing = await ctx.db
      .query('channelBindings')
      .withIndex('by_channel', (q) => q.eq('channelId', channelId))
      .unique()

    // One Game per channel: a channel meaning two Games would make every roll
    // in it ambiguous, and the bot has no way to ask which was meant.
    if (existing !== null) {
      if (existing.gameId === args.gameId) return
      throw new NotAuthorized('That channel is already bound to another game')
    }

    await ctx.db.insert('channelBindings', {
      gameId: args.gameId,
      channelId,
      boundBy: membership.userId,
      boundAt: Date.now(),
    })
  },
})

export const unbindChannel = mutation({
  args: { channelId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db
      .query('channelBindings')
      .withIndex('by_channel', (q) => q.eq('channelId', args.channelId.trim()))
      .unique()
    if (existing === null) return

    await requireOrganizer(ctx, existing.gameId)
    await ctx.db.delete(existing._id)
  },
})

/** Which Game, if any, a channel speaks for. */
export const gameForChannel = query({
  args: { channelId: v.string() },
  handler: async (ctx, args): Promise<{ gameId: Id<'games'>; name: string } | null> => {
    await requireUser(ctx)
    const binding = await ctx.db
      .query('channelBindings')
      .withIndex('by_channel', (q) => q.eq('channelId', args.channelId.trim()))
      .unique()
    if (binding === null) return null

    const game = await ctx.db.get(binding.gameId)
    if (game === null) return null
    return { gameId: game._id, name: game.name }
  },
})

/**
 * Resolve a Discord user to a member of the bound Game.
 *
 * Returns null rather than throwing for every failure mode — no binding, no
 * linked account, not a member — because the bot's correct response to all
 * three is the same: say nothing happened. Distinguishing them in a public
 * channel would leak who has an account and who is in which Game.
 */
async function resolveActor(
  ctx: MutationCtx,
  channelId: string,
  discordId: string
): Promise<{ gameId: Id<'games'>; userId: Id<'users'> } | null> {
  const binding = await ctx.db
    .query('channelBindings')
    .withIndex('by_channel', (q) => q.eq('channelId', channelId.trim()))
    .unique()
  if (binding === null) return null

  const user = await ctx.db
    .query('users')
    .withIndex('by_discord', (q) => q.eq('discordId', discordId))
    .unique()
  if (user === null) return null

  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_game_user', (q) => q.eq('gameId', binding.gameId).eq('userId', user._id))
    .unique()
  if (membership === null) return null

  return { gameId: binding.gameId, userId: user._id }
}

/**
 * Record a roll made in Discord against the bound Game.
 *
 * It lands as a Change Log entry, so a roll made at the table and a roll made
 * in the channel are the same kind of fact and appear in the same history.
 * There was no separate "bot events" store to invent, for the same reason
 * alerts needed no separate bus.
 *
 * Returns false when the actor could not be resolved. The bot treats that as
 * "not for us" rather than an error — see `resolveActor`.
 */
export const recordRoll = mutation({
  args: {
    channelId: v.string(),
    discordId: v.string(),
    description: v.string(),
    result: v.any(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const actor = await resolveActor(ctx, args.channelId, args.discordId)
    if (actor === null) return false

    await ctx.db.insert('changeLog', {
      gameId: actor.gameId,
      entityType: 'game',
      entityId: actor.gameId,
      ts: Date.now(),
      kind: 'transaction',
      field: 'roll',
      before: null,
      after: { description: args.description, result: args.result },
      source: 'discord-bot',
      actorId: actor.userId,
      state: 'applied',
    })
    return true
  },
})

/** Rolls recorded from Discord, newest first. Any member may read them. */
export const rolls = query({
  args: { gameId: v.id('games'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_game_user', (q) => q.eq('gameId', args.gameId).eq('userId', userId))
      .unique()
    if (membership === null) throw new NotAuthorized('Not a member of this game')

    const rows = await ctx.db
      .query('changeLog')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    return rows
      .filter((r) => r.field === 'roll')
      .sort((a, b) => b.ts - a.ts)
      .slice(0, args.limit ?? 20)
      .map((r) => ({ _id: r._id, ts: r.ts, actorId: r.actorId, payload: r.after }))
  },
})

/** Link a Discord identity to the signed-in account, so the bot can find them. */
export const linkDiscordId = mutation({
  args: { discordId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const discordId = args.discordId.trim()
    if (discordId.length === 0) throw new Error('A Discord id is required')

    const taken = await ctx.db
      .query('users')
      .withIndex('by_discord', (q) => q.eq('discordId', discordId))
      .unique()
    // Otherwise two accounts could claim one Discord identity and the bot
    // would resolve rolls to whichever it happened to find first.
    if (taken !== null && taken._id !== userId) {
      throw new NotAuthorized('That Discord account is already linked to another user')
    }

    await ctx.db.patch(userId, { discordId })
  },
})

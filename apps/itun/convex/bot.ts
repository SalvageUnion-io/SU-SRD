import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { bindChannelAs, bindingForChannel, unbindChannelAs } from './model/bot'
import { NotAuthorized, requireUser } from './model/permissions'

/**
 * The Discord bot as a Game participant — **web-facing half** (ADR-030 Phase 6).
 *
 * This module is what a signed-in browser calls. The bot's own half lives in
 * `botClient.ts`, reached over HTTP with a bot credential, and both share
 * `model/bot.ts` so there is one implementation of every rule.
 *
 * This closes the intent of the old issue #165 — "connect the bot to live
 * campaign state" — **without** the mechanism that issue assumed. It called for
 * a service-role key and RLS policies, which is a bot that can act as anybody.
 * Here the bot acts as a *participant*:
 *
 *  - A **channel binding** says "rolls in this channel belong to this Game".
 *  - The actor is resolved from the Discord user id against `users.discordId`,
 *    so the bot can only ever act as somebody who has signed in with that same
 *    Discord account and joined the Game. A stranger in the channel is not a
 *    member and gets nothing.
 *
 * That is why Discord was chosen as the sole identity provider: the id the bot
 * already has in hand *is* the account key, so no separate credential, no
 * impersonation surface, and no privileged token to leak.
 *
 * ## Two functions that used to live here
 *
 * `recordRoll` was a **public mutation with no authorization at all** — it
 * trusted a `discordId` passed as an argument, and the deployment URL ships in
 * the SPA bundle. It is now `internal.botClient.recordRoll`, unreachable from
 * any client and callable only behind the bot's bearer credential.
 *
 * `linkDiscordId` asked a signed-in user to paste their own Discord snowflake.
 * Discord is the only auth provider, so `authAccounts.providerAccountId`
 * already holds it and the bot reads it straight from there
 * (`model/bot.ts#userByDiscordId`). There is no linking step, and nothing to
 * stamp or backfill — the copy that would have needed keeping in step simply
 * does not exist.
 */

/** Bind this channel to a Game. Administrative, so Organizer only. */
export const bindChannel = mutation({
  args: { gameId: v.id('games'), channelId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await bindChannelAs(ctx, await requireUser(ctx), args.gameId, args.channelId)
  },
})

export const unbindChannel = mutation({
  args: { channelId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await unbindChannelAs(ctx, await requireUser(ctx), args.channelId)
  },
})

/** Which Game, if any, a channel speaks for. */
export const gameForChannel = query({
  args: { channelId: v.string() },
  handler: async (ctx, args): Promise<{ gameId: Id<'games'>; name: string } | null> => {
    await requireUser(ctx)
    const binding = await bindingForChannel(ctx, args.channelId)
    if (binding === null) return null

    const game = await ctx.db.get(binding.gameId)
    if (game === null) return null
    return { gameId: game._id, name: game.name }
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

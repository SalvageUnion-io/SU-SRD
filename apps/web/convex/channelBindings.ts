import { getAuthUserId } from '@convex-dev/auth/server'
import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import type { PostRollRelayRequest, PostRollRelayResponse } from 'game-domain/botWire'
import { BOT_RELAY_POST_ROLL_PATH, isPostableRoll } from 'game-domain/botWire'
import type { PostRollResult } from 'game-domain/games/discord'
import { mayBindChannel } from 'game-domain/games/discord'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { action, internalQuery, query } from './_generated/server'
import { displayNameOf } from './account'
import { bindingForGame, personalBinding } from './model/channelBindings'
import { oldestByAppId } from './model/entities'
import { getMembership, NotAuthorized, requireMemberAs } from './model/permissions'

/**
 * Discord channels for Play: what is bound, and posting a roll to it.
 *
 * Binding happens in Discord (`/su bind`, `/su unbind`, through
 * `botClient.bindChannel` / `unbindChannel`); this module is the web half.
 *
 *   - `mine`: the landing page's list, every Game of mine with its channel,
 *     and my personal (solo) channel.
 *   - `current`: the channel one Play screen posts to.
 *   - `postRoll`: post one roll there as the bot's roll card.
 *
 * ## How a roll reaches Discord
 *
 * `postRoll` does not call Discord itself. It asks the bot Worker
 * (`CANTINA_BOT_URL` + `BOT_RELAY_POST_ROLL_PATH`, bearer `CANTINA_BOT_SECRET`)
 * to post it, because the Worker already holds both the bot token and the roll
 * card (`buildPostedRollMessage`): the message in the channel is exactly the
 * card `/su roll` posts, with its `Roll again` and `See table` buttons, and the
 * token lives in one place. Either variable unset is a loud `failed`, never a
 * silent skip.
 */

/** A binding as the web reads it: the channel's name is null where it was never kept. */
const bindingView = v.object({
  channelId: v.string(),
  channelName: v.union(v.string(), v.null()),
  boundAt: v.number(),
})

export type BindingView = Infer<typeof bindingView>

function viewOf(row: Doc<'channelBindings'>): BindingView {
  return { channelId: row.channelId, channelName: row.channelName ?? null, boundAt: row.boundAt }
}

/**
 * The landing page's channels: my personal (solo) binding, and each of my
 * Games with its binding (null while unbound) and whether I may bind it
 * (`mayBindChannel`: the Mediator or the Organiser). Empty when signed out.
 */
export const mine = query({
  args: {},
  returns: v.object({
    personal: v.union(bindingView, v.null()),
    games: v.array(
      v.object({
        gameId: v.id('games'),
        gameName: v.string(),
        mayBind: v.boolean(),
        binding: v.union(bindingView, v.null()),
      })
    ),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return { personal: null, games: [] }

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const games = []
    for (const membership of memberships) {
      const game = await ctx.db.get(membership.gameId)
      if (game === null) continue
      const binding = await bindingForGame(ctx, game._id)
      games.push({
        gameId: game._id,
        gameName: game.name,
        mayBind: mayBindChannel(membership),
        binding: binding === null ? null : viewOf(binding),
      })
    }
    const personal = await personalBinding(ctx, userId)
    return { personal: personal === null ? null : viewOf(personal), games }
  },
})

/**
 * The channel a Play screen posts to: the Game's (`gameId`), or my personal
 * one in solo play (no `gameId`). Null when nothing is bound, when signed out,
 * and for a Game I am not in (as `games.get` answers a stale bookmark).
 */
export const current = query({
  args: { gameId: v.optional(v.id('games')) },
  returns: v.union(bindingView, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    if (args.gameId === undefined) {
      const personal = await personalBinding(ctx, userId)
      return personal === null ? null : viewOf(personal)
    }
    if ((await getMembership(ctx, args.gameId, userId)) === null) return null
    const binding = await bindingForGame(ctx, args.gameId)
    return binding === null ? null : viewOf(binding)
  },
})

/** A pilot's name as the card prints it: callsign first, as the crew calls them. */
function pilotName(row: Doc<'pilots'>): string | null {
  const body = row.body as { callsign?: unknown; name?: unknown }
  for (const value of [body.callsign, body.name]) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

/**
 * Who the card says rolled: the pilot (`pilotId`, an app id) when the caller
 * may read it here (theirs, or in this Game), otherwise the account's name.
 */
async function rollerName(
  ctx: QueryCtx,
  userId: Id<'users'>,
  gameId: Id<'games'> | null,
  pilotId: string | undefined
): Promise<string> {
  if (pilotId !== undefined) {
    const pilot = (await oldestByAppId(ctx, 'pilots', pilotId)) as Doc<'pilots'> | null
    const readable =
      pilot !== null && (pilot.ownerId === userId || (gameId !== null && pilot.gameId === gameId))
    const name = readable ? pilotName(pilot) : null
    if (name !== null) return name
  }
  return displayNameOf(await ctx.db.get(userId), 'Crewmate')
}

/**
 * Where `postRoll` posts, resolved for the caller, or null when nothing is
 * bound. A Game's channel needs membership (a refusal, not null: the caller
 * asked to post into a Game they are not in); solo is the caller's own.
 */
export const postTarget = internalQuery({
  args: {
    userId: v.id('users'),
    gameId: v.optional(v.id('games')),
    pilotId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ channelId: string; roller: string; ownerDiscordId: string | null } | null> => {
    const gameId = args.gameId ?? null
    if (gameId !== null) await requireMemberAs(ctx, gameId, args.userId)
    const binding =
      gameId === null ? await personalBinding(ctx, args.userId) : await bindingForGame(ctx, gameId)
    if (binding === null) return null

    const discord = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', args.userId).eq('provider', 'discord'))
      .first()
    return {
      channelId: binding.channelId,
      roller: await rollerName(ctx, args.userId, gameId, args.pilotId),
      ownerDiscordId: discord?.providerAccountId ?? null,
    }
  },
})

/** How long a post may take before it is reported as failed. */
const RELAY_TIMEOUT_MS = 10_000

/**
 * Ask the bot Worker to post one roll card. Every way it can go wrong comes
 * back as `{ ok: false, message }`, worded for the roller: an unset variable,
 * an unreachable Worker, a refusal from Discord.
 */
export async function relayPostRoll(request: PostRollRelayRequest): Promise<PostRollRelayResponse> {
  const botUrl = process.env.CANTINA_BOT_URL?.replace(/\/+$/, '')
  const secret = process.env.CANTINA_BOT_SECRET
  if (!botUrl || !secret) {
    // Loud on purpose: a deployment with channels bound and no relay is a
    // configuration fault, and the Convex log is where an operator looks.
    console.error('[channelBindings] CANTINA_BOT_URL and CANTINA_BOT_SECRET must both be set')
    return {
      ok: false,
      status: null,
      message: 'Posting to Discord is not configured on this deployment.',
    }
  }
  try {
    const response = await fetch(`${botUrl}${BOT_RELAY_POST_ROLL_PATH}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    })
    const body = (await response.json().catch(() => null)) as PostRollRelayResponse | null
    if (body !== null && typeof body === 'object' && 'ok' in body) {
      if (body.ok && typeof body.messageId === 'string') return body
      if (!body.ok && typeof body.message === 'string') return body
    }
    return {
      ok: false,
      status: response.status,
      message:
        response.status === 401 || response.status === 404
          ? 'The Discord bot refused this deployment’s credentials.'
          : 'The Discord bot returned an unexpected answer.',
    }
  } catch {
    return { ok: false, status: null, message: 'The Discord bot could not be reached.' }
  }
}

/**
 * Post one roll to the channel bound to this Game (`gameId`), or to the
 * caller's personal channel in solo play (no `gameId`), as the bot's roll card.
 *
 * `post` is the screen's Post toggle, overridden per roll; `postsByDefault`
 * (`game-domain/games/discord`) is its default, private for the Mediator.
 * `post: false` posts nothing and says so. `pilotId` (an app id) names the
 * roller on the card. Never silent: the result says what happened, for the
 * Feed to show, and a failure is logged.
 */
export const postRoll = action({
  args: {
    gameId: v.optional(v.id('games')),
    pilotId: v.optional(v.string()),
    roll: v.object({ tableName: v.string(), rolls: v.array(v.number()) }),
    post: v.boolean(),
  },
  handler: async (ctx, args): Promise<PostRollResult> => {
    if (!args.post) return { kind: 'skipped' }
    const userId = await getAuthUserId(ctx)
    if (userId === null) throw new NotAuthorized('Not signed in')

    const target = await ctx.runQuery(internal.channelBindings.postTarget, {
      userId,
      ...(args.gameId === undefined ? {} : { gameId: args.gameId }),
      ...(args.pilotId === undefined ? {} : { pilotId: args.pilotId }),
    })
    if (target === null) return { kind: 'unbound' }

    const { tableName, rolls } = args.roll
    const relayed: PostRollRelayResponse = !isPostableRoll(tableName, rolls)
      ? { ok: false, status: null, message: 'That roll cannot be posted.' }
      : await relayPostRoll({
          channelId: target.channelId,
          tableName,
          rolls,
          roller: target.roller,
          ...(target.ownerDiscordId === null ? {} : { ownerDiscordId: target.ownerDiscordId }),
        })

    if (!relayed.ok) {
      // In the Convex log too, so a channel that keeps failing is visible to an
      // operator and not only to whoever rolled.
      console.warn(
        `[channelBindings] postRoll to ${target.channelId} failed (${relayed.status ?? 'no status'}): ${relayed.message}`
      )
    }
    return relayed.ok
      ? { kind: 'posted', channelId: target.channelId, messageId: relayed.messageId }
      : { kind: 'failed', channelId: target.channelId, message: relayed.message }
  },
})

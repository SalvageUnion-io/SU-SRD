import { ConvexError, v } from 'convex/values'
import type { PostStopRelayRequest } from 'game-domain/botWire'
import { BOT_RELAY_POST_STOP_PATH } from 'game-domain/botWire'
import { BOUNDARIES_MAX, boundaryRefusal, normalizeBoundary } from 'game-domain/games/safety'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalAction, internalQuery, query } from './_generated/server'
import { relayToBot } from './model/botRelay'
import { bindingForGame } from './model/channelBindings'
import { mutation } from './model/entities'
import {
  isTableRunner,
  membershipOrNull,
  NotAuthorized,
  requireMember,
  requireTableRunner,
} from './model/permissions'
import { boundaryKind } from './model/safetyTables'

/**
 * A Game's Safety Protocols (Core Book pp.12-13).
 *
 *   - **Boundaries:** two lists, Out of Bounds and Off Camera, that every
 *     member reads and adds to on the Game's page. Nobody is named beside a
 *     boundary; whoever added one, or the table runner, may take it off.
 *   - **The Stop Sign:** any member may show it, from Play's bar or the
 *     Game's page, at any time and with no reason asked. Every open screen of
 *     the Game shows the game is paused, without saying who. Whoever showed
 *     it, or the table runner, lifts it.
 *   - **Discord:** only when the table runner has opted in, showing the Stop
 *     Sign posts the bot's fixed words to the Game's bound channel
 *     (`postStop`), at most once a minute.
 */

/** The least time between two Stop Sign posts to one Game's channel. */
const POST_EVERY_MS = 60_000

async function safetyRow(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>
): Promise<Doc<'safety'> | null> {
  return await ctx.db
    .query('safety')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .unique()
}

/** Patch the Game's `safety` row, writing it first when there is none. */
async function writeSafety(
  ctx: MutationCtx,
  gameId: Id<'games'>,
  patch: Partial<Omit<Doc<'safety'>, '_id' | '_creationTime' | 'gameId'>>
): Promise<void> {
  const row = await safetyRow(ctx, gameId)
  if (row === null) await ctx.db.insert('safety', { gameId, stop: null, ...patch })
  else await ctx.db.patch(row._id, patch)
}

/** A Game's boundaries, oldest first, each saying whether the caller may take it off. */
export const boundaries = query({
  args: { gameId: v.id('games') },
  returns: v.array(
    v.object({
      _id: v.id('boundaries'),
      kind: boundaryKind,
      text: v.string(),
      mayRemove: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const membership = await membershipOrNull(ctx, args.gameId)
    if (membership === null) return []
    const runner = await isTableRunner(ctx, args.gameId, membership)
    const rows = await ctx.db
      .query('boundaries')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    return rows.map((row) => ({
      _id: row._id,
      kind: row.kind,
      text: row.text,
      mayRemove: runner || row.addedBy === membership.userId,
    }))
  },
})

/** Add one boundary to one of the Game's lists. Any member may. */
export const addBoundary = mutation({
  args: { gameId: v.id('games'), kind: boundaryKind, text: v.string() },
  handler: async (ctx, args): Promise<Id<'boundaries'>> => {
    const membership = await requireMember(ctx, args.gameId)
    const refused = boundaryRefusal(args.text)
    if (refused !== null) throw new ConvexError(refused)
    const kept = await ctx.db
      .query('boundaries')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .take(BOUNDARIES_MAX)
    if (kept.length >= BOUNDARIES_MAX) {
      throw new ConvexError(`A Game keeps at most ${BOUNDARIES_MAX} boundaries.`)
    }
    return await ctx.db.insert('boundaries', {
      gameId: args.gameId,
      kind: args.kind,
      text: normalizeBoundary(args.text),
      addedBy: membership.userId,
      addedAt: Date.now(),
    })
  },
})

/** Take a boundary off: whoever added it, or the table runner. */
export const removeBoundary = mutation({
  args: { boundaryId: v.id('boundaries') },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.db.get(args.boundaryId)
    if (row === null) return
    const membership = await requireMember(ctx, row.gameId)
    const mine = row.addedBy === membership.userId
    if (!mine && !(await isTableRunner(ctx, row.gameId, membership))) {
      throw new NotAuthorized('Only whoever added a boundary, or the Mediator, can take it off')
    }
    await ctx.db.delete(row._id)
  },
})

/**
 * The Game's Stop Sign as every open screen reads it: whether the game is
 * paused, whether the caller may lift it, and the Discord opt-in. Never who
 * showed it. Null for a non-member, as `games.get` is.
 */
export const stopSign = query({
  args: { gameId: v.id('games') },
  returns: v.union(
    v.object({
      stop: v.union(v.object({ shownAt: v.number(), mine: v.boolean() }), v.null()),
      mayLift: v.boolean(),
      /** The table runner may change the Discord opt-in. */
      mayManage: v.boolean(),
      postToChannel: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const membership = await membershipOrNull(ctx, args.gameId)
    if (membership === null) return null
    const runner = await isTableRunner(ctx, args.gameId, membership)
    const row = await safetyRow(ctx, args.gameId)
    const stop = row?.stop ?? null
    const mine = stop !== null && stop.shownBy === membership.userId
    return {
      stop: stop === null ? null : { shownAt: stop.shownAt, mine },
      mayLift: stop !== null && (mine || runner),
      mayManage: runner,
      postToChannel: row?.postToChannel === true,
    }
  },
})

/**
 * Show the Stop Sign: the game is paused for everyone. Any member may, with
 * no reason asked; showing it while it is up changes nothing.
 */
export const showStop = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireMember(ctx, args.gameId)
    const row = await safetyRow(ctx, args.gameId)
    if (row?.stop) return
    const now = Date.now()
    const post =
      row?.postToChannel === true &&
      (row.postedAt === undefined || now - row.postedAt >= POST_EVERY_MS)
    await writeSafety(ctx, args.gameId, {
      stop: { shownBy: membership.userId, shownAt: now },
      ...(post ? { postedAt: now } : {}),
    })
    if (post) await ctx.scheduler.runAfter(0, internal.safety.postStop, { gameId: args.gameId })
  },
})

/** Lift the Stop Sign and resume play: whoever showed it, or the table runner. */
export const liftStop = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireMember(ctx, args.gameId)
    const row = await safetyRow(ctx, args.gameId)
    if (!row?.stop) return
    const mine = row.stop.shownBy === membership.userId
    if (!mine && !(await isTableRunner(ctx, args.gameId, membership))) {
      throw new NotAuthorized('Only whoever showed the Stop Sign, or the Mediator, can lift it')
    }
    await ctx.db.patch(row._id, { stop: null })
  },
})

/** The table runner's opt-in: whether showing the Stop Sign posts to the bound channel. */
export const setPostToChannel = mutation({
  args: { gameId: v.id('games'), on: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    await requireTableRunner(ctx, args.gameId)
    await writeSafety(ctx, args.gameId, { postToChannel: args.on })
  },
})

/** Where `postStop` posts: the bound channel, while the table is still opted in. */
export const stopChannel = internalQuery({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<string | null> => {
    const row = await safetyRow(ctx, args.gameId)
    if (row?.postToChannel !== true || !row.stop) return null
    return (await bindingForGame(ctx, args.gameId))?.channelId ?? null
  },
})

/**
 * Post the Stop Sign to the Game's bound channel, through the bot Worker
 * (`BOT_RELAY_POST_STOP_PATH`). Nothing bound posts nothing; a failure is
 * logged, since Play has already paused and that is what the table relies on.
 */
export const postStop = internalAction({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    const channelId = await ctx.runQuery(internal.safety.stopChannel, { gameId: args.gameId })
    if (channelId === null) return
    const request: PostStopRelayRequest = { channelId }
    const relayed = await relayToBot(BOT_RELAY_POST_STOP_PATH, request)
    if (!relayed.ok) {
      console.warn(
        `[safety] postStop to ${channelId} failed (${relayed.status ?? 'no status'}): ${relayed.message}`
      )
    }
  },
})

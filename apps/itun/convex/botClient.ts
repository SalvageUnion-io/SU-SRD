import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { internalMutation, internalQuery } from './_generated/server'
import { PRESENCE_WINDOW_MS } from './mediator'
import type { BotDenial } from './model/bot'
import {
  bindChannelAs,
  displayNameOf,
  gamesForUser,
  resolveActor,
  unbindChannelAs,
  userByDiscordId,
} from './model/bot'
import { NotAuthorized } from './model/permissions'

/**
 * The Discord bot as a Game participant — **bot-facing half** (ADR-030 Phase 6).
 *
 * Every function here is `internal`, which is the security boundary that
 * matters: an internal function is **not reachable from any client**, only from
 * a Convex action or HTTP action running inside the deployment. The single door
 * to this module is `botHttp.ts`, which checks the bot's bearer credential
 * before it forwards anything.
 *
 * The credential authenticates the *bot*. It does not authenticate the *actor*
 * — that comes from `discordId`, resolved through `model/bot.ts` against a
 * linked account and a real membership, using the same `model/permissions.ts`
 * checks the web surface runs. Holding the credential therefore lets you ask
 * "what may this Discord user see?", never "show me everything".
 *
 * ## Why these return bodies rather than a projection
 *
 * `crew.vitals` deliberately serves the web a four-number projection, because
 * the crew strip re-renders on every point of damage and pushing whole sheets
 * down that path would be absurd. The bot is not that path: `/su crew` is one
 * request, typed by a person, a few times a session.
 *
 * More importantly, the numbers the bot wants **cannot be computed here**. Max
 * HP, max SP and max Heat are derived from class and chassis data that lives in
 * `salvageunion-reference`, which Convex does not have and should not grow. The
 * bot already depends on that package and preloads it at startup, so it derives
 * the maxima itself (ADR-006 — rules math lives in the package). Convex returns
 * what it stores; the bot renders what the rules say.
 */

/** A failure the bot can render. Widened from `BotDenial` with mutation cases. */
type Denial = BotDenial | 'forbidden' | 'not-found'

type Failure = { ok: false; reason: Denial; message: string }
type Success<T> = { ok: true } & T
/** A success carrying nothing but the fact that it worked. */
type Ack = { ok: true }

const DENIAL_MESSAGE: Record<Denial, string> = {
  unlinked: 'No In The Union Now account is signed in with this Discord account.',
  unbound: 'This channel is not bound to a game.',
  'not-a-member': 'You are not a member of the game bound to this channel.',
  forbidden: 'You do not have permission to do that.',
  'not-found': 'That could not be found.',
}

function fail(reason: Denial, message?: string): Failure {
  return { ok: false, reason, message: message ?? DENIAL_MESSAGE[reason] }
}

/**
 * Map a thrown authorization error onto a rendered failure.
 *
 * `NotAuthorized` is the one throw the bot expects and can explain; anything
 * else is a real fault and is re-thrown so it reaches Sentry rather than being
 * flattened into a shrug in a Discord channel.
 */
function asFailure(error: unknown): Failure {
  if (error instanceof NotAuthorized) return fail('forbidden', error.message)
  throw error
}

/** Owner display names for a Game, resolved once per request. */
async function ownerNames(
  ctx: QueryCtx,
  gameId: Id<'games'>
): Promise<Map<string, { name: string; present: boolean }>> {
  const now = Date.now()
  const [members, presence] = await Promise.all([
    ctx.db
      .query('memberships')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect(),
    ctx.db
      .query('presence')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect(),
  ])

  const lastSeen = new Map(presence.map((p) => [p.userId as string, p.lastSeen]))
  const out = new Map<string, { name: string; present: boolean }>()
  for (const member of members) {
    const user = await ctx.db.get(member.userId)
    const seen = lastSeen.get(member.userId)
    out.set(member.userId, {
      name: displayNameOf(user),
      present: seen !== undefined && now - seen < PRESENCE_WINDOW_MS,
    })
  }
  return out
}

/**
 * Who the bot is talking to, and what they are part of.
 *
 * The one command that answers usefully for somebody with *no* account: an
 * `unlinked` result is the whole onboarding surface, because there is nothing
 * to link — signing in with the same Discord account is the entire flow.
 */
export const me = internalQuery({
  args: { discordId: v.string() },
  handler: async (ctx, args): Promise<Failure | Success<{ user: unknown; games: unknown }>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')

    return {
      ok: true,
      user: {
        userId: user._id,
        displayName: displayNameOf(user),
        avatarUrl: user.avatarUrl ?? user.image ?? null,
      },
      games: await gamesForUser(ctx, user._id),
    }
  },
})

/** Every Game the caller belongs to. Also the source for `bind` autocomplete. */
export const games = internalQuery({
  args: { discordId: v.string() },
  handler: async (ctx, args): Promise<Failure | Success<{ games: unknown }>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')
    return { ok: true, games: await gamesForUser(ctx, user._id) }
  },
})

/**
 * The caller's own shelf — what they own that is in no Game.
 *
 * Needs no channel and no binding: a shelf is personal, so this is the one
 * Game-aware command that works in a DM or an unbound channel.
 */
export const shelf = internalQuery({
  args: { discordId: v.string() },
  handler: async (ctx, args): Promise<Failure | Success<{ pilots: unknown; mechs: unknown }>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')

    const [pilots, mechs] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
        .collect(),
    ])

    return {
      ok: true,
      // See `crew` on why `appId` rides along: it is what the web sheet route
      // actually resolves by.
      pilots: pilots
        .filter((p) => p.gameId === null)
        .map((p) => ({ id: p._id, appId: p.appId ?? null, body: p.body })),
      mechs: mechs
        .filter((m) => m.gameId === null)
        .map((m) => ({ id: m._id, appId: m.appId ?? null, body: m.body })),
    }
  },
})

/** The bound Game's roster, presence and Downtime phase. */
export const channel = internalQuery({
  args: { discordId: v.string(), channelId: v.string() },
  handler: async (ctx, args): Promise<Failure | Success<Record<string, unknown>>> => {
    const actor = await resolveActor(ctx, args.channelId, args.discordId)
    if (!actor.ok) return fail(actor.reason)

    const { gameId, game } = actor.value
    const names = await ownerNames(ctx, gameId)
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect()
    const downtime = await ctx.db
      .query('downtime')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .unique()

    return {
      ok: true,
      game: { gameId, name: game.name },
      members: memberships.map((m) => ({
        userId: m.userId,
        displayName: names.get(m.userId)?.name ?? 'Crewmate',
        present: names.get(m.userId)?.present ?? false,
        mediator: m.mediator,
        organizer: m.organizer,
      })),
      downtime: {
        running: downtime !== null && downtime.stepIndex !== null,
        stepIndex: downtime?.stepIndex ?? null,
        completed: downtime?.completedBy.length ?? 0,
        upkeepSpent: downtime?.upkeepSpent ?? false,
      },
    }
  },
})

/**
 * Everything the crew board renders, grouped by owner.
 *
 * Grouped here rather than in the bot because ownership is a server fact and
 * an **unclaimed** entity (`ownerId: null`) is a first-class state ADR-030
 * requires every surface to render rather than blank. Emitting it as its own
 * bucket makes that impossible to forget downstream.
 */
export const crew = internalQuery({
  args: { discordId: v.string(), channelId: v.string() },
  handler: async (ctx, args): Promise<Failure | Success<Record<string, unknown>>> => {
    const actor = await resolveActor(ctx, args.channelId, args.discordId)
    if (!actor.ok) return fail(actor.reason)

    const { gameId, game } = actor.value
    const [pilots, mechs, crawlers] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect(),
      ctx.db
        .query('crawlers')
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect(),
    ])
    const names = await ownerNames(ctx, gameId)

    const entry = (row: Doc<'pilots'> | Doc<'mechs'>) => ({
      id: row._id,
      // The web sheet route resolves an entity by its APP-level id out of
      // IndexedDB, not by the Convex `_id` — so a link built from `_id` opens
      // nothing. Null for rows created server-side (a Game template) that
      // nobody has claimed into a browser yet, and the bot omits the link
      // rather than emitting a dead one.
      appId: row.appId ?? null,
      ownerId: row.ownerId,
      ownerName: row.ownerId === null ? null : (names.get(row.ownerId)?.name ?? null),
      present: row.ownerId === null ? false : (names.get(row.ownerId)?.present ?? false),
      body: row.body,
    })

    return {
      ok: true,
      game: { gameId, name: game.name },
      viewerId: actor.value.user._id,
      pilots: pilots.map(entry),
      mechs: mechs.map(entry),
      crawler: crawlers[0] ? { id: crawlers[0]._id, body: crawlers[0].body } : null,
    }
  },
})

/**
 * One crewmate's sheet, read-only.
 *
 * Membership is the whole check — inside a Game you may read any crewmate's
 * pilot or mech, which is what "lean over and look at their sheet" means at a
 * physical table. The entity must belong to *this channel's* Game, so a
 * member of one table cannot read another table's sheets by id.
 */
export const sheet = internalQuery({
  args: {
    discordId: v.string(),
    channelId: v.string(),
    table: v.union(v.literal('pilots'), v.literal('mechs')),
    entityId: v.string(),
  },
  handler: async (ctx, args): Promise<Failure | Success<Record<string, unknown>>> => {
    const actor = await resolveActor(ctx, args.channelId, args.discordId)
    if (!actor.ok) return fail(actor.reason)

    // `normalizeId` is what makes `table` load-bearing rather than decorative.
    // A Convex id is table-tagged, but `db.get` will happily return a document
    // from ANY table — so casting the string and checking only `gameId` let a
    // member pass an `encounterNpcs` id and read the Mediator's prepared
    // opposition, the one thing ADR-030 §5 says must stay hidden. It also
    // turns a malformed id from a throw into a clean not-found.
    const entityId = ctx.db.normalizeId(args.table, args.entityId)
    if (entityId === null) return fail('not-found')

    const doc = await ctx.db.get(entityId)
    if (doc === null) return fail('not-found')

    const row = doc as unknown as {
      gameId: Id<'games'> | null
      ownerId: Id<'users'> | null
      appId?: string
    }
    // Not `forbidden` — telling somebody an id exists but is another table's is
    // itself a disclosure. An id they may not read is an id that is not there.
    if (row.gameId !== actor.value.gameId) return fail('not-found')

    const names = await ownerNames(ctx, actor.value.gameId)
    return {
      ok: true,
      table: args.table,
      id: args.entityId,
      appId: row.appId ?? null,
      ownerName: row.ownerId === null ? null : (names.get(row.ownerId)?.name ?? null),
      body: (doc as unknown as { body: unknown }).body,
    }
  },
})

/** Bind this channel to a Game. Organizer only, enforced in `model/bot.ts`. */
export const bind = internalMutation({
  args: { discordId: v.string(), channelId: v.string(), gameId: v.id('games') },
  handler: async (ctx, args): Promise<Failure | Success<{ name: string }>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')

    try {
      await bindChannelAs(ctx, user._id, args.gameId, args.channelId)
    } catch (error) {
      return asFailure(error)
    }

    const game = await ctx.db.get(args.gameId)
    return { ok: true, name: game?.name ?? 'this game' }
  },
})

export const unbind = internalMutation({
  args: { discordId: v.string(), channelId: v.string() },
  handler: async (ctx, args): Promise<Failure | Ack> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')

    try {
      await unbindChannelAs(ctx, user._id, args.channelId)
    } catch (error) {
      return asFailure(error)
    }
    return { ok: true }
  },
})

/**
 * Record a roll made in Discord against the bound Game.
 *
 * It lands as a Change Log entry, so a roll made at the table and a roll made
 * in the channel are the same kind of fact and appear in the same history.
 * There was no separate "bot events" store to invent, for the same reason
 * alerts needed no separate bus.
 *
 * The failure path is the reason this returns a result instead of throwing:
 * the bot calls it *alongside* replying with the roll, and a roll by somebody
 * with no account must still roll. Not being recorded is not an error, and the
 * channel is never told — see `BotDenial`.
 */
export const recordRoll = internalMutation({
  args: {
    discordId: v.string(),
    channelId: v.string(),
    description: v.string(),
    result: v.any(),
  },
  handler: async (ctx, args): Promise<Failure | Success<{ game: string }>> => {
    const actor = await resolveActor(ctx, args.channelId, args.discordId)
    if (!actor.ok) return fail(actor.reason)

    await ctx.db.insert('changeLog', {
      gameId: actor.value.gameId,
      entityType: 'game',
      entityId: actor.value.gameId,
      ts: Date.now(),
      kind: 'transaction',
      field: 'roll',
      before: null,
      after: { description: args.description, result: args.result },
      source: 'discord-bot',
      actorId: actor.value.user._id,
      state: 'applied',
    })
    return { ok: true, game: actor.value.game.name }
  },
})

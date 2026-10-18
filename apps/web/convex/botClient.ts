import { v } from 'convex/values'
import type {
  BindChannelResult,
  BotDenialReason,
  BotFailure,
  BotSuccess,
  EntityBody,
  GamesResult,
  MeResult,
  MineResult,
  SheetResult,
  UnbindChannelResult,
} from 'game-domain/botWire'
import { PRODUCT } from 'game-domain/product'
import type { Id } from './_generated/dataModel'
import { internalQuery } from './_generated/server'
import { displayNameOf } from './account'
import type { SheetRow } from './crew'
import { sheetVitals } from './crew'
import { gamesForUser, userByDiscordId } from './model/bot'
import { bindChannelAs, resolveCallerGame, unbindChannelAs } from './model/channelBindings'
import { internalMutation, oldestByAppId, primaryCrawlerOf } from './model/entities'
import { getMembership } from './model/permissions'

/**
 * The Discord bot as a Game participant — **bot-facing half** (ADR-030).
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
 * `crew.vitals` deliberately serves the web a narrow projection — the numbers
 * and status the Crew tab draws, never the sheets they come from — because the
 * crew strip re-renders on every point of damage and pushing whole sheets down
 * that path would be absurd. The bot is not that path: `/su sheet` is one
 * request, typed by a person, a few times a session.
 *
 * A pilot's or mech's derived maxima and status ride beside the body
 * (`SheetResult.vitals`): the derivation `crew.vitals` serves Play's
 * Crew (`sheetVitals` in `crew.ts`), so the bot shows the server's numbers
 * rather than working out its own (ADR-038 §4).
 */

/*
 * Every success payload below is annotated with its `game-domain/botWire` type.
 * That module is also what the Discord bot imports (`import type`), so a change
 * to a return shape here is a compile error on both sides of the wire rather
 * than a silent drift between two hand-kept copies.
 */
const DENIAL_MESSAGE: Record<BotDenialReason, string> = {
  unlinked: `No ${PRODUCT.name} account is signed in with this Discord account.`,
  'not-found': 'That could not be found.',
  forbidden: 'You cannot do that here.',
}

function fail(reason: BotDenialReason, message?: string): BotFailure {
  return { ok: false, reason, message: message ?? DENIAL_MESSAGE[reason] }
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
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<MeResult>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')

    return {
      ok: true,
      user: {
        userId: user._id,
        displayName: displayNameOf(user, 'Crewmate'),
        avatarUrl: user.avatarUrl ?? user.image ?? null,
      },
      games: await gamesForUser(ctx, user._id),
    }
  },
})

/** Every Game the caller belongs to. */
export const games = internalQuery({
  args: { discordId: v.string() },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<GamesResult>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')
    return { ok: true, games: await gamesForUser(ctx, user._id) }
  },
})

/**
 * What `/su sheet` autocompletes to: everything the caller owns, in a Game or
 * on a shelf, and the communal crawler of each Game they belong to.
 *
 * Needs no channel: the command is personal, so it works in a DM or any
 * channel. Somebody else's sheet is reached by pasting its link instead.
 */
export const mine = internalQuery({
  args: { discordId: v.string() },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<MineResult>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')

    const [pilots, mechs, crawlers, games] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', user._id))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', user._id))
        .collect(),
      ctx.db
        .query('crawlers')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', user._id))
        .collect(),
      gamesForUser(ctx, user._id),
    ])
    // A Game's crawler has no owner (ADR-030 §5), so it is found by the Game.
    const communal = await Promise.all(games.map((game) => primaryCrawlerOf(ctx, game.gameId)))

    const entry = (row: { _id: string; body: EntityBody }) => ({ id: row._id, body: row.body })
    return {
      ok: true,
      pilots: pilots.map(entry),
      mechs: mechs.map(entry),
      // Keyed by id: a crawler you own can also be a Game's primary one.
      crawlers: [
        ...new Map(
          [...crawlers, ...communal.filter((row) => row !== null)].map((row) => [row._id, row])
        ).values(),
      ].map(entry),
    }
  },
})

/** One answer for absent and not-yours alike: either reply would otherwise disclose. */
const SHEET_NOT_FOUND = 'That sheet could not be found, or it is not yours to read.'

/**
 * One sheet, read-only: the caller's own, a crewmate's, or anybody's public one.
 *
 * `entityId` is a Convex row id (what the autocomplete and the live sheet link
 * carry) or an app id (what a public `/p/` link carries). The caller may read
 * it when it is **theirs**, when it sits in a **Game they belong to** — "lean
 * over and look at their sheet" — or when its owner has **published** it
 * (ADR-032), which needs no account at all. Anything else is `not-found`, the
 * same answer as no row: telling somebody an id exists but is not theirs to
 * read is itself a disclosure. A crawler in a Game is communal (ADR-030 §5):
 * its `ownerId` is null, so it reports no owner.
 */
export const sheet = internalQuery({
  args: {
    discordId: v.string(),
    table: v.union(v.literal('pilots'), v.literal('mechs'), v.literal('crawlers')),
    entityId: v.string(),
  },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<SheetResult>> => {
    // `normalizeId` is what makes `table` load-bearing rather than decorative.
    // A Convex id is table-tagged, but `db.get` will happily return a document
    // from ANY table — so casting the string would let a caller pass an
    // `encounterNpcs` id and read the Mediator's prepared opposition, the one
    // thing ADR-030 §5 says must stay hidden. An id that is not this table's
    // is tried as an app id, on this table's own index, and is otherwise
    // not-found rather than a throw.
    const rowId = ctx.db.normalizeId(args.table, args.entityId)
    const doc =
      rowId === null ? await oldestByAppId(ctx, args.table, args.entityId) : await ctx.db.get(rowId)
    if (doc === null) return fail('not-found', SHEET_NOT_FOUND)

    const row = doc as unknown as {
      _id: string
      gameId: Id<'games'> | null
      ownerId: Id<'users'> | null
      appId?: string
      publicRead?: boolean
      body: EntityBody
    }
    const publicRead = row.publicRead === true
    const user = await userByDiscordId(ctx, args.discordId)
    const mine = user !== null && row.ownerId === user._id
    const crewmate =
      user !== null &&
      row.gameId !== null &&
      (await getMembership(ctx, row.gameId, user._id)) !== null
    if (!publicRead && !mine && !crewmate) {
      // Somebody with no account can still read a published sheet, so for them
      // the useful answer is how to sign in rather than a bare not-found.
      return user === null ? fail('unlinked') : fail('not-found', SHEET_NOT_FOUND)
    }

    const ownerId = row.ownerId
    const owner = ownerId === null ? null : await ctx.db.get(ownerId)
    return {
      ok: true,
      table: args.table,
      id: row._id,
      appId: row.appId ?? null,
      // Whether this sheet has a PUBLIC url (ADR-032). The bot renders the
      // `/p/<kind>/<appId>` link only when this is true — a private sheet has
      // no public URL, and advertising one would 404 the reader.
      publicRead,
      ownerName: ownerId === null ? null : displayNameOf(owner, 'Crewmate'),
      body: row.body,
      // `normalizeId` / `oldestByAppId` read `doc` from `args.table`.
      vitals: await sheetVitals(ctx, { table: args.table, row: doc } as SheetRow),
    }
  },
})

/**
 * `/su bind`: bind the channel it ran in (`channelId`, kept with its name,
 * `channelName`) to one of the caller's Games (`game`, the autocomplete's
 * Game id or a typed name), or with no `game` to the caller's solo play. One of the bot's two writes, with `unbindChannel`: a
 * binding is the bot's own apparatus, never anybody's sheet, so ADR-030 §4
 * stands. Who may bind what is `model/channelBindings.ts`.
 */
export const bindChannel = internalMutation({
  args: {
    discordId: v.string(),
    channelId: v.string(),
    channelName: v.optional(v.string()),
    game: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<BindChannelResult>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')
    const channelId = args.channelId.trim()
    if (channelId.length === 0) return fail('not-found', 'That channel could not be found.')

    let gameId: Id<'games'> | null = null
    if (args.game !== undefined && args.game.trim().length > 0) {
      gameId = await resolveCallerGame(ctx, user._id, args.game)
      if (gameId === null) {
        return fail('not-found', 'That Game could not be found, or you are not in it.')
      }
    }
    return await bindChannelAs(ctx, user._id, {
      channelId,
      gameId,
      channelName: args.channelName ?? null,
    })
  },
})

/** `/su unbind`: release the channel it ran in, so rolls stop posting there. */
export const unbindChannel = internalMutation({
  args: { discordId: v.string(), channelId: v.string() },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<UnbindChannelResult>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')
    return await unbindChannelAs(ctx, user._id, args.channelId.trim())
  },
})

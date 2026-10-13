import { PRODUCT } from 'component-lib/product'
import { v } from 'convex/values'
import type {
  BindResult,
  BotDenialReason,
  BotFailure,
  BotSuccess,
  ChannelResult,
  EntityBody,
  GamesResult,
  InviteResult,
  MeResult,
  MineResult,
  RecordRollResult,
  SheetResult,
} from 'itun-domain/botWire'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { internalQuery } from './_generated/server'
import { displayNameOf } from './account'
import {
  bindChannelAs,
  bindingForChannel,
  gamesForUser,
  resolveActor,
  unbindChannelAs,
  userByDiscordId,
} from './model/bot'
import { parseInviteInteraction } from './model/discordInteraction'
import { internalMutation, oldestByAppId, primaryCrawlerOf } from './model/entities'
import { inviteByCode, liveDiscordInvite, mintInvite } from './model/invites'
import { getMembership, NotAuthorized, requireOrganizerAs } from './model/permissions'

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
 * The bot still derives max HP, max SP and max Heat itself: it depends on
 * `salvageunion-reference` and preloads it at startup (ADR-006 — rules math
 * lives in the package), so these return what Convex stores. Convex can derive
 * them too now — `crew.vitals` runs the same rules over the same records for
 * the Dashboard's Crew tab (`model/referenceData.ts` loads the data) — but the
 * bot does not read those values yet.
 */

/*
 * Every success payload below is annotated with its `itun-domain/botWire` type.
 * That module is also what the Discord bot imports (`import type`), so a change
 * to a return shape here is a compile error on both sides of the wire rather
 * than a silent drift between two hand-kept copies.
 */
/** A success carrying nothing but the fact that it worked. */
type Ack = { ok: true }

const DENIAL_MESSAGE: Record<BotDenialReason, string> = {
  unlinked: `No ${PRODUCT.name} account is signed in with this Discord account.`,
  unbound: 'This channel is not bound to a Game.',
  'not-a-member': 'You are not a member of the Game bound to this channel.',
  forbidden: 'You do not have permission to do that.',
  'not-found': 'That could not be found.',
}

function fail(reason: BotDenialReason, message?: string): BotFailure {
  return { ok: false, reason, message: message ?? DENIAL_MESSAGE[reason] }
}

/**
 * Map a thrown authorization error onto a rendered failure.
 *
 * `NotAuthorized` is the one throw the bot expects and can explain; anything
 * else is a real fault and is re-thrown so it reaches Sentry rather than being
 * flattened into a shrug in a Discord channel.
 */
function asFailure(error: unknown): BotFailure {
  if (error instanceof NotAuthorized) return fail('forbidden', error.message)
  throw error
}

/**
 * Owner display names for a Game, resolved once per request.
 *
 * Names only: ITUN tracks no presence, so there is no "who is at the table"
 * flag to report; see `mediator.ts`'s header.
 */
async function ownerNames(ctx: QueryCtx, gameId: Id<'games'>): Promise<Map<string, string>> {
  const members = await ctx.db
    .query('memberships')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .collect()

  const out = new Map<string, string>()
  for (const member of members) {
    const user = await ctx.db.get(member.userId)
    out.set(member.userId, displayNameOf(user, 'Crewmate'))
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

/** Every Game the caller belongs to. Also the source for `bind` autocomplete. */
export const games = internalQuery({
  args: { discordId: v.string() },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<GamesResult>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')
    return { ok: true, games: await gamesForUser(ctx, user._id) }
  },
})

/** The bound Game's roster and Downtime phase. */
export const channel = internalQuery({
  args: { discordId: v.string(), channelId: v.string() },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<ChannelResult>> => {
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
        displayName: names.get(m.userId) ?? 'Crewmate',
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
    }
  },
})

/** Bind this channel to a Game. Organizer only, enforced in `model/bot.ts`. */
export const bind = internalMutation({
  args: { discordId: v.string(), channelId: v.string(), gameId: v.id('games') },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<BindResult>> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')

    try {
      await bindChannelAs(ctx, user._id, args.gameId, args.channelId)
    } catch (error) {
      return asFailure(error)
    }

    const game = await ctx.db.get(args.gameId)
    return { ok: true, name: game?.name ?? 'this Game' }
  },
})

export const unbind = internalMutation({
  args: { discordId: v.string(), channelId: v.string() },
  handler: async (ctx, args): Promise<BotFailure | Ack> => {
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
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<RecordRollResult>> => {
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

/** How long after a delivered `/su invite` DM the same invite is not DMed again. */
const DM_COOLDOWN_MS = 1000 * 60 * 60 * 24

/** How long a DM marked as sending is assumed to be on its way. */
const DM_IN_FLIGHT_MS = 1000 * 60

/**
 * `/su invite @user` — mint an invite addressed to a Discord account (ADR-039).
 *
 * **The only bot operation that does not trust the bot.** Its sole caller is
 * `botHttp.ts`, which verifies Discord's Ed25519 signature over `body` and its
 * freshness before it gets here, and which never routes `invite` through the
 * generic args-forwarding path. Every fact that decides anything — who is
 * inviting, whom, into which Game, in which seat — is read out of those signed
 * bytes, so a leaked bot secret still cannot mint a membership.
 *
 * From there it is the web's rule set: the inviter must be the Game's
 * Organizer (`requireOrganizerAs`), and the invite is `mintInvite`'s, exactly
 * as `invites.create` would make it with a target.
 *
 * Idempotent twice over: a retried interaction finds the invite its id minted,
 * and inviting somebody who already has a live invite re-sends that one.
 */
export const invite = internalMutation({
  args: { body: v.string() },
  handler: async (ctx, args): Promise<BotFailure | BotSuccess<InviteResult>> => {
    const parsed = parseInviteInteraction(args.body)
    if (parsed === null) return fail('not-found', 'That was not an invite command.')

    const user = await userByDiscordId(ctx, parsed.inviterId)
    if (user === null) return fail('unlinked')

    if (parsed.invitee.bot) return fail('forbidden', 'A bot cannot join a Game.')
    if (parsed.invitee.id === parsed.inviterId) {
      return fail('forbidden', 'You are already at your own table.')
    }

    // Which Game: the one picked, else the one this channel is bound to.
    let gameId: Id<'games'> | null
    if (parsed.gameId !== null) {
      gameId = ctx.db.normalizeId('games', parsed.gameId)
      if (gameId === null) {
        return fail('not-found', 'Pick a Game from the list rather than typing its name.')
      }
    } else {
      const binding =
        parsed.channelId === null ? null : await bindingForChannel(ctx, parsed.channelId)
      if (binding === null) {
        return fail(
          'unbound',
          'This channel is not bound to a Game. Pick one with the game option.'
        )
      }
      gameId = binding.gameId
    }
    const game = await ctx.db.get(gameId)
    if (game === null) return fail('not-found')

    let organizer: Doc<'memberships'>
    try {
      organizer = await requireOrganizerAs(ctx, gameId, user._id)
    } catch (error) {
      return asFailure(error)
    }

    const inviteeName = parsed.invitee.displayName
    const inviteeUser = await userByDiscordId(ctx, parsed.invitee.id)
    if (inviteeUser !== null && (await getMembership(ctx, gameId, inviteeUser._id)) !== null) {
      return { ok: true, outcome: 'already-member', gameName: game.name, inviteeName }
    }

    // A retry of this very interaction: answer with what it minted.
    const retried = await ctx.db
      .query('invites')
      .withIndex('by_source_interaction', (q) => q.eq('sourceInteractionId', parsed.interactionId))
      .first()

    // Somebody already holding a live invite to this table gets that one again
    // — unless the seat changed, in which case the old one is closed and a new
    // one carries the seat the Organizer asked for this time.
    let live = retried ?? (await liveDiscordInvite(ctx, gameId, parsed.invitee.id))
    if (live !== null && retried === null && live.role !== parsed.role) {
      await ctx.db.patch(live._id, { revokedAt: Date.now() })
      live = null
    }

    const row =
      live ??
      (await mintInvite(ctx, organizer, {
        role: parsed.role,
        target: {
          kind: 'discord',
          discordId: parsed.invitee.id,
          name: parsed.invitee.username,
        },
        sourceInteractionId: parsed.interactionId,
      }))

    // One DM per invite per day. Re-running `/su invite` on somebody who
    // already holds this invite re-offers the link to the Organizer, but must
    // not become a way to make the bot DM a person on repeat; a DM still in
    // flight counts as sent. Only a DM that will actually go out resets the
    // delivery note — otherwise it keeps the outcome it already has.
    const now = Date.now()
    const recent = row.delivery
    const deliver = !(
      recent !== undefined &&
      ((recent.state === 'sent' && recent.at > now - DM_COOLDOWN_MS) ||
        (recent.state === 'queued' && recent.at > now - DM_IN_FLIGHT_MS))
    )
    if (deliver) await ctx.db.patch(row._id, { delivery: { state: 'queued', at: now } })

    return {
      ok: true,
      outcome: 'invited',
      code: row.code,
      gameName: game.name,
      invitedBy: displayNameOf(user, 'Crewmate'),
      inviteeDiscordId: parsed.invitee.id,
      inviteeName,
      role: row.role,
      expiresAt: row.expiresAt,
      reused: live !== null,
      deliver,
    }
  },
})

/**
 * The bot reporting whether its `/su invite` DM arrived, so the Organizer's
 * invite list can say "DM not delivered" and they know to pass the code on.
 *
 * This one rides the ordinary bearer path: it writes nothing but a delivery
 * note, on an invite the asserted Discord user must organise.
 */
export const inviteDelivery = internalMutation({
  args: {
    discordId: v.string(),
    code: v.string(),
    state: v.union(v.literal('sent'), v.literal('failed')),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<BotFailure | Ack> => {
    const user = await userByDiscordId(ctx, args.discordId)
    if (user === null) return fail('unlinked')

    const row = await inviteByCode(ctx, args.code)
    if (row === null) return fail('not-found')

    try {
      await requireOrganizerAs(ctx, row.gameId, user._id)
    } catch (error) {
      return asFailure(error)
    }

    await ctx.db.patch(row._id, {
      delivery: {
        state: args.state,
        at: Date.now(),
        detail: args.detail === undefined ? undefined : args.detail.slice(0, 120),
      },
    })
    return { ok: true }
  },
})

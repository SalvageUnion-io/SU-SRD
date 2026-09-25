import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { mutation, summaryOf } from './model/entities'
import {
  getMembership,
  NotAuthorized,
  requireMember,
  requireOrganizer,
  requireUser,
} from './model/permissions'

/**
 * Games — the shared container (ADR-030 §2).
 *
 * A Game collapses campaign, group, and the former Workspace into one concept.
 * The personal **Shelf** is the other container and is not a Game: it is simply
 * the absence of one (`gameId: null` on an entity), which is why there is no
 * `shelves` table.
 */

/** Shape returned to the client for a Game the caller belongs to. */
type GameSummary = {
  _id: Id<'games'>
  name: string
  templateOrigin: string | undefined
  mediator: boolean
  organizer: boolean
  memberCount: number
  /** The communal crawler's name, or null before one exists. */
  crawlerName: string | null
  pilotCount: number
  mechCount: number
}

/**
 * Collapse a Game + the caller's membership into the row the Games list draws.
 *
 * The crawler name and the two counts exist because a Game lists as an
 * `EntityRow` whose badges are "crawler · n pilots · n mechs" — the row has to
 * say what the table *is*, not just what it is called.
 *
 * They come from `games.summary`, which the triggers in `model/entities.ts`
 * keep current, rather than from counting here. Counting here meant collecting
 * every membership, pilot, mech and crawler of every Game the caller belongs
 * to on each run — and because this is a reactive query, reading those rows
 * subscribed the Games list to every sheet in every one of those Games.
 */
async function summarize(
  ctx: QueryCtx,
  game: Doc<'games'>,
  membership: Doc<'memberships'>
): Promise<GameSummary> {
  const summary = await summaryOf(ctx, game)
  return {
    _id: game._id,
    name: game.name,
    templateOrigin: game.templateOrigin,
    mediator: membership.mediator,
    organizer: membership.organizer,
    ...summary,
  }
}

/** Every Game the signed-in user belongs to, with their role in each. */
export const listMine = query({
  args: {},
  handler: async (ctx): Promise<GameSummary[]> => {
    const userId = await requireUser(ctx)
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    const rows = await Promise.all(
      memberships.map(async (membership) => {
        const game = await ctx.db.get(membership.gameId)
        // A membership whose game is gone is a bug, not a state to render.
        return game === null ? null : await summarize(ctx, game, membership)
      })
    )
    return rows.filter((row): row is GameSummary => row !== null)
  },
})

/**
 * One Game, for its own route.
 *
 * Returns `null` rather than throwing when the caller is not a member, because
 * a bookmarked `/games/<id>` for a Game you left is an ordinary thing to visit,
 * not an error to surface. `null` also covers "no such Game", deliberately: a
 * non-member must not be able to tell an existing Game from a deleted one.
 */
export const get = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<GameSummary | null> => {
    const userId = await requireUser(ctx)
    const membership = await getMembership(ctx, args.gameId, userId)
    if (membership === null) return null
    const game = await ctx.db.get(args.gameId)
    if (game === null) return null
    return await summarize(ctx, game, membership)
  },
})

/**
 * Create a Game. The creator becomes its **Organizer**, and — per ADR-030 —
 * Organizer is a modifier on a base role rather than a role of its own, so
 * they are seated as a Player at the same time. `mediator` starts false: many
 * tables decide who runs it after the Game exists, and ownership assignment
 * falls back to the Organizer until someone is appointed.
 */
export const create = mutation({
  args: {
    name: v.string(),
    templateOrigin: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'games'>> => {
    const userId = await requireUser(ctx)
    const name = args.name.trim()
    if (name.length === 0) throw new Error('A game needs a name')

    const gameId = await ctx.db.insert('games', {
      name,
      templateOrigin: args.templateOrigin,
    })
    await ctx.db.insert('memberships', {
      gameId,
      userId,
      mediator: false,
      organizer: true,
      joinedAt: Date.now(),
    })
    return gameId
  },
})

/**
 * Delete a Game, and land everything it held somewhere real.
 *
 * **Organizer only.** Ending a shared campaign is administrative in the sense
 * ADR-030 §3 means it — it is about the table's existence, not about what is on
 * it — so it sits with the Organizer's other acts (`setMediator`, invites)
 * rather than with the table-runner acts. It is deliberately NOT `requireTableRunner`: that helper
 * falls back to the Organizer only while a Game has no Mediator, which would
 * make who may end a campaign depend on whether one has been appointed yet.
 *
 * ## Nothing somebody built is destroyed
 *
 * Every entity falls back to a shelf — the third row of ADR-030 §2's ownership
 * table, `gameId: null` with an owner — rather than dying with the Game:
 *
 * | What                           | Where it lands                  |
 * | ------------------------------ | ------------------------------- |
 * | a pilot or mech with an owner   | that owner's shelf             |
 * | an **unclaimed** pilot or mech  | the deleting Organizer's shelf |
 * | every **crawler**               | the deleting Organizer's shelf |
 * | every **encounter NPC**         | the deleting Organizer's shelf |
 *
 * The first row is the oldest rule here and the one that matters most: deleting
 * a campaign must never delete somebody's character.
 *
 * The other two are what the previous version got wrong. It deleted unclaimed
 * entities and crawlers outright, reasoning that they had no shelf to fall back
 * to — true when it was written, because both need a shelf row carrying an
 * owner and the crawler had no `ownerId` column at all. Both are expressible
 * now (see `schema.ts`), so both fall back, and the receiving shelf is the
 * **deleter's**: they are the one person guaranteed to exist, and the one
 * looking at the consequence as it happens.
 *
 * Note this is the moment a crawler stops being communal. Inside a Game it has
 * no owner by design (D8); on a shelf it must have one, because an entity with
 * neither container nor owner is the invalid row. The Organizer does not so
 * much *take* the crawler as become the person it is now filed under.
 *
 * Rows describing the *table* rather than something built on it — the
 * opposition tray, the wiring, invites, requests, memberships — go with it.
 */
export const destroy = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireOrganizer(ctx, args.gameId)
    const organizerId = membership.userId

    for (const table of ['pilots', 'mechs'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect()
      for (const row of rows) {
        // An unclaimed entity has no owner to fall back to, so the Organizer
        // becomes one. Anything already owned keeps its owner untouched.
        await ctx.db.patch(row._id, {
          gameId: null,
          ownerId: row.ownerId ?? organizerId,
        })
      }
    }

    // The crawler is communal in a Game and owned on a shelf — see above.
    // `ownerId` is unconditionally the Organizer because a crawler in a Game
    // never carried one to preserve.
    const crawlers = await ctx.db
      .query('crawlers')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    for (const crawler of crawlers) {
      await ctx.db.patch(crawler._id, { gameId: null, ownerId: organizerId })
    }

    // The Mediator's prepared opposition falls back for the same reason the
    // crawler does, and it became able to only in the same way: `encounterNpcs`
    // gained a nullable `gameId` and an `ownerId` (ADR-034 decision 2), so a
    // tray is no longer something only a Game can hold. It used to be deleted
    // here — which threw away prep work somebody had genuinely built, the one
    // remaining case of exactly what the rule above forbids.
    //
    // It goes to the Organizer rather than to whoever mediated: a Game may have
    // several Mediators or none, while the deleter is by construction exactly
    // one person who exists.
    const npcs = await ctx.db
      .query('encounterNpcs')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    for (const npc of npcs) {
      await ctx.db.patch(npc._id, { gameId: null, ownerId: organizerId })
    }

    // What is left has no personal counterpart, so it just goes. Note this list
    // is now only the *table's own* apparatus — nothing on it is a thing a
    // person built. `inviteRedemptions`
    // and `joinRequests` belong here for the same reason `invites` does: they
    // describe a way into a Game that no longer exists, and an unanswered knock
    // at a deleted door would sit pending forever.
    //
    // `softLinks` are here because a link is a fact about the table's wiring
    // rather than a possession: a pilot-to-crawler assignment means "aboard
    // this crew's crawler", which stops being true when the crew disbands.
    // Shelved entities land unwired, which is the honest state.
    for (const table of [
      'softLinks',
      'invites',
      'inviteRedemptions',
      'joinRequests',
      'memberships',
    ] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect()
      for (const row of rows) await ctx.db.delete(row._id)
    }

    await ctx.db.delete(args.gameId)
  },
})

/** The Game's roster, with each member's role. Any member may read it. */
export const members = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const rows = await ctx.db
      .query('memberships')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    return await Promise.all(
      rows.map(async (m) => {
        const user = await ctx.db.get(m.userId)
        return {
          userId: m.userId,
          displayName: user?.displayName ?? user?.name ?? 'Unknown pilot',
          avatarUrl: user?.avatarUrl ?? user?.image,
          mediator: m.mediator,
          organizer: m.organizer,
          joinedAt: m.joinedAt,
        }
      })
    )
  },
})

/** Appoint (or stand down) a Mediator. Administrative — Organizer only. */
export const setMediator = mutation({
  args: { gameId: v.id('games'), userId: v.id('users'), mediator: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    await requireOrganizer(ctx, args.gameId)
    const target = await getMembership(ctx, args.gameId, args.userId)
    if (target === null) throw new NotAuthorized('That user is not a member of this game')
    await ctx.db.patch(target._id, { mediator: args.mediator })
  },
})

import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { query } from './_generated/server'
import { displayNameOf } from './model/bot'
import type { LoggedTable } from './model/entities'
import { loadLogged, logIdOf, mutation } from './model/entities'
import { NotAuthorized, requireMember, requireMemberAs, requireUser } from './model/permissions'

/** The table each sheet kind's row lives in. */
const LOGGED_TABLE = { pilot: 'pilots', mech: 'mechs', crawler: 'crawlers' } as const

/**
 * Append client-originated Change Log rows (ADR-022 / ADR-034 P4b).
 *
 * This table is the Change Log: the store's `emitChangeLog`
 * (`src/stores/entityChangeLog.ts`) and the Dashboard's rolls arrive here, and
 * `ownership`, `proposals` and `botClient` write beside them. There is no
 * device copy; `forEntity` below is what the sheet's drawer reads.
 *
 * Rows land `state: 'applied'` and `actorId: userId`. A client append is a
 * record of something that ALREADY happened, not a request — the proposal
 * lifecycle (`proposed`/`declined`/`superseded`) belongs to `proposals.ts` and
 * is deliberately not reachable from here.
 *
 * `before` and `after` are optional on the wire and stored as `null` when
 * absent. A field set for the first time has no `before` and a field cleared
 * has no `after`; both are `undefined` on the client, which the Convex client
 * drops when it serialises the args. Requiring the key refused the whole batch
 * for one missing side (ITUN-CONVEX-3/-4), from every bundle that sent one.
 *
 * Batched because the emitter batches: one edit that touches three fields is
 * three rows, and sending them individually would triple the round trips on
 * the hot path.
 */
export const appendChangeLog = mutation({
  args: {
    entries: v.array(
      v.object({
        gameId: v.union(v.id('games'), v.null()),
        entityType: v.union(
          v.literal('pilot'),
          v.literal('mech'),
          v.literal('crawler'),
          v.literal('softLink'),
          v.literal('game')
        ),
        entityId: v.string(),
        ts: v.number(),
        kind: v.union(v.literal('transaction'), v.literal('override'), v.literal('manual')),
        field: v.string(),
        before: v.optional(v.any()),
        after: v.optional(v.any()),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)

    // `alert` is the Mediator's broadcast channel, not a field a client may
    // append. `proposals.broadcast` writes those rows behind `requireMediator`,
    // and `proposals.alerts` returns every one of them to every member of the
    // game — so without this line any signed-in user could post a message into
    // the whole crew's alert feed, carrying a real `actorId`, by calling this
    // mutation instead. The gate on the intended path is only a gate if the
    // unintended one is closed too.
    const alert = args.entries.find((e) => e.field === 'alert')
    if (alert !== undefined) {
      throw new NotAuthorized('Alerts are written by the Mediator, not by a client append')
    }

    // Membership is checked per distinct game, not per entry.
    //
    // Every field of an entry is client-supplied, `gameId` included, and
    // nothing here derived it from a record the caller can be shown to own. A
    // user who has left a game — or who holds its id from an unredeemed invite
    // link — could therefore write rows into that game's log indefinitely, and
    // `proposals.alerts`/the Change Log drawer would render them as genuine
    // provenance attributed to them.
    //
    // Distinct rather than per-entry because the batch is usually one edit
    // touching several fields of ONE entity: deduplicating keeps this at one
    // membership read for the common case rather than one per row, which
    // preserves the round-trip argument the comment below makes.
    const gameIds = [...new Set(args.entries.flatMap((e) => (e.gameId === null ? [] : [e.gameId])))]
    await Promise.all(gameIds.map((gameId) => requireMemberAs(ctx, gameId, userId)))

    // The entity, too, not only the game. `forEntity` returns every row filed
    // under an entity's id to its owner and crew, so an entry is history the
    // moment it lands: without this, a stranger who knew a pilot's id could
    // append `{ gameId: null, entityType: 'pilot', entityId }` — no game to be
    // a member of — and plant rows in its owner's drawer under their own
    // `actorId`. The caller must be able to write the entity: its owner, or a
    // member of the Game it is in. The client appends only after the entity's
    // own write has committed, so a row that does not exist is refused too.
    // Distinct, as the games are, so a batch about one entity is one read.
    const logged = new Map<string, { table: LoggedTable; entityId: string }>()
    for (const e of args.entries) {
      if (e.entityType === 'pilot' || e.entityType === 'mech' || e.entityType === 'crawler') {
        const table = LOGGED_TABLE[e.entityType]
        logged.set(`${table}:${e.entityId}`, { table, entityId: e.entityId })
      }
    }
    await Promise.all(
      [...logged.values()].map(async ({ table, entityId }) => {
        const row = await loadLogged(ctx, table, entityId)
        if (row === null) throw new NotAuthorized('There is no such entity to log against')
        if (row.ownerId === userId) return
        if (row.gameId === null) throw new NotAuthorized('That is not yours to write')
        await requireMemberAs(ctx, row.gameId, userId)
      })
    )

    // `Promise.all` rather than a serial loop: these are independent inserts and
    // this runs on every sheet edit, so the round trips are the cost.
    await Promise.all(
      args.entries.map((e) =>
        ctx.db.insert('changeLog', {
          gameId: e.gameId,
          entityType: e.entityType,
          entityId: e.entityId,
          ts: e.ts,
          kind: e.kind,
          field: e.field,
          before: e.before ?? null,
          after: e.after ?? null,
          source: e.source,
          actorId: userId,
          state: 'applied',
        })
      )
    )
  },
})

/** The most roll rows `rolls` returns, whatever the caller asks for. */
const MAX_ROLLS = 100

/**
 * The Game's rolls, newest first: the Dashboard's (`source 'dashboard'`) and
 * the Discord bot's (`'discord-bot'`), which both write `entityType 'game'`,
 * `field 'roll'` rows ([ADR-038](../../../docs/ARCHITECTURE.md#adr-038) §2).
 *
 * Reads only the newest `limit` rows off `by_game_field`, as
 * `proposals.alerts` does, so the subscription stays the same size however
 * long the campaign runs. Each row's `after` is `{ description, result }`; a
 * row without a string description still appears, with a placeholder, rather
 * than vanishing from the log. The roller is named the way `games.members`
 * names them, which every member can already read.
 */
export const rolls = query({
  args: { gameId: v.id('games'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const requested = Number.isFinite(args.limit) ? Math.floor(args.limit ?? 30) : 30
    const limit = Math.min(Math.max(requested, 0), MAX_ROLLS)
    const rows = await ctx.db
      .query('changeLog')
      .withIndex('by_game_field', (q) => q.eq('gameId', args.gameId).eq('field', 'roll'))
      .order('desc')
      .take(limit)

    const names = new Map<Id<'users'>, string>()
    for (const actorId of new Set(rows.flatMap((r) => (r.actorId === null ? [] : [r.actorId])))) {
      const user = await ctx.db.get(actorId)
      names.set(actorId, displayNameOf(user))
    }

    return rows.map((r) => {
      const after = (r.after ?? {}) as { description?: unknown }
      return {
        _id: r._id,
        ts: r.ts,
        source: r.source,
        description: typeof after.description === 'string' ? after.description : 'A roll',
        actorName: r.actorId === null ? null : (names.get(r.actorId) ?? null),
      }
    })
  },
})

/** The most rows `forEntity` returns: the drawer's newest page, not the whole history. */
const MAX_ENTITY_ROWS = 100

/**
 * One entity's Change Log, newest first: every applied row — a sheet edit from
 * any device, an ownership change, an applied proposal — and every proposal
 * still awaiting its answer. Declined and superseded proposals are not history
 * of the entity, and are left out.
 *
 * `entityId` is the id the client addresses the entity by (`logIdOf`). Rows
 * written before every writer used it name the entity by its row id, so both
 * are read.
 *
 * Read off `by_entity_state_field`, whose `field` column sits between the key
 * and the time, so the newest `MAX_ENTITY_ROWS` are found by reading the
 * entity's applied and proposed rows and sorting, not by a range scan.
 *
 * Its owner reads it, and so does a member of the Game it is in. An entity the
 * server has no row for has no history here yet, and reads as empty.
 */
export const forEntity = query({
  args: {
    entityType: v.union(v.literal('pilot'), v.literal('mech'), v.literal('crawler')),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const row = await loadLogged(ctx, LOGGED_TABLE[args.entityType], args.entityId)
    if (row === null) return []
    if (row.ownerId !== userId) {
      if (row.gameId === null) throw new NotAuthorized('That is not yours to read')
      await requireMemberAs(ctx, row.gameId, userId)
    }

    const keys = [...new Set<string>([logIdOf(row), row._id])]
    const reads = keys.flatMap((entityId) =>
      (['applied', 'proposed'] as const).map((state) =>
        ctx.db
          .query('changeLog')
          .withIndex('by_entity_state_field', (q) => q.eq('entityId', entityId).eq('state', state))
          .collect()
      )
    )
    const rows = (await Promise.all(reads))
      .flat()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_ENTITY_ROWS)

    return rows.map((r) => ({
      _id: r._id,
      ts: r.ts,
      kind: r.kind,
      field: r.field,
      before: r.before,
      after: r.after,
      source: r.source,
      state: r.state,
    }))
  },
})

import { v } from 'convex/values'
import { isEntityKind, TABLE_OF_KIND } from 'game-domain/entityKinds'
import type { Id } from './_generated/dataModel'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { loadLogged, logIdOf, mutation } from './model/entities'
import { membershipOrNull, NotAuthorized, requireMemberAs, requireUser } from './model/permissions'
import { changeLogEntityType, changeLogKind, changeLogState, entityRefType } from './schema'

/**
 * Append client-originated Change Log rows (ADR-022 / ADR-034 P4b).
 *
 * This table is the Change Log: the store's `emitChangeLog`
 * (`src/replica/outbox.ts`) and Play's rolls arrive here, and
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
 * for one missing side, from every bundle that sent one.
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
        entityType: changeLogEntityType,
        entityId: v.string(),
        ts: v.number(),
        kind: changeLogKind,
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

    // A unit's change is its op (ADR-063), stored where it was applied, so a
    // row about one is the record of a tab older than ops and is not kept:
    // kept, the drawer would show that change twice.
    const entries = args.entries.filter((e) => !isEntityKind(e.entityType))
    if (entries.length === 0) return

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
    const gameIds = [...new Set(entries.flatMap((e) => (e.gameId === null ? [] : [e.gameId])))]
    await Promise.all(gameIds.map((gameId) => requireMemberAs(ctx, gameId, userId)))

    // `Promise.all` rather than a serial loop: these are independent inserts and
    // this runs on every sheet edit, so the round trips are the cost.
    await Promise.all(
      entries.map((e) =>
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
 * The Game's rolls, newest first: Play's (`source 'play'`; the retired
 * Dashboard's `'dashboard'`) and the Discord bot's (`'discord-bot'`), which both write `entityType 'game'`,
 * `field 'roll'` rows ([ADR-038](../../../docs/adr/038-dashboard-game-surface.md) §2).
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
  returns: v.array(
    v.object({
      _id: v.id('changeLog'),
      ts: v.number(),
      source: v.string(),
      description: v.string(),
      actorName: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    if ((await membershipOrNull(ctx, args.gameId)) === null) return []
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
      names.set(actorId, displayNameOf(user, 'Crewmate'))
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

/** Fields an op writes that are bookkeeping, not history a player reads. */
const UNLOGGED: ReadonlySet<string> = new Set(['updatedAt'])

/**
 * One entity's Change Log, newest first, one row per field: its ops (ADR-063)
 * from any device or surface, and the rows logged beside them before ops and
 * still — an ownership change, a proposal still awaiting its answer, an
 * applied one. A proposal applied since ops is shown once, as its op (whose id
 * is the proposal's). Declined and superseded proposals are not history of
 * the entity, and are left out.
 *
 * `entityId` is the id the client addresses the entity by (`logIdOf`). Rows
 * written before every writer used it name the entity by its row id, so both
 * are read.
 *
 * Read a page at a time off `by_unit_state_at` and `by_entity_state_ts`: every
 * stream yields its newest `MAX_ENTITY_ROWS`, and the newest overall are among
 * those, so merging the streams and cutting the sorted result is exact.
 *
 * Its owner reads it, and so does a member of the Game it is in. An entity the
 * server has no row for has no history here yet, and reads as empty.
 */
export const forEntity = query({
  args: {
    entityType: entityRefType,
    entityId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      ts: v.number(),
      kind: changeLogKind,
      field: v.string(),
      before: v.any(),
      after: v.any(),
      source: v.string(),
      state: changeLogState,
    })
  ),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const row = await loadLogged(ctx, TABLE_OF_KIND[args.entityType], args.entityId)
    if (row === null) return []
    if (row.ownerId !== userId) {
      if (row.gameId === null) throw new NotAuthorized('That is not yours to read')
      await requireMemberAs(ctx, row.gameId, userId)
    }

    const keys = [...new Set<string>([logIdOf(row), row._id])]
    const [ops, logged] = await Promise.all([
      Promise.all(
        keys.map((unitId) =>
          ctx.db
            .query('ops')
            .withIndex('by_unit_state_at', (q) => q.eq('unitId', unitId).eq('state', 'applied'))
            .order('desc')
            .take(MAX_ENTITY_ROWS)
        )
      ),
      Promise.all(
        keys.flatMap((entityId) =>
          (['applied', 'proposed'] as const).map((state) =>
            ctx.db
              .query('changeLog')
              .withIndex('by_entity_state_ts', (q) => q.eq('entityId', entityId).eq('state', state))
              .order('desc')
              .take(MAX_ENTITY_ROWS)
          )
        )
      ),
    ])

    const opIds = new Set(ops.flat().map((op) => op.opId))
    const fromOps = ops.flat().flatMap((op) => {
      const patch = (op.patch ?? {}) as Record<string, unknown>
      const before = (op.before ?? {}) as Record<string, unknown>
      return [...Object.keys(patch), ...(op.unset ?? [])]
        .filter((field) => !UNLOGGED.has(field))
        .map((field) => ({
          _id: `${op._id}:${field}`,
          ts: op.at,
          kind: op.kind,
          field,
          before: before[field] ?? null,
          after: patch[field] ?? null,
          source: op.source,
          state: 'applied' as const,
        }))
    })
    const fromLog = logged
      .flat()
      .filter((r) => !opIds.has(r._id))
      .map((r) => ({
        _id: r._id as string,
        ts: r.ts,
        kind: r.kind,
        field: r.field,
        before: r.before,
        after: r.after,
        source: r.source,
        state: r.state,
      }))

    return [...fromOps, ...fromLog].sort((a, b) => b.ts - a.ts).slice(0, MAX_ENTITY_ROWS)
  },
})

import { v } from 'convex/values'
import { mutation } from './model/entities'
import { NotAuthorized, requireMemberAs, requireUser } from './model/permissions'

/**
 * Append client-originated Change Log rows (ADR-022 / ADR-034 P4b).
 *
 * The Change Log is what ADR-030 calls "the spine of this feature", and until
 * this existed it was **two disconnected spines**. The store's `emitChangeLog`
 * (`src/stores/entityChangeLog.ts`)
 * terminated at `db.changeLog.append` — IndexedDB — while the server table was
 * written only by `ownership`, `proposals` and `botClient`. Each drawer showed
 * half the history, and clearing site data destroyed the client half outright
 * because Convex held no copy.
 *
 * Rows land `state: 'applied'` and `actorId: userId`. A client append is a
 * record of something that ALREADY happened locally, not a request — the
 * proposal lifecycle (`proposed`/`declined`/`superseded`) belongs to
 * `proposals.ts` and is deliberately not reachable from here.
 *
 * Batched because the local emitter already batches: one edit that touches
 * three fields is three rows, and sending them individually would triple the
 * round trips on the hot path.
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
        before: v.any(),
        after: v.any(),
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
          before: e.before,
          after: e.after,
          source: e.source,
          actorId: userId,
          state: 'applied',
        })
      )
    )
  },
})

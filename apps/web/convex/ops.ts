import { v } from 'convex/values'
import { query } from './_generated/server'
import { removeCrawlerRow } from './model/crawlerWrites'
import { mutation } from './model/entities'
import { LINK, unwireSoftLink } from './model/linkWrites'
import * as proposals from './model/opProposals'
import { PROPOSE, proposalRow, sentRow } from './model/opProposals'
import type { Applied } from './model/opWrites'
import { applyUnitOp, moveThenApply, replayUnitOp, UNIT_OP } from './model/opWrites'
import { OWNABLE_REMOVE, removeOwnable } from './model/ownableWrites'
import { mediatorOrNull, membershipOrNull, requireUser } from './model/permissions'

/**
 * Ops, the write (ADR-063). The store sends every change to a unit's body
 * here; `model/opWrites.ts` applies it. A Mediator's proposal is an op too,
 * waiting on its owner (`model/opProposals.ts`).
 */

/**
 * Apply one op to a unit. Answers the unit's new `headSeq`, which the
 * author's next op is made against, and the row's version; `null` for a
 * crawler that has been scrapped.
 *
 * Refused with the server's row (`staleWriteError`) when a field it writes
 * changed after its `baseSeq`, and as invalid when the result does not parse.
 * Sending an op id twice applies it once.
 */
export const apply = mutation({
  args: UNIT_OP,
  handler: async (ctx, args): Promise<Applied | null> =>
    applyUnitOp(ctx, await requireUser(ctx), args),
})

/**
 * `apply` for an op an outbox kept offline and sends after a reconnect: a
 * refusal is kept as `declined`, with why, and answered rather than thrown.
 */
export const replay = mutation({
  args: UNIT_OP,
  handler: async (ctx, args): Promise<Applied | null | { declined: string }> =>
    replayUnitOp(ctx, await requireUser(ctx), args),
})

/**
 * Move value between units (cargo, a scrap hand-off) as ONE mutation: its ops
 * and deletes land together or not at all (ADR-008 as amended). A crawler op
 * may carry `move`, its container, which `moveCrawler` writes first.
 */
export const transfer = mutation({
  args: {
    ops: v.array(v.object({ ...UNIT_OP, move: v.optional(v.union(v.id('games'), v.null())) })),
    deletes: v.array(
      v.union(
        v.object(OWNABLE_REMOVE),
        v.object({ table: v.literal('crawlers'), appId: v.string() }),
        v.object({ table: v.literal('softLinks'), ...LINK })
      )
    ),
  },
  handler: async (ctx, args): Promise<{ applied: Array<{ unitId: string } & Applied> }> => {
    const userId = await requireUser(ctx)
    const applied: Array<{ unitId: string } & Applied> = []
    for (const op of args.ops) {
      const result = await moveThenApply(ctx, userId, op)
      if (result !== null) applied.push({ unitId: op.op.unitId, ...result })
    }
    for (const removal of args.deletes) {
      if (removal.table === 'softLinks') {
        const { table: _table, ...link } = removal
        await unwireSoftLink(ctx, userId, link)
      } else if (removal.table === 'crawlers') {
        await removeCrawlerRow(ctx, removal.appId)
      } else {
        await removeOwnable(ctx, userId, removal.table, removal.appId, removal.gameId)
      }
    }
    return { applied }
  },
})

/** Propose one field of a player's pilot or mech; answers the proposal's op id. */
export const propose = mutation({
  args: PROPOSE,
  handler: async (ctx, args): Promise<string> => proposals.propose(ctx, args),
})

/** Proposals awaiting the caller's answer in a Game, newest first. */
export const pending = query({
  args: { gameId: v.id('games') },
  returns: v.array(v.object(proposalRow)),
  handler: async (ctx, args) => {
    const membership = await membershipOrNull(ctx, args.gameId)
    return membership === null ? [] : proposals.pending(ctx, args.gameId, membership.userId)
  },
})

/** Every Mediator proposal in a Game, newest first, a page at a time; Mediators only. */
export const sent = query({
  args: { gameId: v.id('games'), limit: v.optional(v.number()) },
  returns: v.array(v.object(sentRow)),
  handler: async (ctx, args) => {
    const membership = await mediatorOrNull(ctx, args.gameId)
    return membership === null
      ? []
      : proposals.sent(ctx, args.gameId, membership.userId, args.limit)
  },
})

/** Accept a proposal on your own unit: you apply it. */
export const accept = mutation({
  args: { opId: v.string() },
  handler: async (ctx, args): Promise<void> => proposals.accept(ctx, args.opId),
})

/** Decline a proposal on your own unit. */
export const decline = mutation({
  args: { opId: v.string() },
  handler: async (ctx, args): Promise<void> => proposals.decline(ctx, args.opId),
})

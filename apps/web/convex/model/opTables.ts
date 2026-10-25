import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { OP_STATES } from 'game-domain/ops/opState'
import { CHANGE_LOG_KINDS } from 'game-domain/schemas/changeLog'
import { literalUnion } from './validators'

/**
 * The op log (ADR-063), spread into `schema.ts`: every change to a unit's body,
 * as `applyOp` applied it. Split out as Play's tables are, and under the same
 * rules as that file's header.
 */

/** A unit's kind, as an op names it. */
export const unitKind = v.union(
  v.literal('pilot'),
  v.literal('mech'),
  v.literal('crawler'),
  v.literal('npc')
)

/** The source only `ops.propose` writes: no op a client sends may claim it. */
export const PROPOSAL_SOURCE = 'mediator-proposal'

/** An op as its author sends it (`OpInput`). */
export const opInput = v.object({
  id: v.string(),
  unitId: v.string(),
  baseSeq: v.union(v.number(), v.null()),
  at: v.number(),
  kind: literalUnion(CHANGE_LOG_KINDS),
  source: v.string(),
  patch: v.any(),
  unset: v.optional(v.array(v.string())),
})

export const opTables = {
  ops: defineTable({
    /** The Game the unit was in when the op landed; null on a shelf. */
    gameId: v.union(v.id('games'), v.null()),
    unitKind,
    /** The unit's `logIdOf`: its app id, or its row id when it has none. */
    unitId: v.string(),
    /** The author's op id; one id is applied once. */
    opId: v.string(),
    /** The unit's sequence number; null until applied. */
    seq: v.union(v.number(), v.null()),
    baseSeq: v.union(v.number(), v.null()),
    author: v.id('users'),
    at: v.number(),
    kind: literalUnion(CHANGE_LOG_KINDS),
    source: v.string(),
    state: literalUnion(OP_STATES),
    patch: v.any(),
    unset: v.optional(v.array(v.string())),
    /** What the written fields held, filled in when applied. */
    before: v.union(v.any(), v.null()),
    reason: v.optional(v.string()),
  })
    .index('by_op_id', ['opId'])
    // `changeLog.forEntity`: one unit's ops in one state, newest first, a page at a time.
    .index('by_unit_state_at', ['unitId', 'state', 'at'])
    // A Game's proposals: those awaiting an answer, and every one a Mediator sent.
    .index('by_game_state_at', ['gameId', 'state', 'at'])
    .index('by_game_source_at', ['gameId', 'source', 'at']),
}

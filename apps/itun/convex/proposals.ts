import { v } from 'convex/values'

import { MechSchema } from '../src/lib/schemas/mech'
import { PilotSchema } from '../src/lib/schemas/pilot'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { NotAuthorized, requireMediator, requireMember, requireUser } from './model/permissions'

/**
 * Proposals and alerts (ADR-030 §4, Phase 4).
 *
 * This is the mechanism that lets a Mediator reach a player's sheet without
 * ever writing it. They push a **proposal**; the player applies or declines it.
 *
 * ## Alerts and cross-player writes are one system, not two
 *
 * Both are rows in the Change Log. A proposal is an entry in `proposed` state
 * carrying `before`/`after` for one field; an alert is the same row with no
 * entity target. That is the payoff for ADR-022 having built the log
 * append-only, ordered and replay-shaped before any of this existed — there was
 * no second bus to design.
 *
 * ## Three rules the tests pin
 *
 *  - **Nothing expires.** An unanswered proposal stays `proposed` forever. A
 *    timer would silently drop damage a player was meant to take, which is the
 *    exact bookkeeping error the feature exists to prevent.
 *  - **Nothing is force-applied.** There is no mutation here that writes an
 *    entity on the player's behalf. Adding one would collapse
 *    propose-and-confirm back into the direct write ADR-030 rejects.
 *  - **Newer supersedes older, per field.** A second proposal against the same
 *    `(entityId, field)` retires the first, so a player never faces two
 *    contradictory pending changes to one value.
 */

/**
 * The table a Change Log row's `entityType` names, or null when it names none.
 *
 * A log row is not always about a sheet — a table-wide alert or a recorded roll
 * is written against the Game itself — so this is a partial mapping on purpose.
 */
function ownableTableFor(entityType: Doc<'changeLog'>['entityType']): 'pilots' | 'mechs' | null {
  if (entityType === 'pilot') return 'pilots'
  if (entityType === 'mech') return 'mechs'
  return null
}

/** Only the Mediator proposes; only the target's owner answers. */
async function requireProposalTarget(
  ctx: MutationCtx,
  entityType: Doc<'changeLog'>['entityType'],
  entityId: string
): Promise<{ doc: Doc<'pilots'> | Doc<'mechs'>; gameId: Id<'games'> }> {
  // `normalizeId` is what makes `entityType` load-bearing rather than
  // decorative: a Convex id is table-tagged, but `db.get` returns a document
  // from ANY table, so casting the string let a proposal be aimed at a row that
  // is not a sheet at all and then read as one. An id that is not the named
  // table's is simply not there.
  const table = ownableTableFor(entityType)
  const id = table === null ? null : ctx.db.normalizeId(table, entityId)
  if (id === null) throw new Error('That entity no longer exists')

  const doc = await ctx.db.get(id)
  if (doc === null) throw new Error('That entity no longer exists')
  if (doc.gameId === null) {
    throw new NotAuthorized('An entity on a shelf is not part of a game and cannot be proposed to')
  }
  return { doc, gameId: doc.gameId }
}

/**
 * Propose a change to one field of a player's entity.
 *
 * `before` is captured from the Mediator's view at propose time and is shown to
 * the player alongside `after`, so they can see what the Mediator believed the
 * value was. It is deliberately not re-read at apply time: a mismatch is
 * information the player should see, not something to paper over.
 */
export const propose = mutation({
  args: {
    entityId: v.string(),
    entityType: v.union(v.literal('pilot'), v.literal('mech')),
    field: v.string(),
    before: v.any(),
    after: v.any(),
  },
  handler: async (ctx, args): Promise<Id<'changeLog'>> => {
    const { doc, gameId } = await requireProposalTarget(ctx, args.entityType, args.entityId)
    const membership = await requireMediator(ctx, gameId)

    if (doc.ownerId === null) {
      throw new NotAuthorized('That entity is unclaimed — assign it before proposing changes')
    }

    // Supersede any live proposal against the same field, so the player is
    // never asked to choose between two contradictory pending values.
    const live = await ctx.db
      .query('changeLog')
      .withIndex('by_entity', (q) => q.eq('entityId', args.entityId))
      .collect()

    const proposalId = await ctx.db.insert('changeLog', {
      gameId,
      entityType: args.entityType,
      entityId: args.entityId,
      ts: Date.now(),
      kind: 'transaction',
      field: args.field,
      before: args.before,
      after: args.after,
      source: 'mediator-proposal',
      actorId: membership.userId,
      state: 'proposed',
    })

    for (const row of live) {
      if (row.state === 'proposed' && row.field === args.field && row._id !== proposalId) {
        await ctx.db.patch(row._id, { state: 'superseded', supersededBy: proposalId })
      }
    }

    return proposalId
  },
})

/** Proposals awaiting this player's answer, newest first. */
export const pending = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const userId = await requireUser(ctx)

    const rows = await ctx.db
      .query('changeLog')
      .withIndex('by_game_state', (q) => q.eq('gameId', args.gameId).eq('state', 'proposed'))
      .collect()

    const mine = []
    for (const row of rows) {
      // Same table-tagging guard as `requireProposalTarget`: resolve the id
      // against the table `entityType` names, and skip a row whose id belongs
      // to some other table rather than reading it as a sheet.
      const table = ownableTableFor(row.entityType)
      const targetId = table === null ? null : ctx.db.normalizeId(table, row.entityId)
      if (targetId === null) continue

      const target = await ctx.db.get(targetId)
      // Only the owner is asked. A proposal against somebody else's entity is
      // not this player's to answer, and showing it would leak an edit in
      // flight.
      if (target === null || target.ownerId !== userId) continue
      mine.push({
        _id: row._id,
        entityId: row.entityId,
        entityType: row.entityType,
        field: row.field,
        before: row.before,
        after: row.after,
        ts: row.ts,
      })
    }
    return mine.sort((a, b) => b.ts - a.ts)
  },
})

/**
 * Apply a proposal to your own entity.
 *
 * The **player** performs the write — that is the whole point. The mutation
 * refuses if the caller is not the owner, so "apply" can never become a path
 * by which somebody else's confirmation moves your numbers.
 */
export const apply = mutation({
  args: { proposalId: v.id('changeLog') },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const proposal = await ctx.db.get(args.proposalId)
    if (proposal === null) throw new Error('That proposal no longer exists')
    if (proposal.state !== 'proposed') throw new Error('That proposal has already been answered')

    const { doc } = await requireProposalTarget(ctx, proposal.entityType, proposal.entityId)
    if (doc.ownerId !== userId) throw new NotAuthorized('Only the owner can apply this')

    /**
     * Parse before persisting, like every other write against an entity body.
     *
     * This mutation used to patch the merged object straight in, and it is the
     * one place where skipping the parse does real damage rather than merely
     * risking it: the field name comes from a proposal row, so a typo'd or
     * stale key was written as a **new** key on the body instead of changing
     * anything. The player applied a proposal, saw nothing move, and the sheet
     * quietly carried a field nothing reads. Parsing rejects that at the source.
     */
    const parser = proposal.entityType === 'mech' ? MechSchema : PilotSchema
    const merged = { ...(doc.body as Record<string, unknown>), [proposal.field]: proposal.after }
    const result = parser.safeParse(merged)
    if (!result.success) {
      throw new Error(
        `That proposal does not fit this sheet: ${result.error.issues[0]?.message ?? 'unknown'}`
      )
    }

    await ctx.db.patch(doc._id, { body: result.data, updatedAt: Date.now() })
    await ctx.db.patch(args.proposalId, { state: 'applied' })
  },
})

/** Decline a proposal. Recorded, not deleted — the log is append-only. */
export const decline = mutation({
  args: { proposalId: v.id('changeLog') },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const proposal = await ctx.db.get(args.proposalId)
    if (proposal === null) return
    if (proposal.state !== 'proposed') return

    const { doc } = await requireProposalTarget(ctx, proposal.entityType, proposal.entityId)
    if (doc.ownerId !== userId) throw new NotAuthorized('Only the owner can decline this')

    await ctx.db.patch(args.proposalId, { state: 'declined' })
  },
})

/**
 * Broadcast a table-wide alert.
 *
 * The same log row with no entity target — which is why alerts needed no
 * separate bus. Any member reads them; only the Mediator sends.
 */
export const broadcast = mutation({
  args: { gameId: v.id('games'), message: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireMediator(ctx, args.gameId)
    const message = args.message.trim()
    if (message.length === 0) throw new Error('An alert needs a message')

    await ctx.db.insert('changeLog', {
      gameId: args.gameId,
      entityType: 'game',
      entityId: args.gameId,
      ts: Date.now(),
      kind: 'transaction',
      field: 'alert',
      before: null,
      after: message,
      source: 'mediator-alert',
      actorId: membership.userId,
      state: 'applied',
    })
  },
})

/** Table-wide alerts, newest first. */
export const alerts = query({
  args: { gameId: v.id('games'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const rows = await ctx.db
      .query('changeLog')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    return rows
      .filter((r) => r.field === 'alert')
      .sort((a, b) => b.ts - a.ts)
      .slice(0, args.limit ?? 20)
      .map((r) => ({ _id: r._id, message: String(r.after), ts: r.ts, actorId: r.actorId }))
  },
})

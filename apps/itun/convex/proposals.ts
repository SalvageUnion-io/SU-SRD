import { ConvexError, v } from 'convex/values'
import { normalizeReason, PROPOSAL_REASON_MAX } from '../src/lib/games/proposals'
import { MechSchema } from '../src/lib/schemas/mech'
import { PilotSchema } from '../src/lib/schemas/pilot'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { loadLogged, logIdOf, mutation } from './model/entities'
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
 * carrying the `after` it asks for one field; an alert is the same row with no
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

/**
 * The sheet a proposal row names, or null: resolved by the id the row carries
 * (`loadLogged` — the entity's app id, or its row id on a row written before
 * proposals used `logIdOf`). A row whose `entityType` names no sheet table is
 * not a proposal target at all.
 */
async function proposalTarget(
  ctx: QueryCtx | MutationCtx,
  entityType: Doc<'changeLog'>['entityType'],
  entityId: string
): Promise<Doc<'pilots'> | Doc<'mechs'> | null> {
  const table = ownableTableFor(entityType)
  if (table === null) return null
  return (await loadLogged(ctx, table, entityId)) as Doc<'pilots'> | Doc<'mechs'> | null
}

/** Only the Mediator proposes; only the target's owner answers. */
async function requireProposalTarget(
  ctx: MutationCtx,
  entityType: Doc<'changeLog'>['entityType'],
  entityId: string
): Promise<{ doc: Doc<'pilots'> | Doc<'mechs'>; gameId: Id<'games'> }> {
  const doc = await proposalTarget(ctx, entityType, entityId)
  if (doc === null) throw new Error('That entity no longer exists')
  if (doc.gameId === null) {
    throw new NotAuthorized('A build in My Stuff is not part of a game and cannot be proposed to')
  }
  return { doc, gameId: doc.gameId }
}

/**
 * Propose a change to one field of a player's entity.
 *
 * The row names the entity by `logIdOf`, the id its sheet's Change Log is read
 * by, whichever id the Mediator's client addressed it with. A proposal carries
 * only the value it asks for; its `before` is `null`.
 *
 * It may carry a `reason` (issue 1278): trimmed, dropped when blank, and refused
 * past `PROPOSAL_REASON_MAX` characters rather than cut, so the player reads
 * the Mediator's words as written.
 */
export const propose = mutation({
  args: {
    entityId: v.string(),
    entityType: v.union(v.literal('pilot'), v.literal('mech')),
    field: v.string(),
    after: v.any(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'changeLog'>> => {
    const { doc, gameId } = await requireProposalTarget(ctx, args.entityType, args.entityId)
    const membership = await requireMediator(ctx, gameId)

    let reason: string | undefined
    try {
      reason = normalizeReason(args.reason)
    } catch {
      // Refused, not dropped: the Mediator sees why and shortens it.
      throw new ConvexError(`A reason is at most ${PROPOSAL_REASON_MAX} characters`)
    }

    if (doc.ownerId === null) {
      throw new NotAuthorized('That entity is unclaimed — assign it before proposing changes')
    }

    // Supersede any live proposal against the same field, so the player is
    // never asked to choose between two contradictory pending values. Read
    // through the full index key, so this is the (normally zero or one) live
    // proposals for this field rather than the entity's entire history — under
    // both ids a live proposal may carry (see `proposalTarget`).
    const entityId = logIdOf(doc)
    const live = (
      await Promise.all(
        [...new Set<string>([entityId, doc._id])].map((id) =>
          ctx.db
            .query('changeLog')
            .withIndex('by_entity_state_field', (q) =>
              q.eq('entityId', id).eq('state', 'proposed').eq('field', args.field)
            )
            .collect()
        )
      )
    ).flat()

    const proposalId = await ctx.db.insert('changeLog', {
      gameId,
      entityType: args.entityType,
      entityId,
      ts: Date.now(),
      kind: 'transaction',
      field: args.field,
      before: null,
      after: args.after,
      source: 'mediator-proposal',
      actorId: membership.userId,
      state: 'proposed',
      ...(reason === undefined ? {} : { reason }),
    })

    for (const row of live) {
      await ctx.db.patch(row._id, { state: 'superseded', supersededBy: proposalId })
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
      // Same resolution as `requireProposalTarget`: against the table
      // `entityType` names, skipping a row that names no sheet.
      const target = await proposalTarget(ctx, row.entityType, row.entityId)
      // Only the owner is asked. A proposal against somebody else's entity is
      // not this player's to answer, and showing it would leak an edit in
      // flight.
      if (target === null || target.ownerId !== userId) continue
      mine.push({
        _id: row._id,
        entityId: row.entityId,
        entityType: row.entityType,
        targetName: targetName(target, row.entityType),
        field: row.field,
        after: row.after,
        reason: row.reason ?? null,
        ts: row.ts,
      })
    }
    return mine.sort((a, b) => b.ts - a.ts)
  },
})

/** The most proposals one `sent` read returns, whatever the caller asks for. */
const MAX_SENT = 100

/** What the Mediator's surfaces read a sheet by: its name, by kind. */
function targetName(doc: Doc<'pilots'> | Doc<'mechs'> | null, entityType: string): string | null {
  if (doc === null) return null
  const body = doc.body as Record<string, unknown> | null
  const name = entityType === 'pilot' ? body?.callsign : body?.name
  return typeof name === 'string' ? name : null
}

/**
 * Every Mediator proposal in a Game, in every state, newest first (issue 1278).
 *
 * Mediator-only (`requireMediator`): the crew reads its own proposals through
 * `pending`, and a player has no use for what was asked of a crewmate. Every
 * Mediator proposal is returned, not only the viewer's, so a Mediator who was
 * handed the table inherits what is still pending. `mine` says whether the
 * viewer sent it, and `actorName` names whoever else did.
 *
 * Read `limit` rows at a time (20 unless asked; never more than `MAX_SENT`)
 * off `by_game_source_ts`, in order: this is a reactive query on a log that
 * grows all campaign, so it never collects it. A row carries no before — a
 * proposal stores none (ADR-030 §4 as amended for issue 1130).
 */
export const sent = query({
  args: { gameId: v.id('games'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const membership = await requireMediator(ctx, args.gameId)
    const requested = Number.isFinite(args.limit) ? Math.floor(args.limit ?? 20) : 20
    const limit = Math.min(Math.max(requested, 1), MAX_SENT)
    const rows = await ctx.db
      .query('changeLog')
      .withIndex('by_game_source_ts', (q) =>
        q.eq('gameId', args.gameId).eq('source', 'mediator-proposal')
      )
      .order('desc')
      .take(limit)

    const names = new Map<string, string>()
    const out = []
    for (const row of rows) {
      const target = await proposalTarget(ctx, row.entityType, row.entityId)
      const mine = row.actorId === membership.userId
      let actorName: string | null = null
      if (!mine && row.actorId !== null) {
        const cached = names.get(row.actorId)
        if (cached === undefined) {
          const user = await ctx.db.get(row.actorId)
          actorName = user?.displayName ?? user?.name ?? 'Another Mediator'
          names.set(row.actorId, actorName)
        } else {
          actorName = cached
        }
      }
      out.push({
        _id: row._id,
        entityId: row.entityId,
        entityType: row.entityType,
        targetName: targetName(target, row.entityType),
        field: row.field,
        after: row.after,
        reason: row.reason ?? null,
        state: row.state,
        ts: row.ts,
        mine,
        actorName,
      })
    }
    return out
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
     * This is the one place where skipping the parse does real damage rather
     * than merely risking it: the field name comes from a proposal row, so a
     * typo'd or stale key would be written as a **new** key on the body instead
     * of changing anything. Parsing rejects that at the source.
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

/** The most alerts one read returns, whatever the caller asks for. */
const MAX_ALERTS = 100

/**
 * Table-wide alerts, newest first.
 *
 * Reads only the newest `limit` alert rows, in order, off `by_game_field`:
 * collecting the whole change log and filtering in JS would, on a reactive
 * query, re-run a read that grows for the life of the campaign on every write
 * to any sheet in the Game.
 */
export const alerts = query({
  args: { gameId: v.id('games'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const requested = Number.isFinite(args.limit) ? Math.floor(args.limit ?? 20) : 20
    const limit = Math.min(Math.max(requested, 0), MAX_ALERTS)
    const rows = await ctx.db
      .query('changeLog')
      .withIndex('by_game_field', (q) => q.eq('gameId', args.gameId).eq('field', 'alert'))
      .order('desc')
      .take(limit)

    return rows.map((r) => ({ _id: r._id, message: String(r.after), ts: r.ts, actorId: r.actorId }))
  },
})

import { ConvexError, v } from 'convex/values'
import { normalizeReason, PROPOSAL_REASON_MAX } from 'game-domain/games/proposals'
import { OP_STATES } from 'game-domain/ops/opState'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { displayNameOf } from '../account'
import { loadLogged, logIdOf } from './entities'
import { entityNameOf } from './entityName'
import { applyToRow } from './opWrites'
import { NotAuthorized, requireMediator, requireUser } from './permissions'
import { literalUnion } from './validators'

/**
 * Proposals (ADR-030 §4, ADR-063 §5): a Mediator's change to one field of a
 * player's pilot or mech, held as an op in `proposed` state on that unit
 * until its owner answers. Accept applies the op as the owner's write;
 * Decline marks it `declined`.
 *
 * Three rules the tests pin:
 *  - **Nothing expires.** An unanswered proposal stays `proposed`: a timer
 *    would silently drop damage a player was meant to take.
 *  - **Nothing is force-applied.** Only the unit's owner applies one; no path
 *    writes a sheet on the player's behalf.
 *  - **Newer supersedes older, per field**, so a player never faces two
 *    contradictory pending values for one field.
 */

type Target = Doc<'pilots'> | Doc<'mechs'>
type ProposableKind = 'pilot' | 'mech'

const proposable = v.union(v.literal('pilot'), v.literal('mech'))

/** What `ops.propose` takes. */
export const PROPOSE = {
  entityId: v.string(),
  entityType: proposable,
  field: v.string(),
  after: v.any(),
  reason: v.optional(v.string()),
}

/** A proposal as `pending` and `sent` serve it; `_id` is the op's id. */
export const proposalRow = {
  _id: v.string(),
  entityId: v.string(),
  entityType: proposable,
  targetName: v.union(v.string(), v.null()),
  field: v.string(),
  after: v.any(),
  reason: v.union(v.string(), v.null()),
  ts: v.number(),
}

export const sentRow = {
  ...proposalRow,
  state: literalUnion(OP_STATES),
  mine: v.boolean(),
  actorName: v.union(v.string(), v.null()),
}

/** The most live proposals one supersede reads on a unit; `propose` keeps it at one per field. */
const MAX_LIVE_PER_UNIT = 50
/** The most proposed ops one `pending` read examines. */
const MAX_PENDING = 500
/** The most proposals one `sent` read returns. */
const MAX_SENT = 100

function tableOf(kind: ProposableKind): 'pilots' | 'mechs' {
  return kind === 'pilot' ? 'pilots' : 'mechs'
}

function proposableKind(op: Doc<'ops'>): ProposableKind | null {
  return op.unitKind === 'pilot' || op.unitKind === 'mech' ? op.unitKind : null
}

/** The sheet a proposal names, or null when it is gone. */
async function targetOf(
  ctx: QueryCtx | MutationCtx,
  kind: ProposableKind,
  unitId: string
): Promise<Target | null> {
  return (await loadLogged(ctx, tableOf(kind), unitId)) as Target | null
}

/** The sheet, refused when gone or not in a Game. */
async function requireTarget(ctx: MutationCtx, kind: ProposableKind, unitId: string) {
  const doc = await targetOf(ctx, kind, unitId)
  if (doc === null) throw new ConvexError('That entity no longer exists')
  if (doc.gameId === null) {
    throw new NotAuthorized(
      'A build in a Training Bay is not part of a Game and cannot be proposed to'
    )
  }
  return { doc, gameId: doc.gameId }
}

/** The one field a proposal writes. */
function fieldOf(op: Doc<'ops'>): string {
  return Object.keys(op.patch as Record<string, unknown>)[0] ?? ''
}

function rowOf(op: Doc<'ops'>, kind: ProposableKind, target: Target | null) {
  const field = fieldOf(op)
  return {
    _id: op.opId,
    entityId: op.unitId,
    entityType: kind,
    targetName: target === null ? null : entityNameOf(kind, target.body),
    field,
    after: (op.patch as Record<string, unknown>)[field],
    reason: op.reason ?? null,
    ts: op.at,
  }
}

/**
 * Propose one field's new value. The op names the unit by `logIdOf`; any live
 * proposal on the same field is superseded. A `reason` is trimmed, dropped when
 * blank, and refused past `PROPOSAL_REASON_MAX` rather than cut.
 */
export async function propose(
  ctx: MutationCtx,
  args: {
    entityId: string
    entityType: ProposableKind
    field: string
    after: unknown
    reason?: string
  }
): Promise<string> {
  const { doc, gameId } = await requireTarget(ctx, args.entityType, args.entityId)
  const membership = await requireMediator(ctx, gameId)
  let reason: string | undefined
  try {
    reason = normalizeReason(args.reason)
  } catch {
    throw new ConvexError(`A reason is at most ${PROPOSAL_REASON_MAX} characters`)
  }
  if (doc.ownerId === null) {
    throw new NotAuthorized('That entity is unassigned — assign it before proposing changes')
  }

  const unitId = logIdOf(doc)
  const live = await ctx.db
    .query('ops')
    .withIndex('by_unit_state_at', (q) => q.eq('unitId', unitId).eq('state', 'proposed'))
    .take(MAX_LIVE_PER_UNIT)
  for (const op of live) {
    if (fieldOf(op) === args.field) await ctx.db.patch(op._id, { state: 'superseded' })
  }

  const opId = crypto.randomUUID()
  await ctx.db.insert('ops', {
    gameId,
    unitKind: args.entityType,
    unitId,
    opId,
    seq: null,
    baseSeq: null,
    author: membership.userId,
    at: Date.now(),
    kind: 'transaction',
    source: 'mediator-proposal',
    state: 'proposed',
    patch: { [args.field]: args.after },
    before: null,
    ...(reason === undefined ? {} : { reason }),
  })
  return opId
}

/** Proposals awaiting this player's answer, newest first. */
export async function pending(ctx: QueryCtx, gameId: Id<'games'>, userId: Id<'users'>) {
  const ops = await ctx.db
    .query('ops')
    .withIndex('by_game_state_at', (q) => q.eq('gameId', gameId).eq('state', 'proposed'))
    .order('desc')
    .take(MAX_PENDING)
  const mine = []
  for (const op of ops) {
    const kind = proposableKind(op)
    if (kind === null) continue
    const target = await targetOf(ctx, kind, op.unitId)
    // Only the owner is asked; another's proposal would leak an edit in flight.
    if (target === null || target.ownerId !== userId) continue
    mine.push(rowOf(op, kind, target))
  }
  return mine
}

/**
 * Every Mediator proposal in a Game, every state, newest first, `limit` at a
 * time (20 unless asked, never more than `MAX_SENT`). `mine` says whether the
 * viewer sent it; `actorName` names whoever else did.
 */
export async function sent(
  ctx: QueryCtx,
  gameId: Id<'games'>,
  viewer: Id<'users'>,
  limit: number | undefined
) {
  const requested = Number.isFinite(limit) ? Math.floor(limit ?? 20) : 20
  const ops = await ctx.db
    .query('ops')
    .withIndex('by_game_source_at', (q) => q.eq('gameId', gameId).eq('source', 'mediator-proposal'))
    .order('desc')
    .take(Math.min(Math.max(requested, 1), MAX_SENT))
  const names = new Map<string, string>()
  const out = []
  for (const op of ops) {
    const kind = proposableKind(op)
    if (kind === null) continue
    const mine = op.author === viewer
    let actorName: string | null = null
    if (!mine) {
      actorName =
        names.get(op.author) ?? displayNameOf(await ctx.db.get(op.author), 'Another Mediator')
      names.set(op.author, actorName)
    }
    out.push({
      ...rowOf(op, kind, await targetOf(ctx, kind, op.unitId)),
      state: op.state,
      mine,
      actorName,
    })
  }
  return out
}

/** A proposal still awaiting its answer, and its sheet, once the caller is shown to own it. */
async function answerable(ctx: MutationCtx, opId: string, verb: string) {
  const userId = await requireUser(ctx)
  const op = await ctx.db
    .query('ops')
    .withIndex('by_op_id', (q) => q.eq('opId', opId))
    .first()
  const kind = op === null ? null : proposableKind(op)
  if (op === null || kind === null || op.source !== 'mediator-proposal') return null
  if (op.state !== 'proposed') return { op, kind, doc: null, userId }
  const { doc } = await requireTarget(ctx, kind, op.unitId)
  if (doc.ownerId !== userId) throw new NotAuthorized(`Only the owner can ${verb} this`)
  return { op, kind, doc, userId }
}

/**
 * Accept: the owner applies the op as their own write (`applyToRow`), which
 * parses the result, so a field name the sheet no longer has is refused.
 */
export async function accept(ctx: MutationCtx, opId: string): Promise<void> {
  const found = await answerable(ctx, opId, 'apply')
  if (found === null) throw new ConvexError('That proposal no longer exists')
  const { op, kind, doc, userId } = found
  if (doc === null) throw new ConvexError('That proposal has already been answered')
  try {
    await applyToRow(
      ctx,
      userId,
      kind,
      doc,
      {
        id: op.opId,
        unitId: op.unitId,
        baseSeq: null,
        at: op.at,
        kind: op.kind,
        source: op.source,
        patch: op.patch as Record<string, unknown>,
      },
      op._id
    )
  } catch (err) {
    if (err instanceof ConvexError) throw err
    throw new ConvexError(`That proposal does not fit this sheet: ${(err as Error).message}`)
  }
}

/** Decline: recorded as `declined`, never deleted. */
export async function decline(ctx: MutationCtx, opId: string): Promise<void> {
  const found = await answerable(ctx, opId, 'decline')
  if (found === null || found.doc === null) return
  await ctx.db.patch(found.op._id, { state: 'declined' })
}

/**
 * Copy one page of proposals still awaiting an answer in the Change Log, from
 * before proposals were ops, into ops (`ops.copyLegacyProposals`). Each keeps
 * its row id as its op id, so a second run copies nothing twice and the drawer
 * shows it once.
 */
export async function copyLegacyProposals(
  ctx: MutationCtx,
  cursor: string | null
): Promise<{ copied: number; cursor: string; done: boolean }> {
  const page = await ctx.db
    .query('changeLog')
    .filter((q) =>
      q.and(q.eq(q.field('state'), 'proposed'), q.eq(q.field('source'), 'mediator-proposal'))
    )
    .paginate({ cursor, numItems: 100 })
  let copied = 0
  for (const row of page.page) {
    if (row.entityType !== 'pilot' && row.entityType !== 'mech') continue
    const target = await targetOf(ctx, row.entityType, row.entityId)
    if (target === null || target.gameId === null || row.actorId === null) continue
    const seen = await ctx.db
      .query('ops')
      .withIndex('by_op_id', (q) => q.eq('opId', row._id))
      .first()
    if (seen !== null) continue
    await ctx.db.insert('ops', {
      gameId: target.gameId,
      unitKind: row.entityType,
      unitId: logIdOf(target),
      opId: row._id,
      seq: null,
      baseSeq: null,
      author: row.actorId,
      at: row.ts,
      kind: row.kind,
      source: row.source,
      state: 'proposed',
      patch: { [row.field]: row.after },
      before: null,
      ...(row.reason === undefined ? {} : { reason: row.reason }),
    })
    copied++
  }
  return { copied, cursor: page.continueCursor, done: page.isDone }
}

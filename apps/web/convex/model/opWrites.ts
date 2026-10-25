import type { ObjectType } from 'convex/values'
import { ConvexError, v } from 'convex/values'
import type { EntityKind } from 'game-domain/entityKinds'
import { TABLE_OF_KIND } from 'game-domain/entityKinds'
import type { OpInput } from 'game-domain/ops/applyOp'
import { applyOp, diffBodies, isEmptyOp, unitOf } from 'game-domain/ops/applyOp'
import { isDowntimeStepOp } from 'game-domain/ops/downtimeStep'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { assertMayEditCrawler, crawlerByAppId, moveCrawlerRow } from './crawlerWrites'
import type { OwnedTable } from './entities'
import { logIdOf, parseBody } from './entities'
import { opInput, PROPOSAL_SOURCE, unitKind } from './opTables'
import type { OWNABLE_WRITE } from './ownableWrites'
import {
  afterOwnableMove,
  assertMayAddToContainer,
  assertMayWrite,
  createOwnable,
  writeTarget,
} from './ownableWrites'
import { staleWriteError } from './staleWrite'

/**
 * The one write to a unit's body (ADR-063): find the unit, check who may write
 * it, run `applyOp`, and store the op beside the new snapshot. Every body
 * write reaches here, the client's ops and a whole body sent to
 * `upsertByAppId` alike, so the op log is the history.
 */

/** One op against one unit (`ops.apply`). `gameId` names where the author holds it. */
export const UNIT_OP = {
  unit: unitKind,
  gameId: v.union(v.id('games'), v.null()),
  op: opInput,
}

type UnitOpArgs = ObjectType<typeof UNIT_OP>

/**
 * What the author's copy needs back: the snapshot's seq and the row's version,
 * and whether this send applied the op (false when an earlier one had).
 */
export type Applied = { headSeq: number; updatedAt: number; fresh: boolean }

type UnitRow = Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'> | Doc<'crawlers'>

/** The row an op lands on, or null when the unit is gone; refuses a writer who may not write it. */
async function unitRow(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: UnitOpArgs
): Promise<UnitRow | null> {
  if (args.unit === 'crawler') {
    const row = await crawlerByAppId(ctx, args.op.unitId)
    if (row !== null) await assertMayEditCrawler(ctx, row)
    return row
  }
  const table = TABLE_OF_KIND[args.unit] as OwnedTable
  const row = await writeTarget(ctx, userId, { table, appId: args.op.unitId, gameId: args.gameId })
  if (row === null) throw new ConvexError('That entity no longer exists')
  assertMayWrite(row, userId)
  return row
}

/**
 * Apply one op, or answer what an earlier send of it already did.
 *
 * A crawler that has been scrapped takes nothing, as before (`null`). A
 * crawler's op never moves it: `moveCrawler` writes its container, so its
 * `gameId` is dropped here. A pilot, mech or NPC op that changes `gameId`
 * moves the row, answering to the rule a create into that container does.
 */
export async function applyUnitOp(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: UnitOpArgs
): Promise<Applied | null> {
  // A proposal is the Mediator's (`ops.propose`); a player's own op may not pose as one.
  if (args.op.source === PROPOSAL_SOURCE) throw new ConvexError('That change is not a proposal')
  const row = await unitRow(ctx, userId, args)
  return row === null ? null : applyToRow(ctx, userId, args.unit, row, args.op)
}

/**
 * The op `opId` names on one unit, or null. An op id is unique per unit, not
 * across them: a Downtime step's is guessable, so an op another member sent on
 * their own unit under the same id must not stand in for this one.
 */
export async function opOnUnit(
  ctx: QueryCtx,
  opId: string,
  unitId: string
): Promise<Doc<'ops'> | null> {
  return await ctx.db
    .query('ops')
    .withIndex('by_op_id', (q) => q.eq('opId', opId))
    .filter((q) => q.eq(q.field('unitId'), unitId))
    .first()
}

/**
 * `applyUnitOp` for an op an outbox sends after a reconnect (ADR-063): one the
 * server refuses is kept as `declined`, with why, and answered so rather than
 * thrown, so the device drops it and the rest of its outbox still goes.
 */
export async function replayUnitOp(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: UnitOpArgs
): Promise<Applied | null | { declined: string }> {
  try {
    return await applyUnitOp(ctx, userId, args)
  } catch (err) {
    const reason = refusalOf(err)
    if ((await opOnUnit(ctx, args.op.id, args.op.unitId)) === null) {
      await ctx.db.insert('ops', {
        gameId: args.gameId,
        unitKind: args.unit,
        unitId: args.op.unitId,
        opId: args.op.id,
        seq: null,
        baseSeq: args.op.baseSeq,
        author: userId,
        at: args.op.at,
        kind: args.op.kind,
        source: args.op.source,
        state: 'declined',
        patch: args.op.patch,
        ...(args.op.unset === undefined ? {} : { unset: args.op.unset }),
        before: null,
        reason,
      })
    }
    return { declined: reason }
  }
}

/** A refusal's words: a stale write's `ConvexError` carries the row beside them. */
function refusalOf(err: unknown): string {
  if (err instanceof ConvexError) {
    const data: unknown = err.data
    if (typeof data === 'string') return data
    if (typeof data === 'object' && data !== null && 'message' in data) return String(data.message)
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * `applyUnitOp` on a row already found and checked. `proposal` is the
 * proposed op row being accepted, which becomes the applied op.
 */
export async function applyToRow(
  ctx: MutationCtx,
  userId: Id<'users'>,
  kind: EntityKind,
  row: UnitRow,
  input: OpInput,
  proposal?: Id<'ops'>
): Promise<Applied> {
  const unchanged = { headSeq: row.headSeq ?? 0, updatedAt: row.updatedAt, fresh: false }
  const seen = await opOnUnit(ctx, input.id, logIdOf(row))
  if (seen !== null && seen._id !== proposal) return unchanged

  const op = kind === 'crawler' ? withoutContainer(input) : input
  if (isEmptyOp(op) && !isDowntimeStepOp(op.id)) return unchanged

  const unit = unitOf(
    kind,
    { ...(row.body as Record<string, unknown>), gameId: row.gameId },
    row.headSeq ?? 0,
    row.fieldSeqs ?? {}
  )
  const result = applyOp(unit, op)
  if (!result.ok) {
    if (result.reason === 'conflict') throw staleWriteError(row)
    throw new Error(`Invalid ${TABLE_OF_KIND[kind]} payload: ${result.message}`)
  }

  const gameId = (result.unit.body.gameId ?? null) as Id<'games'> | null
  const moved = kind !== 'crawler' && gameId !== row.gameId
  if (moved) await assertMayAddToContainer(ctx, gameId, userId)

  const updatedAt = Date.now()
  await ctx.db.patch(row._id, {
    ...(moved ? { gameId } : {}),
    body: result.unit.body,
    headSeq: result.seq,
    fieldSeqs: result.unit.fieldSeqs,
    updatedAt,
  })
  const applied = { seq: result.seq, at: op.at, state: 'applied' as const, before: result.before }
  if (proposal !== undefined) await ctx.db.patch(proposal, applied)
  else {
    await ctx.db.insert('ops', {
      ...applied,
      gameId,
      unitKind: kind,
      unitId: logIdOf(row),
      opId: op.id,
      baseSeq: op.baseSeq,
      author: userId,
      kind: op.kind,
      source: op.source,
      patch: op.patch,
      ...(op.unset === undefined ? {} : { unset: op.unset }),
    })
  }
  if (moved) {
    const table = TABLE_OF_KIND[kind] as OwnedTable
    await afterOwnableMove(ctx, table, row._id as Id<OwnedTable>, row.gameId)
  }
  return { headSeq: result.seq, updatedAt, fresh: true }
}

/** A crawler op without its container: only `moveCrawler` moves a crawler. */
function withoutContainer(op: OpInput): OpInput {
  const { gameId: _container, ...patch } = op.patch as Record<string, unknown>
  const unset = op.unset?.filter((field) => field !== 'gameId')
  return { ...op, patch, ...(unset === undefined ? {} : { unset }) }
}

/** An op the server authors for a write that still arrives as a body or a patch. */
function serverOp(unitId: string, patch: Record<string, unknown>, unset: string[]): OpInput {
  return {
    id: crypto.randomUUID(),
    unitId,
    baseSeq: null,
    at: Date.now(),
    kind: 'manual',
    source: 'sheet',
    patch,
    ...(unset.length === 0 ? {} : { unset }),
  }
}

/**
 * `upsertByAppId`: a whole body. A row the writer does not have yet is
 * created; any other is changed by the op that takes its body to this one.
 * The body is refused when the row has moved past the copy it was made from
 * (`expectedUpdatedAt`), as a whole body would undo what reached it since.
 */
export async function writeOwnable(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: ObjectType<typeof OWNABLE_WRITE>
): Promise<{ updatedAt: number }> {
  const existing = await writeTarget(ctx, userId, args)
  if (existing === null) return createOwnable(ctx, userId, args)

  assertMayWrite(existing, userId)
  // After the ownership check, so the refusal hands the row only to its owner.
  if (args.expectedUpdatedAt !== null && existing.updatedAt > args.expectedUpdatedAt) {
    throw staleWriteError(existing)
  }
  const body = parseBody(args.table, args.body) as Record<string, unknown>
  const { patch, unset } = diffBodies(
    { ...(existing.body as Record<string, unknown>), gameId: existing.gameId },
    { ...body, gameId: args.gameId }
  )
  const op = serverOp(logIdOf(existing), patch, unset)
  const { updatedAt } = await applyToRow(ctx, userId, kindOfTable(args.table), existing, op)
  return { updatedAt }
}

/** A transfer's crawler patch may move it first (`moveCrawler`), in the same mutation. */
export async function moveThenApply(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: UnitOpArgs & { move?: Id<'games'> | null }
): Promise<Applied | null> {
  if (args.unit === 'crawler' && args.move !== undefined) {
    await moveCrawlerRow(ctx, userId, args.op.unitId, args.move)
  }
  const { move: _move, ...unitOp } = args
  return applyUnitOp(ctx, userId, unitOp)
}

function kindOfTable(table: OwnedTable): Exclude<EntityKind, 'crawler'> {
  return table === 'pilots' ? 'pilot' : table === 'mechs' ? 'mech' : 'npc'
}

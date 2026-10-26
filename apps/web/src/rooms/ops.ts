import type { Op as DomainOp, OpInput, OpResult, Unit } from 'game-domain/ops/applyOp'
import type { OpState as DomainOpState } from 'game-domain/ops/opState'
import type { ChangeLogKind } from 'game-domain/schemas/changeLog'

/**
 * ADR-063's op contract, as the rooms take it. `applyOp` itself is
 * `game-domain/ops/applyOp`; a room is handed it rather than importing
 * it, so a room's tests can pin its answer and the room never decides a
 * merge on its own.
 */

export type { OpInput, Unit }

/** A room keeps no superseded op: a newer proposal declines the one it replaces. */
export type OpState = Exclude<DomainOpState, 'superseded'>

/** An op as a room stores it. */
export type Op = Omit<DomainOp, 'state'> & { state: OpState }

export type ApplyOp = (unit: Unit, op: OpInput) => OpResult

/** One field's change as the Change Log drawer reads it (`changeLog.forEntity`). */
export type EntityLogRow = {
  _id: string
  ts: number
  kind: ChangeLogKind
  field: string
  before: unknown
  after: unknown
  source: string
  state: 'applied' | 'proposed'
}

/** The most rows the drawer reads: its newest page. */
const ENTITY_LOG_ROWS = 100

/** Fields an op writes that are bookkeeping, not history a player reads. */
const UNLOGGED: ReadonlySet<string> = new Set(['updatedAt'])

/**
 * A unit's Change Log from its ops, newest first, one row per field: applied
 * and proposed only, since a declined proposal is not the unit's history.
 */
export function entityLog(ops: readonly Op[]): EntityLogRow[] {
  return ops
    .flatMap((op) => {
      if (op.state === 'declined') return []
      const state = op.state
      return [...Object.keys(op.patch), ...(op.unset ?? [])]
        .filter((field) => !UNLOGGED.has(field))
        .map((field) => ({
          _id: `${op.id}:${field}`,
          ts: op.at,
          kind: op.kind,
          field,
          before: op.before?.[field] ?? null,
          after: op.patch[field] ?? null,
          source: op.source,
          state,
        }))
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, ENTITY_LOG_ROWS)
}

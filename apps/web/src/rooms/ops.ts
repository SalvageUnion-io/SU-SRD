import type { EntityKind } from 'game-domain/entityKinds'
import type { ChangeLogKind } from 'game-domain/schemas/changeLog'

/**
 * ADR-063's op contract, as the rooms take it. `applyOp` itself is
 * `game-domain/ops/applyOp`; a room is handed it rather than importing
 * it, so a room's tests can pin its answer and the room never decides a
 * merge on its own.
 */

/** A unit as `applyOp` reads it: its body, head and the seq that last wrote each field. */
export type Unit = {
  kind: EntityKind
  body: Record<string, unknown>
  headSeq: number
  fieldSeqs: Record<string, number>
}

/** What a client sends: an op before the server has applied it. */
export type OpInput = {
  /** Minted by the author's client, stable: sending it twice is a no-op. */
  id: string
  unitId: string
  /** The `headSeq` of the copy the author edited; null when it holds none. */
  baseSeq: number | null
  at: number
  kind: ChangeLogKind
  source: string
  patch: Record<string, unknown>
  unset?: string[]
}

export type OpState = 'applied' | 'proposed' | 'declined'

/** An op as a room stores it. */
export type Op = OpInput & {
  author: string
  state: OpState
  seq: number | null
  before: Record<string, unknown> | null
  reason?: string
}

type OpResult =
  | { ok: true; unit: Unit; seq: number; before: Record<string, unknown> }
  | { ok: false; reason: 'conflict'; fields: string[] }
  | { ok: false; reason: 'invalid'; message: string }

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

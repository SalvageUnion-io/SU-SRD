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

/**
 * Ops, the only way a unit's body changes (ADR-063).
 *
 * Platform-neutral on purpose: the client runs `applyOp` to show a result at
 * once, the server of record runs it to decide, and the server's answer wins.
 * It reads nothing but its arguments.
 */

import type { EntityKind } from '../entityKinds'
import type { ChangeLogKind } from '../schemas/changeLog'
import { CrawlerSchema } from '../schemas/crawler'
import { MechSchema } from '../schemas/mech'
import { NpcSchema } from '../schemas/npc'
import { PilotSchema } from '../schemas/pilot'
import type { OpState } from './opState'

/** A body field and its new value; a field named in `unset` is removed instead. */
export type OpPatch = Record<string, unknown>

/** What an author sends: the change and the copy it was made against. */
export type OpInput = {
  /** Minted by the author's client; the server applies one id once. */
  id: string
  /** The unit's app id. */
  unitId: string
  /** The `headSeq` of the copy the author edited; `null` when it held none. */
  baseSeq: number | null
  /** When it was authored, epoch ms. */
  at: number
  kind: ChangeLogKind
  /** The surface it came from (`surfaceProvenance.ts`). */
  source: string
  patch: OpPatch
  unset?: string[]
}

/**
 * An op as the server stores it; a room stores the same.
 * @public
 */
export type Op = OpInput & {
  /** The account that wrote it. */
  author: string
  state: OpState
  /** The unit's sequence number once applied; `null` while proposed or declined. */
  seq: number | null
  /** What the written fields held, filled in when applied. */
  before: Record<string, unknown> | null
  /** The Mediator's words, on a proposal. */
  reason?: string
}

/** A unit as the server holds it: its body, the last op folded in, and when each field last changed. */
export type Unit = {
  kind: EntityKind
  body: Record<string, unknown>
  headSeq: number
  /** The `seq` of the op that last wrote each field; a field never written by an op is absent. */
  fieldSeqs: Record<string, number>
}

/** Why an op was not applied. */
type OpRefusal = { reason: 'conflict'; fields: string[] } | { reason: 'invalid'; message: string }

export type OpResult =
  | {
      ok: true
      unit: Unit
      seq: number
      /** The values the patched and unset fields held; a field the body lacked is absent. */
      before: Record<string, unknown>
    }
  | ({ ok: false } & OpRefusal)

/** The schema each unit kind's body parses with. */
const SCHEMAS = {
  pilot: PilotSchema,
  mech: MechSchema,
  crawler: CrawlerSchema,
  npc: NpcSchema,
} as const satisfies Record<EntityKind, unknown>

/** Fields that only bookkeep: they change on every write, so they never conflict. */
const BOOKKEEPING: ReadonlySet<string> = new Set(['updatedAt'])

/** A unit with no op history: an existing body is its unit's snapshot at seq 0. */
export function unitOf(
  kind: EntityKind,
  body: Record<string, unknown>,
  headSeq = 0,
  fieldSeqs: Record<string, number> = {}
): Unit {
  return { kind, body, headSeq, fieldSeqs }
}

/**
 * Apply one op to a unit: merge its patch, drop its `unset` fields, and parse
 * the result with the kind's schema.
 *
 * Refused, with nothing changed, when a field it writes was written by an op
 * after the copy it was made against (`baseSeq`), or when the result does not
 * parse. A field nobody else wrote merges, whatever else moved. Game rules are
 * not here: the surface checks them before it authors the op (ADR-021).
 */
export function applyOp(unit: Unit, op: OpInput): OpResult {
  const unset = op.unset ?? []
  const written = [...Object.keys(op.patch), ...unset]
  if (written.includes('id'))
    return { ok: false, reason: 'invalid', message: 'An op cannot change a unit’s id' }

  // Only a field the schema defines can be unset, so an op cannot strip an arbitrary key.
  const shape = (SCHEMAS[unit.kind] as { shape?: Record<string, unknown> }).shape
  const unknown = unset.find((field) => shape !== undefined && !Object.hasOwn(shape, field))
  if (unknown !== undefined) {
    return { ok: false, reason: 'invalid', message: `cannot unset unknown field "${unknown}"` }
  }

  if (op.baseSeq !== null) {
    const baseSeq = op.baseSeq
    const fields = written.filter(
      (field) => !BOOKKEEPING.has(field) && (unit.fieldSeqs[field] ?? 0) > baseSeq
    )
    if (fields.length > 0) return { ok: false, reason: 'conflict', fields }
  }

  const before: Record<string, unknown> = {}
  for (const field of written) {
    if (Object.hasOwn(unit.body, field)) before[field] = unit.body[field]
  }
  const merged: Record<string, unknown> = { ...unit.body, ...op.patch }
  for (const field of unset) delete merged[field]

  const parsed = SCHEMAS[unit.kind].safeParse(merged)
  if (!parsed.success) {
    return { ok: false, reason: 'invalid', message: parsed.error.issues[0]?.message ?? 'unknown' }
  }

  const seq = unit.headSeq + 1
  const fieldSeqs = { ...unit.fieldSeqs }
  for (const field of written) if (!BOOKKEEPING.has(field)) fieldSeqs[field] = seq
  return {
    ok: true,
    unit: {
      kind: unit.kind,
      body: parsed.data as Record<string, unknown>,
      headSeq: seq,
      fieldSeqs,
    },
    seq,
    before,
  }
}

/** Structural equality via JSON: bodies are Zod-parsed, so key order is stable. */
function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/**
 * The patch and `unset` that take `before` to `after`: every field whose value
 * moved, and every field `after` no longer has. What the client sends, so an
 * op names only what its author changed.
 */
export function diffBodies(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { patch: OpPatch; unset: string[] } {
  const patch: OpPatch = {}
  for (const [field, value] of Object.entries(after)) {
    if (value !== undefined && !sameValue(before[field], value)) patch[field] = value
  }
  const unset = Object.keys(before).filter(
    (field) => before[field] !== undefined && after[field] === undefined
  )
  return { patch, unset }
}

/** Whether an op changes anything a reader would see, the bookkeeping stamp aside. */
export function isEmptyOp(op: Pick<OpInput, 'patch' | 'unset'>): boolean {
  const fields = [...Object.keys(op.patch), ...(op.unset ?? [])]
  return fields.every((field) => BOOKKEEPING.has(field))
}

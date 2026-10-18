import type { GenericValidator, Infer } from 'convex/values'
import { v } from 'convex/values'

/**
 * The validator helpers the schema (`schema.ts`, `model/playTables.ts`) and the
 * function modules build their validators with: see `schema.ts`'s header for
 * why a closed set is a union and why a written-out validator is mirrored.
 */

/** A `v.union` of literals built from a Zod enum's own list. */
export function literalUnion<const T extends string>(values: readonly T[]) {
  return v.union(...values.map((value) => v.literal(value)))
}

/**
 * True only when `A` and `B` are the same type, optional fields and all: mutual
 * assignability would let either side grow an optional field unnoticed.
 */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/**
 * Hands `validator` back unchanged, and fails to compile when what it accepts
 * is not exactly `Z`, the type it mirrors. Curried so `Z` is named and the
 * validator's own type is inferred. Exported for a `returns` validator that
 * mirrors a domain type with no Zod schema to build it from (`crew.vitals`).
 */
export function mirrors<Z>() {
  return <V extends GenericValidator>(
    validator: V,
    ..._exact: Same<Infer<V>, Z> extends true
      ? []
      : ['this validator has drifted from its Zod type']
  ): V => validator
}

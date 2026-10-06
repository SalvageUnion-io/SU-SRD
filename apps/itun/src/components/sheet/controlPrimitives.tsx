/**
 * controlPrimitives — the freshest-record read for a sheet control, and the
 * no-op filter its writes use.
 *
 * This also held AdvisoryBox/AdvisoryText, the local warn-advisory boxes. Those
 * are gone: the single-message advisory is now the shared `FieldError` atom, and
 * AdvisoryBox turned out to have no call sites at all outside AdvisoryText.
 *
 * These are layout/state primitives only — no rules math lives here (that
 * stays in lib/rules per ADR-006) and nothing mutates the store.
 */

import type { EntityForType, EntityType } from '../../stores/types'

/**
 * The freshest record for a control action: rapid actions (or another tab's
 * write landing between renders) must not stomp each other, so handlers
 * re-read from the store and fall back to the render prop.
 */
type FreshEntityLookup = {
  get: <T extends EntityType>(type: T, id: string) => EntityForType<T> | null
}

export function freshEntity<T extends EntityType>(
  storeState: FreshEntityLookup,
  type: T,
  fallback: EntityForType<T>
): EntityForType<T> {
  return storeState.get(type, fallback.id) ?? fallback
}

/**
 * The subset of `fields` that would change `current`, or null when none would.
 *
 * For the cap-override writes, where an unchanged commit is routine: the gauge
 * reports every committed max (so a player can type the derived value back in
 * to delete a pin), and re-committing the number already shown must not write,
 * or every glance at the editor would land a Change Log entry.
 */
export function changedFields<T extends object>(current: T, fields: Partial<T>): Partial<T> | null {
  const changed: Partial<T> = {}
  let any = false
  for (const key of Object.keys(fields) as (keyof T)[]) {
    if (Object.is(current[key], fields[key])) continue
    changed[key] = fields[key]
    any = true
  }
  return any ? changed : null
}

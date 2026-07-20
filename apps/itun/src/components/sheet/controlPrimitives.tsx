/**
 * controlPrimitives — the freshest-record read for a sheet control.
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

// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function freshEntity<T extends EntityType>(
  storeState: FreshEntityLookup,
  type: T,
  fallback: EntityForType<T>
): EntityForType<T> {
  return storeState.get(type, fallback.id) ?? fallback
}

/**
 * useSoftWarnings — wraps an entityStore.update call with before/after
 * snapshotting and soft-warning evaluation.
 *
 * Wired into the Live Sheet's BUILD edits (PilotSheet ability add/remove and
 * class change, MechSheet system removal). Play-state writes (HP/AP/EP/heat,
 * the Dashboard bands) deliberately bypass it — those are transient combat
 * state, not the build the rules evaluate.
 *
 * Design notes:
 * - Preview patch is held in a ref (not state) so a caller can `preview()` and
 *   `saveAnyway()` in the SAME event tick — the common "no warnings, just
 *   save" path. `warnings` stays in state because it renders.
 * - preview() RETURNS the computed warnings so the caller can branch
 *   synchronously without waiting for a re-render.
 * - saveAnyway() persists the previewed patch regardless of warnings.
 * - fixIt() discards the preview without calling store.update.
 * - Dep-injection (evaluate, store) makes the hook unit-testable without
 *   module mocking (NO mock.module() in tests).
 */

import { useRef, useState } from 'react'
import { evaluateSoftWarnings as defaultEvaluate } from 'salvageunion-reference/rules'
import type {
  MechSnapshot,
  PilotSnapshot,
  SoftWarning,
  SoftWarningContext,
} from '../../lib/rules/types'
import type { ChangeMeta } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import type { AssignableType, EntityForType } from '../../stores/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

type UseSoftWarningsOptions<T extends AssignableType> = {
  entityType: T
  entityId: string
  /**
   * Project a stored entity onto the minimal snapshot the rules evaluate.
   *
   * REQUIRED, and the type says so: `Pilot.abilities` and `Mech.systems` are
   * `string[]` of slugs, while `PilotSnapshot.abilities` /
   * `MechSnapshot.systems` are structs (`{ ref, tree, level, tier }` /
   * `{ ref, requires }`). The optional version of this prop stood in for a
   * `as unknown as PilotSnapshot | MechSnapshot` fallback whose failure mode
   * was the tier/tree-driven checks seeing undefined fields and the warning
   * dialog silently never appearing — no error, no warning, nothing.
   *
   * Pilot sites pass `enrichPilotSnapshot`; mech sites map slugs to `{ ref }`.
   */
  toSnapshot: (entity: EntityForType<T>) => PilotSnapshot | MechSnapshot
  /**
   * Change Log provenance (ADR-022) forwarded as entityStore.update's 4th
   * argument.
   *
   * Optional here but no longer *untagged* when omitted: the store requires a
   * tag, and the only surfaces that mount this hook are the two Live Sheets, so
   * the fallback is their tag rather than the old `manual` / `unknown`.
   */
  meta?: ChangeMeta
  /**
   * Injectable evaluator — defaults to evaluateSoftWarnings from rules.
   * Pass a stub in tests to avoid touching the rules module.
   */
  evaluate?: typeof defaultEvaluate
  /**
   * Injectable store hook — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand/IndexedDB side effects.
   */
  store?: typeof useEntityStore
}

type UseSoftWarningsResult<T extends AssignableType> = {
  warnings: SoftWarning[]
  /**
   * Compute a preview of the given patch against the current entity state.
   * Updates `warnings` and returns them. Does NOT persist anything.
   */
  preview: (
    patch: Partial<EntityForType<T>>,
    context?: Partial<SoftWarningContext>
  ) => SoftWarning[]
  /**
   * Persist the previewed patch to the store (warnings are advisory — they do
   * not block the save). Resolves with the updated entity.
   * Rejects if the store has no entity with `entityId` at call time.
   */
  saveAnyway: () => Promise<EntityForType<T>>
  /**
   * Discard the preview patch. Warnings are cleared. No store.update call.
   */
  fixIt: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSoftWarnings<T extends AssignableType>(
  opts: UseSoftWarningsOptions<T>
): UseSoftWarningsResult<T> {
  const {
    entityType,
    entityId,
    toSnapshot,
    meta = LIVE_SHEET_MANUAL,
    evaluate = defaultEvaluate,
    store = useEntityStore,
  } = opts

  const storeState = store()

  const [warnings, setWarnings] = useState<SoftWarning[]>([])
  // A ref, not state: preview() and saveAnyway() routinely run in the same
  // event tick (the "clean edit saves immediately" path), and a setState would
  // not be visible until the next render.
  const pendingPatch = useRef<Partial<EntityForType<T>> | null>(null)

  function preview(
    patch: Partial<EntityForType<T>>,
    context?: Partial<SoftWarningContext>
  ): SoftWarning[] {
    const before = storeState.get(entityType, entityId)

    if (!before) {
      // Entity not yet loaded — store patch but can't evaluate warnings yet.
      pendingPatch.current = patch
      setWarnings([])
      return []
    }

    const after: EntityForType<T> = { ...before, ...patch }

    const ctx: SoftWarningContext = {
      entityType,
      ...context,
    }

    const computed = evaluate(toSnapshot(before), toSnapshot(after), ctx)

    setWarnings(computed)
    pendingPatch.current = patch
    return computed
  }

  async function saveAnyway(): Promise<EntityForType<T>> {
    const patch = pendingPatch.current
    if (!patch) {
      throw new Error(
        `useSoftWarnings(${entityType}:${entityId}): saveAnyway() called with no pending patch. Call preview() first.`
      )
    }
    const updated = await storeState.update(entityType, entityId, patch, meta)
    // Clear state after a successful save.
    setWarnings([])
    pendingPatch.current = null
    return updated
  }

  function fixIt(): void {
    setWarnings([])
    pendingPatch.current = null
  }

  return { warnings, preview, saveAnyway, fixIt }
}

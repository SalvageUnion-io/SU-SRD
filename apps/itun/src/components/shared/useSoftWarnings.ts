/**
 * useSoftWarnings — wraps an entityStore.update call with before/after
 * snapshotting and soft-warning evaluation.
 *
 * The hook is intentionally NOT wired into any edit form in Wave 4. Wire-in
 * to mech/pilot/crawler detail views is deferred to Wave 5 polish.
 *
 * Design notes:
 * - Preview patch is held in local React state; calling preview() recomputes
 *   warnings without persisting anything.
 * - saveAnyway() persists the previewed patch regardless of warnings.
 * - fixIt() discards the preview without calling store.update.
 * - Dep-injection (evaluate, store) makes the hook unit-testable without
 *   module mocking (NO mock.module() in tests).
 */

import { useState } from 'react'

import type {
  MechSnapshot,
  PilotSnapshot,
  SoftWarning,
  SoftWarningContext,
} from '../../lib/rules/types'
import { evaluateSoftWarnings as defaultEvaluate } from '../../lib/rules/softWarnings'
import { useEntityStore } from '../../stores/entityStore'
import type { AssignableType, EntityForType } from '../../stores/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

type UseSoftWarningsOptions<T extends AssignableType> = {
  entityType: T
  entityId: string
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
   * Updates `warnings` synchronously. Does NOT persist anything.
   */
  preview: (patch: Partial<EntityForType<T>>, context?: Partial<SoftWarningContext>) => void
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
  const { entityType, entityId, evaluate = defaultEvaluate, store = useEntityStore } = opts

  const storeState = store()

  const [warnings, setWarnings] = useState<SoftWarning[]>([])
  const [pendingPatch, setPendingPatch] = useState<Partial<EntityForType<T>> | null>(null)

  function preview(patch: Partial<EntityForType<T>>, context?: Partial<SoftWarningContext>): void {
    const before = storeState.get(entityType, entityId) as EntityForType<T> | null

    if (!before) {
      // Entity not yet loaded — store patch but can't evaluate warnings yet.
      setPendingPatch(patch)
      setWarnings([])
      return
    }

    const after: EntityForType<T> = { ...before, ...patch }

    const ctx: SoftWarningContext = {
      entityType,
      ...context,
    }

    // evaluateSoftWarnings expects PilotSnapshot | MechSnapshot.
    // The actual Pilot/Mech/Crawler entity shapes are structural supersets of
    // those minimal snapshot types — the cast is safe at runtime.
    const computed = evaluate(
      before as unknown as PilotSnapshot | MechSnapshot,
      after as unknown as PilotSnapshot | MechSnapshot,
      ctx
    )

    setWarnings(computed)
    setPendingPatch(patch)
  }

  async function saveAnyway(): Promise<EntityForType<T>> {
    if (!pendingPatch) {
      throw new Error(
        `useSoftWarnings(${entityType}:${entityId}): saveAnyway() called with no pending patch. Call preview() first.`
      )
    }
    const updated = await storeState.update(entityType, entityId, pendingPatch)
    // Clear state after a successful save.
    setWarnings([])
    setPendingPatch(null)
    return updated as EntityForType<T>
  }

  function fixIt(): void {
    setWarnings([])
    setPendingPatch(null)
  }

  return { warnings, preview, saveAnyway, fixIt }
}

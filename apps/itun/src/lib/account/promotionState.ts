/**
 * Whether anonymous work is mid-promotion, or failed to promote.
 *
 * This exists because the upload and the prune had to agree. The upload of an
 * anonymous session's builds (`AccountReconciler`, through
 * `lib/account/reconcile.ts`) and `ShelfSync`, which prunes local rows the
 * server did not return, run concurrently — and when they were two unrelated
 * root-mounted components the gap between them destroyed the work:
 *
 *   1. promotion throws — a server refusal, a dropped connection, anything;
 *   2. the promoter reports and stops. Its own comment says "nothing is lost
 *      when this fails — the caches still hold the work";
 *   3. `ShelfSync` runs. For a fresh visitor `legacyLocalDataState()` is
 *      `absent`, so `mayPrune` passes;
 *   4. the un-promoted rows are shelf rows that `listMine` did not return —
 *      because they never reached the server — so they read as "deleted
 *      elsewhere" and are forgotten.
 *
 * The work is then gone from the store, from the UI, and from the export.
 * Step 2's comment was true in isolation and false in the app.
 *
 * A module-scope value rather than React state on purpose: the prune reads it
 * AFTER an await, inside an async loop that no render reaches, so it has to be
 * readable synchronously at that instant. It is deliberately NOT persisted — a reload re-derives it, and a stale
 * `failed` surviving a restart would block pruning forever.
 */

export type PromotionState =
  /** No anonymous work is waiting to be promoted. Absence can be trusted. */
  | 'idle'
  /** A promotion is in flight. Rows may not have reached the server YET. */
  | 'pending'
  /** A promotion threw. Local rows exist that the server does not have. */
  | 'failed'

let state: PromotionState = 'idle'

export function promotionState(): PromotionState {
  return state
}

export function setPromotionState(next: PromotionState): void {
  state = next
}

/**
 * Test-only reset.
 *
 * This module is process-global, so a test that leaves it `'failed'` disables
 * pruning for every file that runs after it in the same Bun process — and the
 * symptom is a pruning test passing for the wrong reason, which is the silent
 * direction. `AccountReconciler.test.tsx` renders the reconciler and calls this
 * in `afterEach`; any other test that mounts it must too. Same hazard, and the
 * same remedy, as `mock.module` in `.claude/rules/testing-patterns.md`.
 */
export function resetPromotionStateForTesting(): void {
  state = 'idle'
}

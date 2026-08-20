/**
 * Whether anonymous work is mid-promotion, or failed to promote.
 *
 * This exists because two root-mounted components had to agree and had no way
 * to. `UnsavedWorkBanner`'s promoter uploads an anonymous session's builds to
 * the account; `ShelfSync` prunes local rows the server did not return. Both
 * mount at the root, neither knew about the other, and the gap between them
 * destroyed the work:
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
 * A module-scope value rather than React state on purpose: the two consumers
 * are siblings, the signal must survive a re-render of either, and threading a
 * context through the root for one boolean would be a larger change than the
 * bug. It is deliberately NOT persisted — a reload re-derives it, and a stale
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

/** Listeners so a consumer can re-evaluate when the state changes. */
const listeners = new Set<() => void>()

export function promotionState(): PromotionState {
  return state
}

export function setPromotionState(next: PromotionState): void {
  if (state === next) return
  state = next
  for (const listener of listeners) listener()
}

/** Subscribe to changes; returns an unsubscribe. */
export function onPromotionStateChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only reset, so one file's failure does not leak into the next. */
export function resetPromotionStateForTesting(): void {
  state = 'idle'
  listeners.clear()
}

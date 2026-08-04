/**
 * The one place a Live-Sheet write's failure is handled.
 *
 * ## Why this exists
 *
 * Sheet handlers write fire-and-forget — `void store.update(...)` — because the
 * UI already reads the store and nothing on screen waits for the round trip.
 * That idiom is fine right up until a write can *legitimately* fail. It can:
 * `entityStore.update` calls `requireWritableBackend()`, which throws
 * `WritesBlockedOffline` whenever the server of record is unreachable
 * (ADR-030 §1). `void` on a rejecting promise is an unhandled rejection — the
 * player taps a stat, nothing happens, nothing is said, and the only record of
 * it is a console line they will never see.
 *
 * So every voided sheet write goes through `runWrite`, which is the reason the
 * refusal is rendered once here rather than re-implemented at ~45 call sites.
 *
 * ## What it does NOT do
 *
 * It does not retry, queue, or roll back. Disconnected is read-only by decision,
 * not by accident, and an outbox would smuggle conflict resolution back in
 * (ADR-030 §1). The write is refused, the player is told, and the state on
 * screen is still the truth.
 */

import { toast } from 'component-lib'
import { WritesBlockedOffline } from '../../stores/entityBackend'

/**
 * Turn a rejected sheet write into something the player can see.
 *
 * A blocked write is expected and gets its own copy — `WritesBlockedOffline`'s
 * message is already written for a human. Anything else is a bug, so it keeps
 * its console trace as well as saying, plainly, that the change did not stick.
 */
export function reportWriteFailure(err: unknown): void {
  if (err instanceof WritesBlockedOffline) {
    toast(err.message)
    return
  }
  console.error('[itun-sheet] write failed', err)
  toast('That change could not be saved.')
}

/**
 * Run a fire-and-forget sheet write with its rejection handled.
 *
 * The synchronous `try` is not belt-and-braces: an injected test store (or any
 * plain function) may throw rather than reject, and a throw here would take out
 * the event handler rather than surfacing as a refusal.
 */
export function runWrite(write: () => Promise<unknown>): void {
  try {
    void write().catch(reportWriteFailure)
  } catch (err) {
    reportWriteFailure(err)
  }
}

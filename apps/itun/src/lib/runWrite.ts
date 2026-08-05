/**
 * The one place a fire-and-forget entity write's failure is handled.
 *
 * ## Why this exists
 *
 * Write handlers across the app fire-and-forget — `void store.update(...)` —
 * because the UI already reads the store and nothing on screen waits for the
 * round trip. That idiom is fine right up until a write can *legitimately*
 * fail. It can: `entityStore.update` calls `requireWritableBackend()`, which
 * throws `WritesBlockedOffline` whenever the server of record is unreachable
 * (ADR-030 §1). `void` on a rejecting promise is an unhandled rejection — the
 * player taps a stat, nothing happens, nothing is said, and the only record of
 * it is a console line they will never see.
 *
 * So every voided write goes through `runWrite`, which is the reason the
 * refusal is rendered once here rather than re-implemented at every call site.
 *
 * ## Why it lives in `lib/` rather than under one feature folder
 *
 * It began as `components/sheet/sheetWrite.ts`, when the Live Sheet was the
 * only surface writing this way. It is not: the Dashboard applies play actions
 * as write-through patches (ADR-021), the encounter tray edits NPCs, and
 * `useEntityChoices` persists selections. All of them can be refused for
 * exactly the same reason, so the handler is app-level rather than sheet-level.
 * `components/sheet/sheetWrite.ts` survives as a re-export shim so the sheet's
 * existing imports keep resolving.
 *
 * ## What it does NOT do
 *
 * It does not retry, queue, or roll back. Disconnected is read-only by decision,
 * not by accident, and an outbox would smuggle conflict resolution back in
 * (ADR-030 §1). The write is refused, the player is told, and the state on
 * screen is still the truth.
 */

import { toast } from 'component-lib'
import { WritesBlockedOffline } from '../stores/entityBackend'

/**
 * Turn a rejected write into something the player can see.
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
  console.error('[itun] write failed', err)
  toast('That change could not be saved.')
}

/**
 * Run a fire-and-forget write with its rejection handled.
 *
 * The synchronous `try` is not belt-and-braces: an injected test store (or any
 * plain function) may throw rather than reject, and a throw here would take out
 * the event handler rather than surfacing as a refusal.
 *
 * `onApplied` runs only if the write actually resolved. It exists because
 * handling the rejection is not, by itself, enough: a handler that fires the
 * write and then states the outcome —
 *
 *     runWrite(() => store.update(mech, VENT_PATCH))
 *     setPrompt({ log: 'Vented — Heat 0, Vulnerable.' })
 *
 * — tells a Disconnected player the vent happened while the refusal toast says
 * it did not. Two contradictory messages is worse than the silence this helper
 * was written to fix, because one of them is a false claim about game state.
 * Passing the readout as `onApplied` keeps the handler synchronous (no
 * `async`/`await` at ~12 call sites) while making the claim conditional on the
 * write it describes.
 */
export function runWrite(write: () => Promise<unknown>, onApplied?: () => void): void {
  try {
    void write().then(
      () => onApplied?.(),
      (err: unknown) => reportWriteFailure(err)
    )
  } catch (err) {
    reportWriteFailure(err)
  }
}

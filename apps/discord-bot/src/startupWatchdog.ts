/**
 * startupWatchdog — the deadline on "started" becoming "connected".
 *
 * A Discord login that never reaches ready is **silent**. `client.login()`
 * neither resolves nor rejects, no `error` event fires, and a Render worker has
 * no HTTP port to health-check, so nothing anywhere notices. The process stays
 * alive, idle and holding the gateway socket, while every slash command in
 * every guild answers "The application did not respond" — Discord's wording for
 * an interaction nobody acknowledged.
 *
 * That is not hypothetical: on 2026-08-03 the worker logged
 * "Starting Salvage Union Discord Bot..." at 11:28 UTC and never logged
 * "Logged in as". It sat that way for over twelve hours, ~90MB resident and
 * ~0% CPU, until a human noticed the bot was answering nothing. Every signal
 * that should have caught it was shaped wrong: Render saw a live process,
 * Sentry saw no exception, and the `discord-bot ready` liveness event that
 * `handleReady` emits is only ever a *presence* — nothing alerts on its
 * absence.
 *
 * So the process asserts its own liveness instead: reach ready inside the
 * budget or exit non-zero and let Render restart the worker. A crash loop is a
 * far better failure than a bot that is up and deaf, because a crash loop is
 * visible.
 */

/**
 * How long startup gets to reach ready before the worker gives up.
 *
 * Sized off the real thing rather than a guess: the last healthy boot went from
 * "Starting" to "Logged in as" in 1.34 seconds, preload included. A minute is
 * ~45x that, so this can only fire on a genuine hang, never on a slow morning
 * for the gateway or a cold Render instance.
 */
export const READY_TIMEOUT_MS = 60_000

export type ReadyWatchdogOptions = {
  /** Defaults to {@link READY_TIMEOUT_MS}. */
  timeoutMs?: number
  /** Invoked once if the deadline passes undisarmed. */
  onExpire: (error: Error) => void
}

/**
 * Arms the startup deadline. Returns a **disarm** function to call from the
 * ready handler; calling it more than once is safe, so a reconnect that
 * re-fires ready can never resurrect an already-cleared timer.
 */
export function armReadyWatchdog({
  timeoutMs = READY_TIMEOUT_MS,
  onExpire,
}: ReadyWatchdogOptions): () => void {
  const timer = setTimeout(() => {
    onExpire(new Error(`Discord login did not reach ready within ${timeoutMs}ms`))
  }, timeoutMs)

  // The watchdog must never be the reason the process is still running. If the
  // event loop empties out the worker should exit (and be restarted) on the
  // spot rather than idling here waiting to announce a hang it no longer has.
  timer.unref?.()

  let disarmed = false
  return () => {
    if (disarmed) return
    disarmed = true
    clearTimeout(timer)
  }
}

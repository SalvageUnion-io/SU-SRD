import { useCallback, useRef, useState, useTransition } from 'react'
import { toast } from '../../components/index'
import { StaleWriteRefused, WritesBlockedOffline } from '../../replica/sync'
import { LinkRefused } from '../links/linkRefused'
import { captureException } from '../observability'
import { serverMessage } from './serverError'

/**
 * The one way a component runs a write it waits on, and the one rule for what
 * a failed write says.
 *
 * A Convex write can fail three ways, and they call for opposite handling:
 *
 * - a **refusal** — a `ConvexError` the backend threw on purpose — carries
 *   words chosen for the player (`serverMessage`);
 * - a **blocked, stale or refused write** — `WritesBlockedOffline`,
 *   `StaleWriteRefused`, `LinkRefused`, thrown by the entity store before or
 *   after the round trip — carries words written for the player too, as does
 *   any error class a call site names in `playerErrors` (a photo the browser
 *   cannot read, a file that is not a backup);
 * - **anything else** is a defect. Its text is never fit to show: a redacted
 *   server error reads `[CONVEX M(fn)] … Server Error`, and a client bug's
 *   message is a developer's. So it gets the caller's own line, and a
 *   report, because catching it is exactly what kept it from reaching the
 *   window's `error` event.
 *
 * `err instanceof Error ? err.message : …` gets all three wrong at once, which
 * is why lint bans it (`packages/gates/biome/noRawErrorMessage.grit`).
 */

/** An error class whose message is written for the player rather than a developer. */
export type PlayerError = abstract new (...args: never[]) => Error

/** The entity store's own player-facing failures, said wherever a write is. */
const STORE_PLAYER_ERRORS: readonly PlayerError[] = [
  WritesBlockedOffline,
  StaleWriteRefused,
  LinkRefused,
]

/**
 * The words a failed write carries for the player: a refusal's, or a
 * player-facing error's; null for a defect, whose text is never shown.
 */
export function playerMessage(
  err: unknown,
  playerErrors: readonly PlayerError[] = []
): string | null {
  const refusal = serverMessage(err)
  if (refusal !== null) return refusal
  const said = [...STORE_PLAYER_ERRORS, ...playerErrors].some((kind) => err instanceof kind)
  return said && err instanceof Error ? err.message : null
}

/**
 * What to tell the player when a write fails. Reports a defect; never shows its
 * text. `playerErrors` names the call site's own player-facing error classes.
 */
export function failureMessage(
  err: unknown,
  fallback: string,
  playerErrors: readonly PlayerError[] = []
): string {
  const said = playerMessage(err, playerErrors)
  if (said !== null) return said
  captureException(err)
  return fallback
}

/**
 * How a run ended: the write's value, or the words its failure was given —
 * already in `error` (or the toast), and handed back for a caller that also
 * reports it elsewhere.
 */
export type ServerActionResult<R> = { ok: true; value: R } | { ok: false; error: string }

export type ServerActionOptions = {
  /** The player's line for a defect. A refusal speaks for itself. */
  failure: string
  /**
   * Say a failure as a toast with this id instead of holding it in `error`,
   * for a control with nowhere on screen to put a line. The id keeps a
   * repeated failure to one toast.
   */
  toastId?: string
  /** Error classes, beyond the store's, whose message is written for the player. */
  playerErrors?: readonly PlayerError[]
}

export type ServerAction<A extends unknown[], R> = {
  /**
   * Run the write. Never rejects: a failure is already in `error` (or the
   * toast) by the time it resolves `ok: false`, so a caller awaits it only to
   * act on success — open what was made, close the dialog.
   */
  run: (...args: A) => Promise<ServerActionResult<R>>
  /** True from the press until the write settles. */
  pending: boolean
  /** The last run's failure, in words fit for the player; cleared by the next run. */
  error: string | null
  /** Forget `error`, as when the form it describes closes. */
  clearError: () => void
}

/**
 * Wrap a write so its pending state, its failure and its report are handled
 * once, rather than by a `useState` pair and a `try`/`catch` at every call site.
 *
 * The write runs as a React 19 Action (`useTransition`), so `pending` is
 * React's own and holds until the write settles. `fn` may be rebuilt every
 * render — the latest one runs — and may throw synchronously as well as reject.
 */
export function useServerAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  { failure, toastId, playerErrors }: ServerActionOptions
): ServerAction<A, R> {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(fn)
  latest.current = fn

  const run = useCallback(
    (...args: A) =>
      new Promise<ServerActionResult<R>>((resolve) => {
        setError(null)
        startTransition(async () => {
          try {
            resolve({ ok: true, value: await latest.current(...args) })
          } catch (err) {
            const message = failureMessage(err, failure, playerErrors)
            if (toastId === undefined) setError(message)
            else toast.error(message, { id: toastId })
            resolve({ ok: false, error: message })
          }
        })
      }),
    [failure, toastId, playerErrors]
  )

  const clearError = useCallback(() => setError(null), [])

  return { run, pending, error, clearError }
}

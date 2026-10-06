/**
 * snapshot/client — the one call left: which entity a retired snapshot names.
 *
 * retrieveSnapshotIdentity — GET /api/snapshots/:id → `{ kind, appId }` or null
 *
 * Snapshots are retired (ADR-036). Nothing publishes, probes or revokes any
 * more; an old `/s/:id` link only needs to know which entity it was taken of,
 * so it can redirect to that entity's live public sheet when there is one.
 *
 * A plain async function with no module-level side effects, so the route loader
 * calls it directly and tests stub `fetch` rather than `mock.module()`.
 */

import { isValidSnapshotId } from './id'
import type { SnapshotIdentity } from './identity'
import { snapshotIdentity } from './identity'

/**
 * Every deadline in this module, in one place, because they are only correct
 * *relative to each other* — see `fetchIdempotentWithRetry`. Exported so the
 * invariant they encode is asserted by a test rather than only by this comment.
 */
export const SNAPSHOT_TIMING = {
  /** Default per-request timeout for snapshot fetches (ms). */
  requestTimeoutMs: 10_000,
  /** A retry is only attempted when the first answer arrived inside this window. */
  retryIfAnsweredWithinMs: 3_000,
  /** Pause before the single retry. */
  retryDelayMs: 400,
  /** Budget for the retry attempt — shorter than a first attempt, deliberately. */
  retryTimeoutMs: 6_000,
} as const

/**
 * fetch with an AbortController timeout so the page can never hang on a
 * stalled connection. Throws an Error tagged `SnapshotTimeoutError` on timeout;
 * other network failures propagate as-is.
 *
 * The timer covers the **response headers** — it is cleared as soon as `fetch`
 * resolves — so reading the body afterwards is not bounded by it. That is fine
 * for a body this size, but it is why the guarantees below are stated about
 * time-to-first-byte and not about wall clock.
 */
async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs: number = SNAPSHOT_TIMING.requestTimeoutMs
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const timeout = new Error(`snapshot request timed out after ${timeoutMs}ms`)
      timeout.name = 'SnapshotTimeoutError'
      throw timeout
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Statuses that mean the *platform* failed, not the handler.
 *
 * The handler chooses its own statuses — a storage outage is a 503 it returns,
 * an unknown id a 404, a wrong method a 405 — so a 502/504 did not come from
 * handler code that ran. It is the platform failing to run or reach the
 * handler. The statuses the handler *does* choose are therefore absent here:
 *
 * - **500** — a real throw the handler caught and reported to Sentry.
 * - **503** — the handler in `handlers.ts` returns this when the store itself
 *   failed. It is a considered answer about a dependency, not a blip, so
 *   retrying 400ms later just asks a store that has already said it is
 *   unavailable the same question twice.
 *
 * **A 502 is not automatically self-clearing, and this retry is not a substitute
 * for looking at one.** A deterministic module-load failure answers 502 on every
 * attempt. What a retry does buy is the genuinely transient half at a bounded
 * cost. Treat a run of 502s in Sentry as an outage to diagnose, not as noise
 * this smooths over.
 *
 * A network-level failure is likewise not retried: this wrapper only inspects
 * `.status` and lets a throw propagate. That keeps a genuinely offline client
 * failing fast, which is the common case behind a `TypeError` here — an actual
 * server that is up but unreachable answers with a status, not a throw.
 */
const TRANSIENT_STATUSES = new Set([502, 504])

/**
 * `fetchWithTimeout`, retried once when the platform answers with a transient
 * status. **Only ever call this for an idempotent request** — a GET is.
 *
 * A single retry, not a backoff loop: the caller is a route loader in front of
 * a waiting person, so the honest ceiling is one extra round trip.
 *
 * **The invariant worth keeping is that retrying can never push time-to-first-
 * byte past what a single attempt was already allowed.** A retry only happens
 * when the first answer arrived within `retryIfAnsweredWithinMs`, so the worst
 * case is 3000 + 400 + 6000 = 9.4s against a 10s single-attempt budget. All four
 * values in `SNAPSHOT_TIMING` are load-bearing to that sum — which is why a test
 * asserts it rather than leaving this paragraph as the only check.
 *
 * If the second attempt fails too, the failure is real and the caller reports it.
 */
async function fetchIdempotentWithRetry(input: string, init?: RequestInit): Promise<Response> {
  const startedAt = Date.now()
  const first = await fetchWithTimeout(input, init)
  if (!TRANSIENT_STATUSES.has(first.status)) return first
  if (Date.now() - startedAt > SNAPSHOT_TIMING.retryIfAnsweredWithinMs) return first

  // Release the failed attempt's stream rather than leaving it open until GC.
  // Deliberately NOT awaited: `fetchWithTimeout` has already cleared its abort
  // timer by the time it returns, so awaiting here would be the one unbounded
  // wait in this module — on the path that only runs when the platform is
  // already misbehaving.
  void first.body?.cancel().catch(() => {
    // A stream that will not cancel is left to GC; the retry does not need it.
  })

  await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_TIMING.retryDelayMs))
  return fetchWithTimeout(input, init, SNAPSHOT_TIMING.retryTimeoutMs)
}

/**
 * Which entity snapshot `id` was taken of, or null when there is none to name.
 *
 * Null covers a 404 (no such snapshot, or one that names no entity) and a 400
 * (an id that cannot exist): both are designed outcomes, and both end at the
 * retired page. The body goes through `snapshotIdentity`, which also accepts the
 * full stored snapshot — the shape this URL used to answer, immutable-cached
 * for a year, and so still what some browsers' HTTP caches hold for it.
 *
 * @throws Error for any other non-OK status, so the caller can report it.
 */
export async function retrieveSnapshotIdentity(id: string): Promise<SnapshotIdentity | null> {
  // A hand-typed or truncated link cannot name a snapshot; no request needed.
  if (!isValidSnapshotId(id)) return null
  const res = await fetchIdempotentWithRetry(`/api/snapshots/${id}`)
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) {
    throw new Error(`retrieve failed: ${res.status}`)
  }
  return snapshotIdentity(await res.json())
}

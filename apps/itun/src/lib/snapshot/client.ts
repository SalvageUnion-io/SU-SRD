/**
 * snapshot/client — typed fetch wrappers for the snapshot endpoints.
 *
 * publishSnapshot      — POST /api/snapshots (returns { id, url })
 * retrieveSnapshot     — GET  /api/snapshots/:id (returns payload or throws)
 * probeSnapshotService — HEAD /api/snapshots (feature-detect, plan S6)
 *
 * Designed for dep-injection in tests: the functions are plain async
 * functions with no module-level side effects, so tests can supply
 * alternate implementations via props without mock.module().
 */

export type SnapshotPayload = Record<string, unknown>

export type PublishResult = {
  /** Short ID of the published snapshot (e.g. "abc123") */
  id: string
  /** URL path for the snapshot share page (e.g. "/s/abc123") */
  url: string
}

export class SnapshotNotFoundError extends Error {
  constructor(public readonly snapshotId: string) {
    super(`Snapshot not found: ${snapshotId}`)
    this.name = 'SnapshotNotFoundError'
  }
}

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
 * fetch with an AbortController timeout so the share UI can never hang on a
 * stalled connection. Throws an Error tagged `SnapshotTimeoutError` on timeout;
 * other network failures propagate as-is.
 *
 * The timer covers the **response headers** — it is cleared as soon as `fetch`
 * resolves — so reading the body afterwards is not bounded by it. That is
 * unchanged behaviour and fine for payloads this size, but it is why the
 * guarantees below are stated about time-to-first-byte and not about wall clock.
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
 * Every snapshot function chooses its own statuses — a Blobs outage is a 503 it
 * returns, an unknown id a 404, a wrong method a 405 — so a 502/504 did not come
 * from handler code that ran. It is Netlify failing to run or reach the
 * function. The statuses the handlers *do* choose are therefore absent here:
 *
 * - **500** — a real throw the handler caught and reported to Sentry.
 * - **503** — `snapshot-{retrieve,publish,delete}.ts` return this when the
 *   Blobs store itself failed. It is a considered answer about a dependency,
 *   not a blip, so retrying 400ms later just asks a store that has already said
 *   it is unavailable the same question twice.
 *
 * **A 502 is not automatically self-clearing, and this retry is not a substitute
 * for looking at one.** Sharing was down for about 24 hours across #788 and
 * #795, from two *stacked* bugs — a misplaced SDK import, then a duplicate zip
 * entry replacing the handler — and both were deterministic module-load
 * failures that no number of retries would have touched. Fixing the first only
 * revealed the second.
 *
 * What a retry does buy is the genuinely transient half — a cold start that
 * missed its window — at a bounded cost. Treat a run of 502s in Sentry as an
 * outage to diagnose, not as noise this smooths over; and note that every local
 * signal stayed green through both of those, because nothing in `bun run check`
 * runs the Functions bundler.
 *
 * A network-level failure is likewise not retried: this wrapper only inspects
 * `.status` and lets a throw propagate. That keeps a genuinely offline client
 * failing fast, which is the common case behind a `TypeError` here — an actual
 * server that is up but unreachable answers with a status, not a throw.
 */
const TRANSIENT_STATUSES = new Set([502, 504])

/**
 * `fetchWithTimeout`, retried once when the platform answers with a transient
 * status.
 *
 * **Only ever call this for an idempotent request.** `publishSnapshot` is a
 * POST that mints a new id per call, so a retry there would leave a second
 * orphaned snapshot behind on every blip; it deliberately does not use this.
 *
 * A single retry, not a backoff loop: every caller is in front of a waiting
 * person — a route loader, a panel that renders "sharing is unavailable", a
 * revoke button — so the honest ceiling is one extra round trip.
 *
 * **The invariant worth keeping is that retrying can never push time-to-first-
 * byte past what a single attempt was already allowed.** A retry only happens
 * when the first answer arrived within `retryIfAnsweredWithinMs`, so the worst
 * case is 3000 + 400 + 6000 = 9.4s against a 10s single-attempt budget, and no
 * surface gains a longer ceiling from this change. All four values in
 * `SNAPSHOT_TIMING` are load-bearing to that sum — which is why a test asserts
 * it rather than leaving this paragraph as the only check.
 *
 * It is a bound on headers, not on wall clock: `fetchWithTimeout` clears its
 * timer once `fetch` resolves, so reading the body is outside it on both the
 * retried and un-retried paths alike.
 *
 * If the second attempt fails too, the failure is real and the caller reports
 * it, which is what keeps `snapshot service unavailable` meaningful in Sentry.
 */
async function fetchIdempotentWithRetry(input: string, init?: RequestInit): Promise<Response> {
  const startedAt = Date.now()
  const first = await fetchWithTimeout(input, init)
  if (!TRANSIENT_STATUSES.has(first.status)) return first
  if (Date.now() - startedAt > SNAPSHOT_TIMING.retryIfAnsweredWithinMs) return first

  // Release the failed attempt's stream rather than leaving it open until GC.
  // Deliberately NOT awaited: `fetchWithTimeout` has already cleared its abort
  // timer by the time it returns, so awaiting here would be the one unbounded
  // wait in this module — and it would sit on the path that only runs when the
  // platform is already misbehaving, undoing the "the share UI can never hang"
  // property the timeout exists for.
  void first.body?.cancel().catch(() => {})

  await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_TIMING.retryDelayMs))
  return fetchWithTimeout(input, init, SNAPSHOT_TIMING.retryTimeoutMs)
}

/**
 * Publishes a snapshot payload to the backend.
 *
 * @throws Error if the server returns a non-OK status.
 * @returns PublishResult with the snapshot id and share URL path.
 */
export async function publishSnapshot(payload: SnapshotPayload): Promise<PublishResult> {
  const res = await fetchWithTimeout('/api/snapshots', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`publish failed: ${res.status}`)
  }
  return res.json() as Promise<PublishResult>
}

/**
 * Feature-detects the snapshot backend (S6): HEAD /api/snapshots.
 *
 * The publish function answers 405 to every non-POST method, so a reachable
 * backend yields exactly 405 (or 204 if HEAD support is ever added). Anything
 * else — 404 (no function deployed), a 200 SPA-fallback HTML page, a dev-proxy
 * 5xx, or a network error — means publishing is unavailable.
 *
 * A transient 502/504 is retried once before that verdict, because this probe's
 * verdict is load-bearing twice over: it hides the share affordance, and it
 * reports `snapshot service unavailable` to Sentry. One cold start should do
 * neither.
 *
 * It also now carries the same timeout as every other call here — a bare
 * `fetch` could leave the panel in `checking` forever, which is the one outcome
 * a feature-detect must never produce.
 *
 * Never throws; resolves false on any failure.
 */
export async function probeSnapshotService(): Promise<boolean> {
  try {
    const res = await fetchIdempotentWithRetry('/api/snapshots', { method: 'HEAD' })
    return res.status === 405 || res.status === 204
  } catch {
    return false
  }
}

/**
 * Retrieves a snapshot payload from the backend by ID.
 *
 * A shared link is the one surface here with no second chance — the viewer has
 * no account, no local copy and no reason to suspect a reload would help — so a
 * transient 502/504 is retried once before it becomes a broken link.
 *
 * @throws SnapshotNotFoundError if the server returns 404.
 * @throws Error for other non-OK statuses.
 */
export async function retrieveSnapshot(id: string): Promise<SnapshotPayload> {
  const res = await fetchIdempotentWithRetry(`/api/snapshots/${id}`)
  if (res.status === 404) {
    throw new SnapshotNotFoundError(id)
  }
  if (!res.ok) {
    throw new Error(`retrieve failed: ${res.status}`)
  }
  return res.json() as Promise<SnapshotPayload>
}

/**
 * Deletes (un-publishes / revokes) a snapshot by ID.
 *
 * The delete is idempotent server-side, so a 404 is treated as success — the
 * snapshot is gone either way, which is all the caller wanted. That same
 * idempotence is why it is safe to retry a transient 502/504, and revoke is the
 * operation where a false failure costs the most: the person is told their
 * share link is still live when it may well be gone.
 *
 * @throws Error for non-OK statuses other than 404.
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const res = await fetchIdempotentWithRetry(`/api/snapshots/${id}`, { method: 'DELETE' })
  if (res.ok || res.status === 404) {
    return
  }
  throw new Error(`delete failed: ${res.status}`)
}

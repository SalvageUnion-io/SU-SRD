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

/** Default per-request timeout for snapshot fetches (ms). */
const REQUEST_TIMEOUT_MS = 10_000

/**
 * fetch with an AbortController timeout so the share UI can never hang on a
 * stalled connection. Throws an Error tagged `SnapshotTimeoutError` on timeout;
 * other network failures propagate as-is.
 */
async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const timeout = new Error(`snapshot request timed out after ${REQUEST_TIMEOUT_MS}ms`)
      timeout.name = 'SnapshotTimeoutError'
      throw timeout
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
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
 * Never throws; resolves false on any failure.
 */
export async function probeSnapshotService(): Promise<boolean> {
  try {
    const res = await fetch('/api/snapshots', { method: 'HEAD' })
    return res.status === 405 || res.status === 204
  } catch {
    return false
  }
}

/**
 * Retrieves a snapshot payload from the backend by ID.
 *
 * @throws SnapshotNotFoundError if the server returns 404.
 * @throws Error for other non-OK statuses.
 */
export async function retrieveSnapshot(id: string): Promise<SnapshotPayload> {
  const res = await fetchWithTimeout(`/api/snapshots/${id}`)
  if (res.status === 404) {
    throw new SnapshotNotFoundError(id)
  }
  if (!res.ok) {
    throw new Error(`retrieve failed: ${res.status}`)
  }
  return res.json() as Promise<SnapshotPayload>
}

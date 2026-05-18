/**
 * snapshot/client — typed fetch wrappers for the snapshot endpoints.
 *
 * publishSnapshot  — POST /api/snapshots (returns { id, url })
 * retrieveSnapshot — GET  /api/snapshots/:id (returns payload or throws)
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
 * Publishes a snapshot payload to the backend.
 *
 * @throws Error if the server returns a non-OK status.
 * @returns PublishResult with the snapshot id and share URL path.
 */
export async function publishSnapshot(payload: SnapshotPayload): Promise<PublishResult> {
  const res = await fetch('/api/snapshots', {
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
 * Retrieves a snapshot payload from the backend by ID.
 *
 * @throws SnapshotNotFoundError if the server returns 404.
 * @throws Error for other non-OK statuses.
 */
export async function retrieveSnapshot(id: string): Promise<SnapshotPayload> {
  const res = await fetch(`/api/snapshots/${id}`)
  if (res.status === 404) {
    throw new SnapshotNotFoundError(id)
  }
  if (!res.ok) {
    throw new Error(`retrieve failed: ${res.status}`)
  }
  return res.json() as Promise<SnapshotPayload>
}

/**
 * The one snapshot handler left: which entity a snapshot was taken of.
 *
 * Snapshots are retired (ADR-036). Publish (`POST /api/snapshots`) and revoke
 * (`DELETE /api/snapshots/:id`) are gone, and so is serving the frozen copy:
 * `GET /api/snapshots/:id` now answers only `{ kind, appId }`, which is what
 * `/s/:id` needs to redirect to the entity's live public sheet when it has
 * one. The rest of the stored blob — the build as it was — never leaves the
 * bucket again.
 *
 * A factory over an injected `SnapshotStorage`, which is what lets the tests
 * drive every branch without an R2 binding; `src/worker/index.ts` wires it to R2.
 */

import { isValidSnapshotId } from './id'
import { snapshotIdentity } from './identity'
import { reportSnapshotError } from './report'
import type { SnapshotStorage } from './storage'

/** The last path segment — the snapshot id. */
function idFromPath(req: Request): string | undefined {
  const url = new URL(req.url)
  return url.pathname.split('/').filter(Boolean).at(-1)
}

export function makeIdentityHandler(storage: SnapshotStorage) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'GET') {
      // DELETE used to revoke here. Nothing writes to the store any more.
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } })
    }

    const id = idFromPath(req)
    // A valid id is always 8 Crockford-base32 chars, so anything else cannot
    // exist — rejected before touching storage (CWE-20).
    if (!id || !isValidSnapshotId(id)) {
      return new Response('Invalid snapshot ID', { status: 400 })
    }

    let stored: unknown
    try {
      stored = await storage.get(id)
    } catch (error) {
      reportSnapshotError(error, { fn: 'snapshot-identity', op: 'storage.get', id })
      return new Response('Snapshot storage unavailable', { status: 503 })
    }

    // A missing object and one that names no entity are the same answer: either
    // way there is nothing for the link to resolve to.
    const identity = stored === null ? null : snapshotIdentity(stored)
    if (identity === null) {
      return new Response('Snapshot not found', { status: 404 })
    }

    return Response.json(identity, {
      status: 200,
      // A stored snapshot never changes, so neither does the entity it names.
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    })
  }
}

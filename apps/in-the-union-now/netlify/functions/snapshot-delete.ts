/**
 * snapshot-delete — DELETE /api/snapshots/:id
 *
 * Removes (un-publishes / revokes) a snapshot blob by id and returns 204.
 * The app is local-first with no auth, so the snapshot id IS the capability:
 * anyone holding the id may revoke it, which is exactly the publisher (they
 * tracked it locally when they published — see lib/snapshot/publishedSnapshots).
 *
 * Idempotent: deleting a missing/already-revoked id still returns 204.
 * GET / POST / PATCH / PUT return 405.
 *
 * Per-IP rate limit: 10 requests/minute (in-memory, per-instance) — mirrors
 * snapshot-publish. No CORS headers: same-origin app under CSP `connect-src
 * 'self'`, matching the publish/retrieve siblings.
 *
 * See ADR-004-snapshot-netlify-functions.md for full rationale.
 */

import { isValidSnapshotId } from '../../src/lib/snapshot/id'
import { RateLimiter, getClientIp } from '../../src/lib/snapshot/rateLimit'
import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storage'
import type { SnapshotStorage } from '../../src/lib/snapshot/storage'
import { captureException, initObservability } from './_observability'

// ---------------------------------------------------------------------------
// Module-level rate limiter — persists across invocations within one instance
// ---------------------------------------------------------------------------
const rateLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 })

// ---------------------------------------------------------------------------
// Handler factory — accepts injected storage for testability
// ---------------------------------------------------------------------------

export function makeDeleteHandler(storage: SnapshotStorage) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'DELETE') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Rate limiting
    const ip = getClientIp(req)
    if (!rateLimiter.check(ip)) {
      return new Response('Too many requests', { status: 429 })
    }

    // Extract the ID from the URL path — shape: /api/snapshots/<id>
    const url = new URL(req.url)
    const segments = url.pathname.split('/').filter(Boolean)
    const id = segments.at(-1)

    if (!id) {
      return new Response('Missing snapshot ID', { status: 400 })
    }

    // Reject malformed IDs before touching the blob store (input validation,
    // CWE-20) — a well-formed id is always 8 Crockford-base32 chars.
    if (!isValidSnapshotId(id)) {
      return new Response('Invalid snapshot ID', { status: 400 })
    }

    // A Blobs outage must surface as a controlled 503, not an unhandled 500.
    try {
      await storage.delete(id)
    } catch (error) {
      captureException(error, { fn: 'snapshot-delete', op: 'storage.delete', id })
      return new Response('Snapshot storage unavailable', { status: 503 })
    }

    // Idempotent: whether or not the id existed, it is gone now.
    return new Response(null, { status: 204 })
  }
}

// ---------------------------------------------------------------------------
// Default Netlify Function export — uses the production Blobs storage
// ---------------------------------------------------------------------------

export default async function (req: Request): Promise<Response> {
  initObservability()
  try {
    const storage = await createNetlifyBlobsStorage()
    return await makeDeleteHandler(storage)(req)
  } catch (error) {
    captureException(error, { fn: 'snapshot-delete' })
    return new Response('Internal Server Error', { status: 500 })
  }
}

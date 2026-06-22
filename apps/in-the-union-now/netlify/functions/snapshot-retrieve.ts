/**
 * snapshot-retrieve — GET /api/snapshots/:id
 *
 * Returns the stored JSON snapshot payload for the given ID.
 * 404 for unknown IDs. PATCH / PUT / DELETE / POST return 405.
 *
 * The :id segment is extracted from the URL path (Netlify Functions receive
 * the full request URL; routing is configured in netlify.toml).
 *
 * See ADR-004-snapshot-netlify-functions.md for full rationale.
 */

import { isValidSnapshotId } from '../../src/lib/snapshot/id'
import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storage'
import type { SnapshotStorage } from '../../src/lib/snapshot/storage'
import { captureException, initObservability } from './_observability'

// ---------------------------------------------------------------------------
// Handler factory — accepts injected storage for testability
// ---------------------------------------------------------------------------

export function makeRetrieveHandler(storage: SnapshotStorage) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Extract the ID from the URL path.
    // Expected path shape: /api/snapshots/<id>
    const url = new URL(req.url)
    const segments = url.pathname.split('/').filter(Boolean)
    const id = segments.at(-1)

    if (!id) {
      return new Response('Missing snapshot ID', { status: 400 })
    }

    // Reject malformed IDs before touching the blob store. A valid snapshot ID
    // is always 8 Crockford-base32 chars; anything else cannot exist and skips
    // a pointless store lookup (input validation, CWE-20).
    if (!isValidSnapshotId(id)) {
      return new Response('Invalid snapshot ID', { status: 400 })
    }

    // A Blobs outage must surface as a controlled 503, not an unhandled 500.
    let payload: unknown
    try {
      payload = await storage.get(id)
    } catch (error) {
      captureException(error, { fn: 'snapshot-retrieve', op: 'storage.get', id })
      return new Response('Snapshot storage unavailable', { status: 503 })
    }

    if (payload === null) {
      return new Response('Not found', { status: 404 })
    }

    return Response.json(payload)
  }
}

// ---------------------------------------------------------------------------
// Default Netlify Function export — uses the production Blobs storage
// ---------------------------------------------------------------------------

export default async function (req: Request): Promise<Response> {
  initObservability()
  try {
    const storage = await createNetlifyBlobsStorage()
    return await makeRetrieveHandler(storage)(req)
  } catch (error) {
    captureException(error, { fn: 'snapshot-retrieve' })
    return new Response('Internal Server Error', { status: 500 })
  }
}

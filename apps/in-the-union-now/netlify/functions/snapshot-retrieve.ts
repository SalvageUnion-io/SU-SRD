/**
 * snapshot-retrieve — GET /api/snapshots/:id
 *
 * Returns the stored JSON snapshot payload for the given ID.
 * 404 for unknown IDs. PATCH / PUT / DELETE / POST return 405.
 *
 * The :id segment is extracted from the URL path (Netlify Functions receive
 * the full request URL; routing is configured in netlify.toml).
 *
 * See ADR-010-snapshot-backend.md for full rationale.
 */

import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storage'
import type { SnapshotStorage } from '../../src/lib/snapshot/storage'

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

    const payload = await storage.get(id)

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
  const storage = await createNetlifyBlobsStorage()
  return makeRetrieveHandler(storage)(req)
}

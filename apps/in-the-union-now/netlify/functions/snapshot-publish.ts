/**
 * snapshot-publish — POST /api/snapshots
 *
 * Accepts a JSON snapshot payload, stores it with a short ID, and returns
 * { id, url } pointing at the retrieve endpoint.
 *
 * Per-IP rate limit: 10 requests/minute (in-memory, per-instance).
 * PATCH / PUT / DELETE return 405.
 * No PII is stored — only the client-supplied JSON body.
 *
 * See ADR-010-snapshot-backend.md for full rationale.
 */

import { generateUniqueId } from '../../src/lib/snapshot/id'
import { RateLimiter, getClientIp } from '../../src/lib/snapshot/rateLimit'
import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storage'
import type { SnapshotStorage } from '../../src/lib/snapshot/storage'

// ---------------------------------------------------------------------------
// Module-level rate limiter — persists across invocations within one instance
// ---------------------------------------------------------------------------
const rateLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 })

// ---------------------------------------------------------------------------
// Handler factory — accepts injected storage for testability
// ---------------------------------------------------------------------------

export function makePublishHandler(storage: SnapshotStorage) {
  return async function handler(req: Request): Promise<Response> {
    // Only POST is allowed; all mutating methods return 405
    if (req.method === 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Rate limiting
    const ip = getClientIp(req)
    if (!rateLimiter.check(ip)) {
      return new Response('Too many requests', { status: 429 })
    }

    // Parse payload — must be valid JSON
    let payload: unknown
    try {
      payload = await req.json()
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return new Response('Payload must be a JSON object', { status: 400 })
    }

    // Generate unique ID
    let id: string
    try {
      id = await generateUniqueId(async (candidate) => {
        const existing = await storage.get(candidate)
        return existing !== null
      })
    } catch {
      return new Response('Failed to generate unique ID', { status: 500 })
    }

    // Persist — onlyIfNew is belt-and-suspenders; uniqueness is already
    // checked above, but this prevents a race between two concurrent publishes
    // that happen to collide after the check.
    const result = await storage.put(id, payload, { onlyIfNew: true })
    if (!result.modified) {
      // Collision race — extremely unlikely; caller can retry
      return new Response('ID collision — please retry', { status: 409 })
    }

    const url = `/api/snapshots/${id}`
    return Response.json({ id, url }, { status: 201 })
  }
}

// ---------------------------------------------------------------------------
// Default Netlify Function export — uses the production Blobs storage
// ---------------------------------------------------------------------------

export default async function (req: Request): Promise<Response> {
  const storage = await createNetlifyBlobsStorage()
  return makePublishHandler(storage)(req)
}

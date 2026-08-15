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
 * See ADR-004-snapshot-netlify-functions.md for full rationale.
 */

import { generateUniqueId } from '../../src/lib/snapshot/id'
import { getClientIp, RateLimiter } from '../../src/lib/snapshot/rateLimit'
import type { SnapshotStorage } from '../../src/lib/snapshot/storage'
import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storage'
import { captureException, initObservability } from '../lib/observability'

// ---------------------------------------------------------------------------
// Module-level rate limiter — persists across invocations within one instance
// ---------------------------------------------------------------------------
const rateLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 })

// Hard cap on accepted payload size. A snapshot is a single pilot/mech/crawler
// (with its resolved choices), so a few hundred KB is generous headroom; the
// cap stops an unauthenticated caller from writing arbitrarily large blobs to
// the Blobs store (storage/cost amplification). Measured in UTF-8 bytes.
const MAX_PAYLOAD_BYTES = 256 * 1024

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

    // Fast reject on a declared Content-Length over the cap, before reading
    // the body at all.
    const declaredLength = Number(req.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
      return new Response('Payload too large', { status: 413 })
    }

    // Read the raw body and enforce the cap on actual bytes (Content-Length
    // may be absent or understated under chunked transfer).
    let rawBody: string
    try {
      rawBody = await req.text()
    } catch {
      return new Response('Invalid request body', { status: 400 })
    }
    if (new TextEncoder().encode(rawBody).length > MAX_PAYLOAD_BYTES) {
      return new Response('Payload too large', { status: 413 })
    }

    // Parse payload — must be valid JSON
    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
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
    // that happen to collide after the check. A Blobs outage must surface as a
    // controlled 503, not an unhandled 500.
    let result: Awaited<ReturnType<SnapshotStorage['put']>>
    try {
      result = await storage.put(id, payload, { onlyIfNew: true })
    } catch (error) {
      captureException(error, { fn: 'snapshot-publish', op: 'storage.put' })
      return new Response('Snapshot storage unavailable', { status: 503 })
    }
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

/** @public Netlify Functions handler — invoked by the platform, not imported. */
export default async function (req: Request): Promise<Response> {
  initObservability()
  try {
    const storage = await createNetlifyBlobsStorage()
    return await makePublishHandler(storage)(req)
  } catch (error) {
    captureException(error, { fn: 'snapshot-publish' })
    return new Response('Internal Server Error', { status: 500 })
  }
}

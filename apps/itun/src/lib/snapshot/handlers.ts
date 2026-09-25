/**
 * The three snapshot handlers.
 *
 * They are factories over an injected `SnapshotStorage`, which is what lets
 * the tests drive every branch without an R2 binding; `src/worker/index.ts`
 * wires them to R2. Rate limiting is not here: it is Cloudflare's
 * edge-enforced binding, applied by the Worker.
 */

import { generateUniqueId, isValidSnapshotId } from './id'
import { validateSnapshotPayload } from './payload'
import { reportSnapshotError } from './report'
import type { SnapshotStorage } from './storage'

/**
 * Hard cap on accepted payload size.
 *
 * A snapshot is a single pilot/mech/crawler with its resolved choices, so a few
 * hundred KB is generous headroom. This is what actually stops an
 * unauthenticated caller writing arbitrarily large objects — the rate limiter
 * never did that job. Measured in UTF-8 bytes.
 */
const MAX_PAYLOAD_BYTES = 256 * 1024

/** The last path segment — the snapshot id, for the `/:id` routes. */
function idFromPath(req: Request): string | undefined {
  const url = new URL(req.url)
  return url.pathname.split('/').filter(Boolean).at(-1)
}

export function makePublishHandler(storage: SnapshotStorage) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // No rate-limit check here any more. It is enforced at the EDGE by
    // Cloudflare's Rate Limiting binding, ahead of this handler — see
    // `apps/itun/src/worker/index.ts` and the `ratelimits` block in
    // `wrangler.jsonc`. The in-process counter this replaces was per-instance
    // and therefore decorative (ADR-033 P3).

    // Fast reject on a declared Content-Length over the cap, before reading the
    // body at all.
    const declaredLength = Number(req.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
      return new Response('Payload too large', { status: 413 })
    }

    let rawBody: string
    try {
      rawBody = await req.text()
    } catch {
      return new Response('Invalid request body', { status: 400 })
    }
    // Content-Length may be absent or understated under chunked transfer, so the
    // real bytes are checked too.
    if (new TextEncoder().encode(rawBody).length > MAX_PAYLOAD_BYTES) {
      return new Response('Payload too large', { status: 413 })
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    // The renderer's own Zod parse, so an unrenderable snapshot cannot be
    // minted — publishing one would hand its owner a share link they find out
    // is broken from whoever they sent it to.

    const check = validateSnapshotPayload(payload)
    if (!check.ok) {
      return new Response(check.reason, { status: 400 })
    }

    let id: string
    try {
      id = await generateUniqueId(async (candidate) => (await storage.get(candidate)) !== null)
    } catch {
      return new Response('Failed to generate unique ID', { status: 500 })
    }

    // `onlyIfNew` is belt-and-suspenders: uniqueness is already checked above,
    // but this closes a race between two publishes that collide after the check.
    let result: Awaited<ReturnType<SnapshotStorage['put']>>
    try {
      result = await storage.put(id, payload, { onlyIfNew: true })
    } catch (error) {
      reportSnapshotError(error, { fn: 'snapshot-publish', op: 'storage.put' })
      return new Response('Snapshot storage unavailable', { status: 503 })
    }
    if (!result.modified) {
      return new Response('ID collision — please retry', { status: 409 })
    }

    return Response.json({ id, url: `/api/snapshots/${id}` }, { status: 201 })
  }
}

export function makeRetrieveHandler(storage: SnapshotStorage) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }

    const id = idFromPath(req)
    if (!id) {
      return new Response('Missing snapshot ID', { status: 400 })
    }
    // Reject malformed ids before touching storage — a valid id is always 8
    // Crockford-base32 chars, so anything else cannot exist (CWE-20).
    if (!isValidSnapshotId(id)) {
      return new Response('Invalid snapshot ID', { status: 400 })
    }

    let payload: unknown
    try {
      payload = await storage.get(id)
    } catch (error) {
      reportSnapshotError(error, { fn: 'snapshot-retrieve', op: 'storage.get', id })
      return new Response('Snapshot storage unavailable', { status: 503 })
    }

    if (payload === null) {
      return new Response('Snapshot not found', { status: 404 })
    }

    return Response.json(payload, {
      status: 200,
      // A snapshot is immutable once minted, so it can be cached hard. Revoking
      // one deletes it, and the 404 is what the client then sees.
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    })
  }
}

export function makeDeleteHandler(storage: SnapshotStorage) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'DELETE') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Rate limiting is edge-enforced — see the note in `makePublishHandler`.

    const id = idFromPath(req)
    if (!id) {
      return new Response('Missing snapshot ID', { status: 400 })
    }
    if (!isValidSnapshotId(id)) {
      return new Response('Invalid snapshot ID', { status: 400 })
    }

    try {
      await storage.delete(id)
    } catch (error) {
      reportSnapshotError(error, { fn: 'snapshot-delete', op: 'storage.delete', id })
      return new Response('Snapshot storage unavailable', { status: 503 })
    }

    // Idempotent: whether or not the id existed, it is gone now.
    return new Response(null, { status: 204 })
  }
}

/**
 * The three snapshot handlers, as transport-neutral factories.
 *
 * ## Why they live here rather than in `netlify/functions/`
 *
 * They were defined alongside the Netlify default exports, which was fine while
 * Netlify was the only host. ADR-033 adds a Cloudflare Worker, and importing a
 * factory out of `netlify/functions/snapshot-publish.ts` drags the whole module
 * — including its `@sentry/node` import — into the Worker bundle. esbuild
 * follows the module, not the call, so splitting the *usage* was not enough:
 * the build still pulled in OpenTelemetry, `require-in-the-middle` and
 * `node:path`, none of which run on workerd.
 *
 * So the handlers are the shared thing and each platform file is a thin
 * adapter: `netlify/functions/*` supplies Blobs storage and Sentry,
 * `src/worker/index.ts` supplies R2 and console logging. Neither owns the logic.
 *
 * ## Rate limiting is a parameter, and that is a decision not an accident
 *
 * The in-process `RateLimiter{10/min}` was already approximate — it counts per
 * Function instance, and instances are ephemeral. Across Workers isolates it
 * would be equally approximate, and porting it would produce something that
 * *looks* like a control without being one (ADR-033 P3).
 *
 * Rather than delete it from a live surface during a migration, it stays the
 * DEFAULT — Netlify behaviour is unchanged, existing tests still exercise it —
 * and the Worker passes `null` to opt out, because Cloudflare's Rate Limiting
 * binding is enforced at the edge and is a real control. One host, one
 * mechanism; nothing runs two.
 */

import { generateUniqueId, isValidSnapshotId } from './id'
import { validateSnapshotPayload } from './payload'
import { getClientIp, RateLimiter } from './rateLimit'
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

/** Anything that can answer "has this key exceeded its allowance?". */
export type RateLimitCheck = { check(key: string): boolean }

/**
 * Module-level limiter, shared by every handler that opts in. Persists across
 * invocations within one instance, which is the whole of its reach.
 */
const inProcessRateLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 })

export type HandlerOptions = {
  /**
   * `undefined` keeps the in-process limiter (Netlify's behaviour).
   * `null` disables it — for hosts with a real edge-enforced limiter.
   */
  rateLimiter?: RateLimitCheck | null
}

function limited(req: Request, options: HandlerOptions | undefined): boolean {
  const limiter = options?.rateLimiter === undefined ? inProcessRateLimiter : options.rateLimiter
  if (limiter === null) return false
  return !limiter.check(getClientIp(req))
}

/** The `:id` segment of `/api/snapshots/<id>`. */
function idFromPath(req: Request): string | undefined {
  const url = new URL(req.url)
  return url.pathname.split('/').filter(Boolean).at(-1)
}

export function makePublishHandler(storage: SnapshotStorage, options?: HandlerOptions) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    if (limited(req, options)) {
      return new Response('Too many requests', { status: 429 })
    }

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

    // Not merely "is this an object" — the payload must be something `/s/$id`
    // could actually render, checked with the renderer's own parse. Publishing
    // an unrenderable snapshot mints a share link whose owner discovers it is
    // broken from whoever they sent it to. See `payload.ts`.
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

export function makeDeleteHandler(storage: SnapshotStorage, options?: HandlerOptions) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'DELETE') {
      return new Response('Method not allowed', { status: 405 })
    }

    if (limited(req, options)) {
      return new Response('Too many requests', { status: 429 })
    }

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

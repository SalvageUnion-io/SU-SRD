/**
 * Per-IP in-memory rate limiter.
 *
 * IMPORTANT: This is per-Lambda-instance. Netlify may spin up multiple
 * instances, so a single IP can exceed the limit by hitting different
 * instances. For v1 this is acceptable. See ADR-004-snapshot-netlify-functions.md
 * §Rate Limiting for the upgrade path (shared counter via Netlify Blobs).
 */

type WindowState = {
  count: number
  windowStart: number
}

type RateLimiterOptions = {
  /** Maximum requests per window. Default: 10. */
  limit?: number
  /** Window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number
}

export class RateLimiter {
  private readonly windows = new Map<string, WindowState>()
  private readonly limit: number
  private readonly windowMs: number

  constructor(options: RateLimiterOptions = {}) {
    this.limit = options.limit ?? 10
    this.windowMs = options.windowMs ?? 60_000
  }

  /**
   * Returns true if the request is within the rate limit (allowed),
   * false if it exceeds the limit (should be rejected with 429).
   */
  check(ip: string): boolean {
    const now = Date.now()
    this.evictExpired(now)
    const state = this.windows.get(ip)

    if (!state || now - state.windowStart >= this.windowMs) {
      this.windows.set(ip, { count: 1, windowStart: now })
      return true
    }

    if (state.count >= this.limit) {
      return false
    }

    state.count++
    return true
  }

  /**
   * Drops windows that have fully expired so the Map cannot grow without
   * bound as distinct IPs accumulate over the lifetime of a warm instance.
   * Cheap O(n) sweep; n is bounded by the number of IPs seen within one
   * window, which for a rate-limited endpoint stays small.
   */
  private evictExpired(now: number): void {
    for (const [ip, state] of this.windows) {
      if (now - state.windowStart >= this.windowMs) {
        this.windows.delete(ip)
      }
    }
  }
}

/**
 * Extracts the client IP from a Request object.
 *
 * Prefers `x-nf-client-connection-ip`, which Netlify's edge sets from the
 * real TCP peer and a client cannot forge. Only falls back to the leftmost
 * `x-forwarded-for` entry when that header is absent (e.g. `netlify dev`),
 * and finally to '0.0.0.0'. Trusting X-Forwarded-For alone would let a
 * caller rotate the header to dodge the limit entirely.
 */
export function getClientIp(req: Request): string {
  const netlifyIp = req.headers.get('x-nf-client-connection-ip')
  if (netlifyIp && netlifyIp.trim() !== '') {
    return netlifyIp.trim()
  }

  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For may contain a comma-separated list; take the first
    const first = forwarded.split(',')[0]
    if (first !== undefined && first.trim() !== '') {
      return first.trim()
    }
  }
  return '0.0.0.0'
}

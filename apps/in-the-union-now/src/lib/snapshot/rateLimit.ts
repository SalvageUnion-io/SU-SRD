/**
 * Per-IP in-memory rate limiter.
 *
 * IMPORTANT: This is per-Lambda-instance. Netlify may spin up multiple
 * instances, so a single IP can exceed the limit by hitting different
 * instances. For v1 this is acceptable. See ADR-010-snapshot-backend.md
 * §Rate Limiting for the upgrade path (shared counter via Netlify Blobs).
 */

type WindowState = {
  count: number
  windowStart: number
}

export type RateLimiterOptions = {
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
}

/**
 * Extracts the client IP from a Request object.
 * Prefers the X-Forwarded-For header (set by Netlify's proxy).
 * Falls back to '0.0.0.0' if no IP can be determined.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For may contain a comma-separated list; take the first
    const first = forwarded.split(',')[0]
    return first !== undefined ? first.trim() : '0.0.0.0'
  }
  return '0.0.0.0'
}

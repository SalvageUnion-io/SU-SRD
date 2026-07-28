import { ConvexReactClient } from 'convex/react'

/**
 * The Convex client, or `null` when this build has no deployment configured.
 *
 * `VITE_CONVEX_URL` is written into `.env.local` by `bunx convex dev` and that
 * file is gitignored, so a checkout that has never run it — CI, a fresh
 * contributor, a deliberately backend-free deploy — compiles with the variable
 * undefined. That is a **supported build**, not a misconfiguration: it runs in
 * Solo mode, which is the same fully-local app that existed before accounts
 * (ADR-030 §1).
 *
 * Constructing the client eagerly at module scope would throw in exactly those
 * builds and take the whole app down, so the URL is checked first and the
 * client stays `null` otherwise. Every consumer must handle `null`.
 */

const url = import.meta.env.VITE_CONVEX_URL as string | undefined

/** True when a Convex deployment URL was compiled into this build. */
export const isConvexConfigured = typeof url === 'string' && url.length > 0

export const convexClient: ConvexReactClient | null = isConvexConfigured
  ? new ConvexReactClient(url as string)
  : null

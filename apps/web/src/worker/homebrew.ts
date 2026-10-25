/**
 * `GET /homebrew/patterns.json` — Homebrew for the SRD's pages (ADR-061):
 * every pattern listed on the Reference, or one chassis's (`?chassis=<ref>`),
 * read from the shared database (`./shared/homebrew.ts`). The SRD's pages are
 * static and may fetch only their own origin, so this is how they reach it.
 *
 * Cached for a minute: a pattern shared or hidden shows within one.
 */

import { reportError } from './errorReports'
import type { PreviewEnv } from './linkPreview'
import { homebrewPatterns } from './shared/homebrew'

/** A chassis ref as the reference writes one. */
const CHASSIS_REF = /^[a-z0-9-]{1,64}$/

function json(status: number, body: unknown, cache: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8', 'cache-control': cache },
  })
}

export async function serveHomebrew(url: URL, env: PreviewEnv): Promise<Response> {
  const chassis = url.searchParams.get('chassis')
  if (chassis !== null && !CHASSIS_REF.test(chassis)) {
    return json(400, { error: 'chassis' }, 'no-store')
  }
  if (!env.SHARED) return json(503, { error: 'unavailable' }, 'no-store')
  try {
    const rows = await homebrewPatterns(env.SHARED, chassis ?? undefined)
    return json(200, rows, 'public,max-age=60')
  } catch (error) {
    reportError(error, { where: 'homebrew.serve' })
    return json(503, { error: 'unavailable' }, 'no-store')
  }
}

/**
 * `GET /homebrew/patterns.json` — Homebrew for the SRD's pages (ADR-061):
 * every pattern shared on the Reference, or one chassis's (`?chassis=<ref>`), read
 * from `homebrew.patterns` over Convex's HTTP API. The SRD's pages are static
 * and may fetch only their own origin, so this is how they reach it.
 *
 * Cached for a minute: a pattern shared or hidden shows within one, and a
 * busy chassis page costs Convex one read a minute per browser, not one per
 * view.
 */

import { getFunctionName, makeFunctionReference } from 'convex/server'
import type { HomebrewRow } from '../lib/homebrew/endpoint'
import type { PreviewEnv } from './linkPreview'
import { convexQuery } from './linkPreview'

/** `homebrew.patterns`, named as its HTTP API takes it. */
const PATTERNS = getFunctionName(makeFunctionReference<'query'>('homebrew:patterns'))

/** A chassis ref as the reference writes one. */
const CHASSIS_REF = /^[a-z0-9-]{1,64}$/

function json(status: number, body: unknown, cache: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8', 'cache-control': cache },
  })
}

export async function serveHomebrew(
  url: URL,
  env: PreviewEnv,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const chassis = url.searchParams.get('chassis')
  if (chassis !== null && !CHASSIS_REF.test(chassis)) {
    return json(400, { error: 'chassis' }, 'no-store')
  }
  const rows = await convexQuery<HomebrewRow[]>(
    env,
    PATTERNS,
    chassis === null ? {} : { chassisRef: chassis },
    fetchImpl
  )
  if (rows === undefined) return json(503, { error: 'unavailable' }, 'no-store')
  return json(200, rows ?? [], 'public,max-age=60')
}

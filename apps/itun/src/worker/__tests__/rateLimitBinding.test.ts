import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The Rate Limiting binding must be DECLARED, not merely handled.
 *
 * `routing.test.ts` covers what the Worker does with and without the binding,
 * and both behaviours are correct — including the deliberate choice that an
 * absent binding degrades to no limiting rather than crashing.
 *
 * That tolerance is exactly why nothing caught the real problem. Through P4-P7
 * the binding was never provisioned, three separate comments in the Worker
 * described it as "a real control", and `/api/snapshots` accepted unlimited
 * unauthenticated POSTs into billable R2. No test failed, because every test
 * asserted the handler's behaviour and none asserted the deployment's shape.
 *
 * So this file reads the config that actually ships. It is the only thing here
 * that can fail if the binding is removed again.
 *
 * Paths resolve from `import.meta.url`, never `process.cwd()` — the test runner
 * makes no promise about the working directory.
 */

const WRANGLER = join(dirname(fileURLToPath(import.meta.url)), '../../../wrangler.jsonc')

/**
 * The `ratelimits` array as raw text.
 *
 * Extracted with a regex rather than parsed: `wrangler.jsonc` carries comments
 * (including ones containing `https://`), so stripping them to reach `JSON.parse`
 * would need a real JSONC parser to be safe, and this needs to read four fields.
 */
function ratelimitsBlock(): string {
  const source = readFileSync(WRANGLER, 'utf8')
  const match = /"ratelimits"\s*:\s*\[([\s\S]*?)\]/.exec(source)
  return match?.[1] ?? ''
}

describe('itun wrangler.jsonc — Rate Limiting binding', () => {
  it('declares a ratelimits block', () => {
    // The whole point. Without this the publish endpoint is unlimited, and
    // every other assertion in this file is vacuously true.
    expect(ratelimitsBlock()).not.toBe('')
  })

  it('binds it as RATE_LIMITER, the name the Worker reads', () => {
    // `env.RATE_LIMITER` is optional in the Env type, so a renamed binding is
    // not a type error — it is silently no limiting.
    expect(ratelimitsBlock()).toMatch(/"name"\s*:\s*"RATE_LIMITER"/)
  })

  it('uses a period the platform accepts', () => {
    // Cloudflare allows ONLY 10 or 60. Any other value is a deploy-time
    // rejection, which is loud — but this catches it before the deploy.
    const period = /"period"\s*:\s*(\d+)/.exec(ratelimitsBlock())?.[1]
    expect(period).toBeDefined()
    expect([10, 60]).toContain(Number(period))
  })

  it('sets a limit that actually limits', () => {
    // A limit high enough to never trigger would satisfy every other check here
    // while restoring the exact condition this binding exists to end.
    const limit = Number(/"limit"\s*:\s*(\d+)/.exec(ratelimitsBlock())?.[1])
    expect(limit).toBeGreaterThan(0)
    expect(limit).toBeLessThanOrEqual(60)
  })

  it('does not reuse the documentation example namespace_id', () => {
    // `namespace_id` is unique per ACCOUNT and shares counters across Workers.
    // This account also runs randsum-rdn and randsum-site (ADR-033 §6), so the
    // docs' `1001` is the one value most likely to collide with a future
    // binding written by someone reading the same page.
    expect(ratelimitsBlock()).not.toMatch(/"namespace_id"\s*:\s*"1001"/)
    expect(ratelimitsBlock()).toMatch(/"namespace_id"\s*:\s*"\d+"/)
  })
})

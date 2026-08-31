import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { Env } from '../worker.js'
import worker from '../worker.js'

/**
 * The Cron Trigger liveness heartbeat.
 *
 * Driven through `worker.scheduled` rather than by exporting `heartbeat`,
 * because the entry point IS the contract: Cloudflare calls this, and a
 * heartbeat that works but is never wired to the trigger is exactly the failure
 * being replaced — `startLivenessHeartbeat` was correct code that the Worker
 * never reached.
 *
 * ## What must be true, and why each matters
 *
 * The old monitor watched a Render process the Worker had superseded, so it
 * either alerted forever or reported green for something nobody used. The
 * replacement is only better if it reports on the thing that can actually break.
 * Under HTTP interactions there is no gateway session to observe, so **token
 * validity is the liveness question** — which is why a check-in that merely
 * proved "the cron fired" would be no improvement at all.
 */

const ENV: Env = {
  DISCORD_PUBLIC_KEY: 'aa'.repeat(32),
  DISCORD_APPLICATION_ID: '111111111111111111',
  DISCORD_TOKEN: 'test-token',
}

/**
 * A Cloudflare ScheduledController, as much of one as the wrapper reads.
 *
 * `withSentry` names its span `Scheduled Cron ${controller.cron}`, so a bare
 * `{}` throws before the handler runs — which is worth knowing: the event is
 * not an opaque token the handler may ignore.
 */
const CONTROLLER = { cron: '*/5 * * * *', scheduledTime: 0, noRetry: () => {} }

/** Collects `waitUntil` work so a test can await the background half. */
function collectingCtx() {
  const pending: Promise<unknown>[] = []
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => void pending.push(p) },
    settled: () => Promise.allSettled(pending),
  }
}

let realFetch: typeof globalThis.fetch

beforeEach(() => {
  realFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('scheduled — liveness heartbeat', () => {
  test('probes Discord with the bot token', async () => {
    const calls: Array<{ url: string; auth: string | null }> = []
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        auth: new Headers(init?.headers).get('authorization'),
      })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    const { ctx, settled } = collectingCtx()
    await worker.scheduled?.(CONTROLLER, ENV, ctx)
    await settled()

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://discord.com/api/v10/users/@me')
    // `Bot <token>`, not a bare token — Discord rejects the bare form, and a
    // heartbeat that always 401s would report the bot dead while it is fine.
    expect(calls[0]?.auth).toBe('Bot test-token')
  })

  test('does the probe under waitUntil, not in the handler body', async () => {
    // The check-in has to outlive the scheduled invocation's return, or the
    // isolate can be torn down before the event leaves — the same reason the
    // interaction path defers.
    let resolveProbe: (r: Response) => void = () => {}
    globalThis.fetch = (() =>
      new Promise<Response>((resolve) => {
        resolveProbe = resolve
      })) as unknown as typeof fetch

    const { ctx, settled } = collectingCtx()

    // `scheduled` is optional on the handler type, so wrap rather than chain —
    // `?.()` widens the result to `void | Promise<void>`, which has no `.then`.
    const invoke = async () => {
      await worker.scheduled?.(CONTROLLER, ENV, ctx)
      return 'RETURNED' as const
    }

    const returned = await Promise.race([
      invoke(),
      new Promise<'HUNG'>((r) => setTimeout(() => r('HUNG'), 50)),
    ])

    expect(returned).toBe('RETURNED')
    resolveProbe(new Response('{}', { status: 200 }))
    await settled()
  })

  test('a rejected token does not throw out of the handler', async () => {
    // It must report `error` to Sentry, but a cron that THROWS is a cron that
    // Cloudflare retries and logs as a failure for a reason that is not the
    // bot's — the token being wrong is the finding, not an exception.
    globalThis.fetch = (async () =>
      new Response('unauthorized', { status: 401 })) as unknown as typeof fetch

    const { ctx, settled } = collectingCtx()
    await worker.scheduled?.(CONTROLLER, ENV, ctx)
    const results = await settled()

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  test('an unreachable Discord does not throw either', async () => {
    // Reported as `error` rather than skipped: a monitor that goes green on
    // "could not check" is precisely the silence this replaces.
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    const { ctx, settled } = collectingCtx()
    await worker.scheduled?.(CONTROLLER, ENV, ctx)
    const results = await settled()

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  test('the scheduled handler exists — the cron has something to call', async () => {
    // `wrangler.jsonc` declares `triggers.crons`. A schedule pointing at a
    // Worker with no `scheduled` export fails at runtime, every five minutes,
    // silently.
    expect(typeof worker.scheduled).toBe('function')
  })
})

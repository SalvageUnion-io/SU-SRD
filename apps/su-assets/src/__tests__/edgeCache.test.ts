import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { AssetBucket, ExecutionCtx } from '../worker'
import { makeAssetHandler } from '../worker'

/**
 * Edge caching.
 *
 * `cache-control: immutable` only spares a browser that has ALREADY fetched the
 * byte. Cloudflare does not edge-cache a Worker's own response — that needs an
 * explicit `caches.default.put` — so before this every artwork request from
 * every cold client worldwide cost one Worker invocation plus one billable R2
 * read. Measured against production while auditing: artwork responses carried no
 * `cf-cache-status` header at all, while srd's static assets on the same account
 * returned `HIT`.
 *
 * There is no `caches` global under `bun test`, so these install a minimal fake
 * and assert against it. That is also the reason `edgeCache()` returns null
 * rather than throwing — see its comment.
 */

type Entry = { req: Request; res: Response }

function installCache() {
  const puts: Entry[] = []
  const store = new Map<string, Response>()
  const fake = {
    async match(req: Request) {
      return store.get(req.url)?.clone()
    },
    async put(req: Request, res: Response) {
      // The real Cache API THROWS on a non-GET put. This double used to accept
      // any method, which is precisely why the suite could not see that the
      // handler was caching HEAD requests — the throw happened inside
      // `waitUntil`, after the response had gone out, so nothing surfaced.
      if (req.method !== 'GET') {
        throw new TypeError('Cannot cache response to non-GET request.')
      }
      puts.push({ req, res })
      store.set(req.url, res)
    },
  }
  ;(globalThis as { caches?: unknown }).caches = { default: fake }
  return { puts, store }
}

function bucketWith(entries: Record<string, string>): AssetBucket & { reads: number } {
  const state = {
    reads: 0,
    async get(key: string) {
      state.reads += 1
      const body = entries[key]
      if (body === undefined) return null
      return { body: new Response(body).body }
    },
  }
  return state
}

function get(path: string): Request {
  return new Request(`https://assets.salvageunion.io${path}`)
}

/** Collects `waitUntil` promises so a test can await the cache write. */
function collectingCtx(): ExecutionCtx & { settled: () => Promise<unknown> } {
  const pending: Promise<unknown>[] = []
  return {
    waitUntil(p) {
      pending.push(p)
    },
    settled: () => Promise.all(pending),
  }
}

let savedCaches: unknown

beforeEach(() => {
  savedCaches = (globalThis as { caches?: unknown }).caches
})

afterEach(() => {
  ;(globalThis as { caches?: unknown }).caches = savedCaches
})

describe('su-assets edge cache', () => {
  it('stores a successful response and serves the next request from cache', async () => {
    const { puts } = installCache()
    const bucket = bucketWith({ 'classes/salvager.webp': 'bytes' })
    const ctx = collectingCtx()
    const handler = makeAssetHandler(
      () => bucket,
      () => {},
      undefined,
      ctx
    )

    const first = await handler(get('/classes/salvager.webp'))
    expect(first.status).toBe(200)
    await ctx.settled()
    expect(puts).toHaveLength(1)

    const readsAfterFirst = bucket.reads
    const second = await handler(get('/classes/salvager.webp'))
    expect(second.status).toBe(200)
    expect(await second.text()).toBe('bytes')
    // The point of the whole change: the second request costs no R2 read.
    expect(bucket.reads).toBe(readsAfterFirst)
  })

  it('does not AWAIT the cache write in the response path', async () => {
    // Awaiting the put would serialize a cache write into every MISS's response
    // time — the bug this shares with apps/itun's og:image path.
    //
    // Asserting "puts is still empty when the response resolves" would not show
    // this: `ctx.waitUntil(cache.put(...))` INVOKES put synchronously to build
    // the promise, so a recording fake fills in either way. The distinguishing
    // property is whether the handler waits for it to RESOLVE — so this put
    // never resolves until released, and the response still has to arrive.
    let release: () => void = () => {}
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    ;(globalThis as { caches?: unknown }).caches = {
      default: {
        async match() {
          return undefined
        },
        put: () => blocked,
      },
    }

    const bucket = bucketWith({ 'classes/salvager.webp': 'bytes' })
    const ctx = collectingCtx()

    const res = await Promise.race([
      makeAssetHandler(
        () => bucket,
        () => {},
        undefined,
        ctx
      )(get('/classes/salvager.webp')),
      new Promise<'HUNG'>((resolve) => setTimeout(() => resolve('HUNG'), 50)),
    ])

    expect(res).not.toBe('HUNG')
    expect((res as Response).status).toBe(200)
    release()
  })

  it('never caches a 404', async () => {
    // A negative entry would make a newly uploaded image invisible for as long
    // as it lived, and a miss is cheap to recompute anyway.
    const { puts } = installCache()
    const bucket = bucketWith({})
    const ctx = collectingCtx()

    const res = await makeAssetHandler(
      () => bucket,
      () => {},
      undefined,
      ctx
    )(get('/classes/ghost.webp'))

    expect(res.status).toBe(404)
    await ctx.settled()
    expect(puts).toHaveLength(0)
  })

  it('never caches a 405', async () => {
    const { puts } = installCache()
    const bucket = bucketWith({ 'classes/salvager.webp': 'bytes' })
    const ctx = collectingCtx()

    const res = await makeAssetHandler(
      () => bucket,
      () => {},
      undefined,
      ctx
    )(new Request('https://assets.salvageunion.io/classes/salvager.webp', { method: 'POST' }))

    expect(res.status).toBe(405)
    await ctx.settled()
    expect(puts).toHaveLength(0)
  })

  it('never caches a storage failure', async () => {
    // A 503 is transient by definition. Caching one would outlive the outage.
    const { puts } = installCache()
    const ctx = collectingCtx()
    const exploding: AssetBucket = {
      async get() {
        throw new Error('no binding')
      },
    }

    const res = await makeAssetHandler(
      () => exploding,
      () => {},
      undefined,
      ctx
    )(get('/classes/salvager.webp'))

    expect(res.status).toBe(503)
    await ctx.settled()
    expect(puts).toHaveLength(0)
  })

  it('serves correctly with no cache global at all', async () => {
    // `bun test` has no `caches`, and so does any non-workerd runtime. Reading
    // through it must not throw — the asset still has to be served.
    ;(globalThis as { caches?: unknown }).caches = undefined
    const bucket = bucketWith({ 'classes/salvager.webp': 'bytes' })

    const res = await makeAssetHandler(() => bucket)(get('/classes/salvager.webp'))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('bytes')
  })

  it('serves uncached rather than dropping the write when ctx is absent', async () => {
    const { puts } = installCache()
    const bucket = bucketWith({ 'classes/salvager.webp': 'bytes' })

    const res = await makeAssetHandler(() => bucket)(get('/classes/salvager.webp'))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('bytes')
    expect(puts).toHaveLength(0)
  })

  it('does not try to cache a HEAD request', async () => {
    // Regression test for a silent failure: the handler admits HEAD, and
    // `cache.put` on a non-GET throws inside `waitUntil` — so the response
    // succeeded, the throw was swallowed, and nothing was ever cached. With the
    // double above now throwing like the real API, an unguarded `put` fails
    // this test instead of disappearing.
    const { puts } = installCache()
    const bucket = bucketWith({ 'chassis/mule.webp': 'bytes' })
    const ctx = collectingCtx()

    const res = await makeAssetHandler(
      () => bucket,
      undefined,
      undefined,
      ctx
    )(new Request('https://assets.salvageunion.io/chassis/mule.webp', { method: 'HEAD' }))

    expect(res.status).toBe(200)
    await ctx.settled()
    expect(puts).toHaveLength(0)
  })
})

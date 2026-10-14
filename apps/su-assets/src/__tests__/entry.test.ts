import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test'
import * as observability from 'observability/cloudflare'
import worker from '../worker'
import { bucketWith, req } from './fixtures'

/**
 * The deployed entrypoint: the default export workerd loads, reading its
 * bucket and Images binding from `env` and turning anything the handler did
 * not anticipate into a reported 500.
 */

const reportError = spyOn(observability, 'reportError').mockImplementation(() => undefined)

afterEach(() => {
  reportError.mockClear()
})

afterAll(() => {
  reportError.mockRestore()
})

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext

function envWith(entries: Record<string, string>): Env {
  return { LP_ASSETS: bucketWith(entries), IMAGES: undefined, SENTRY_DSN: '' } as unknown as Env
}

async function fetchVia(env: Env, path: string): Promise<Response> {
  const fetch = worker.fetch
  if (!fetch) throw new Error('the Worker exports no fetch handler')
  return fetch(req(path) as Parameters<typeof fetch>[0], env, ctx)
}

describe('asset worker — entrypoint', () => {
  it('serves an object from the LP_ASSETS binding', async () => {
    const res = await fetchVia(envWith({ 'chassis/mule.webp': 'bytes' }), '/chassis/mule.webp')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(await res.text()).toBe('bytes')
  })

  it('404s a missing derivative when the IMAGES binding is absent', async () => {
    const res = await fetchVia(envWith({ 'chassis/mule.webp': 'bytes' }), '/chassis/mule-440.webp')

    expect(res.status).toBe(404)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('404s a malformed percent-escape quietly, without a report', async () => {
    // A scanner or a mangled link: `decodeURIComponent` throws on it, and that
    // must read as a miss rather than a Worker fault.
    const env = envWith({})
    const res = await fetchVia(env, '/chassis/%E0%A4%A.webp')

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
    expect(reportError).not.toHaveBeenCalled()
  })

  it('turns an unanticipated throw into a reported 500', async () => {
    // A store object whose body cannot be read throws outside every guard, so
    // it lands in the entrypoint's last-resort catch.
    const broken = {
      async get() {
        return {
          get body(): ReadableStream | null {
            throw new Error('unreadable body')
          },
        }
      },
    }
    const env = { LP_ASSETS: broken, IMAGES: undefined, SENTRY_DSN: '' } as unknown as Env
    const res = await fetchVia(env, '/chassis/mule.webp')

    expect(res.status).toBe(500)
    expect(await res.text()).toBe('Internal Server Error')
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError.mock.calls[0]?.[1]).toEqual({ fn: 'asset', op: 'unhandled' })
  })
})

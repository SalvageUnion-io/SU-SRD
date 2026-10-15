/**
 * `public/sw-lifecycle.js` — when a new worker takes over — run against a fake
 * worker global. It is plain JS evaluated in the worker's scope, so the test
 * evaluates its source with `self` bound to the fake.
 */

import { describe, expect, it, mock } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORKBOX_OPTIONS } from '../pwa'

const SOURCE = readFileSync(join(import.meta.dir, '../../public/sw-lifecycle.js'), 'utf-8')

type Listener = (event: { waitUntil(promise: Promise<unknown>): void }) => void

const READER = 'https://salvageunion.io/chassis/mule/'
const BUILDER = 'https://salvageunion.io/build/sheet/pilot/1'

function fakeWorker({
  active,
  marker,
  windows = [READER],
}: {
  active: boolean
  marker: boolean
  windows?: string[]
}) {
  const listeners = new Map<string, Listener>()
  const caches = new Set(marker ? ['su-sw-v1'] : [])
  const navigate = mock((_url: string) => Promise.resolve())
  const sw = {
    registration: { active: active ? {} : null },
    caches: {
      has: (name: string) => Promise.resolve(caches.has(name)),
      open: (name: string) => {
        caches.add(name)
        return Promise.resolve({})
      },
    },
    clients: {
      claim: mock(() => Promise.resolve()),
      matchAll: () => Promise.resolve(windows.map((url) => ({ url, navigate }))),
    },
    skipWaiting: mock(() => Promise.resolve()),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  }
  new Function('self', SOURCE)(sw)

  const fire = async (type: string) => {
    const pending: Promise<unknown>[] = []
    listeners.get(type)?.({ waitUntil: (promise) => pending.push(promise) })
    await Promise.all(pending)
    // Let the reloads, which run after activation, settle.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  const lifecycle = async () => {
    await fire('install')
    await fire('activate')
  }
  return { sw, caches, navigate, lifecycle }
}

describe('sw-lifecycle', () => {
  it('is imported into the generated worker', () => {
    expect(WORKBOX_OPTIONS.importScripts).toContain('/sw-lifecycle.js')
  })

  it('replaces a legacy worker at once and reloads its tabs', async () => {
    const { sw, navigate, lifecycle } = fakeWorker({ active: true, marker: false })
    await lifecycle()
    expect(sw.skipWaiting).toHaveBeenCalledTimes(1)
    expect(sw.clients.claim).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(READER)
  })

  it('takes over at once, without reloading, when no builder tab is open', async () => {
    const { sw, navigate, lifecycle } = fakeWorker({ active: true, marker: true })
    await lifecycle()
    expect(sw.skipWaiting).toHaveBeenCalledTimes(1)
    expect(sw.clients.claim).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('waits while a builder tab is open, for it to move at its next page change', async () => {
    const { sw, navigate, lifecycle } = fakeWorker({
      active: true,
      marker: true,
      windows: [READER, BUILDER],
    })
    await lifecycle()
    expect(sw.skipWaiting).not.toHaveBeenCalled()
    expect(sw.clients.claim).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('counts /build itself as the builder, and not /buildings/', async () => {
    const at = async (url: string) => {
      const { sw, lifecycle } = fakeWorker({ active: true, marker: true, windows: [url] })
      await lifecycle()
      return sw.skipWaiting.mock.calls.length
    }
    expect(await at('https://salvageunion.io/build')).toBe(0)
    expect(await at('https://salvageunion.io/buildings/')).toBe(1)
  })

  it('reloads nothing on a first install, and marks the origin', async () => {
    const { navigate, caches, lifecycle } = fakeWorker({ active: false, marker: false })
    await lifecycle()
    expect(navigate).not.toHaveBeenCalled()
    expect(caches.has('su-sw-v1')).toBe(true)
  })
})

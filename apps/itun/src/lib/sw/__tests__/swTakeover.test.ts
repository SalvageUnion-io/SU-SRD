/**
 * `public/sw-takeover.js` — the one-time takeover from a pre-#1026 worker —
 * run against a fake worker global. It is plain JS evaluated in the worker's
 * scope, so the test evaluates its source with `self` bound to the fake.
 */

import { describe, expect, it, mock } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORKBOX_OPTIONS } from '../workbox'

const SOURCE = readFileSync(join(import.meta.dir, '../../../../public/sw-takeover.js'), 'utf-8')

type Listener = (event: { waitUntil(promise: Promise<unknown>): void }) => void

function fakeWorker({ active, marker }: { active: boolean; marker: boolean }) {
  const listeners = new Map<string, Listener>()
  const caches = new Set(marker ? ['itun-sw-takeover-v1'] : [])
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
      matchAll: () => Promise.resolve([{ url: 'https://itun.test/pilots/1', navigate }]),
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

describe('sw-takeover', () => {
  it('is imported into the generated worker', () => {
    expect(WORKBOX_OPTIONS.importScripts).toContain('sw-takeover.js')
  })

  it('replaces a legacy worker at once and reloads its tabs', async () => {
    const { sw, navigate, lifecycle } = fakeWorker({ active: true, marker: false })
    await lifecycle()
    expect(sw.skipWaiting).toHaveBeenCalledTimes(1)
    expect(sw.clients.claim).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('https://itun.test/pilots/1')
  })

  it('waits behind a current worker — the normal prompt path', async () => {
    const { sw, navigate, lifecycle } = fakeWorker({ active: true, marker: true })
    await lifecycle()
    expect(sw.skipWaiting).not.toHaveBeenCalled()
    expect(sw.clients.claim).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does nothing special on a first install, but marks the origin', async () => {
    const { sw, caches, navigate, lifecycle } = fakeWorker({ active: false, marker: false })
    await lifecycle()
    expect(sw.skipWaiting).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(caches.has('itun-sw-takeover-v1')).toBe(true)
  })

  it('marks the origin after a takeover, so the next deploy waits', async () => {
    const { caches, lifecycle } = fakeWorker({ active: true, marker: false })
    await lifecycle()
    expect(caches.has('itun-sw-takeover-v1')).toBe(true)
  })
})

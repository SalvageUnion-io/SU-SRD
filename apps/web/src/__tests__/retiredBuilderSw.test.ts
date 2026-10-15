/**
 * `public/build/sw.js` — the retired builder worker — run against a fake
 * worker global: it must clear the builder's old precache, unregister itself
 * and reload its windows onto the site's one worker.
 */

import { expect, it, mock } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = readFileSync(join(import.meta.dir, '../../public/build/sw.js'), 'utf-8')

type Listener = (event: { waitUntil(promise: Promise<unknown>): void }) => void

it('clears its precache, unregisters, and reloads its windows', async () => {
  const listeners = new Map<string, Listener>()
  const caches = new Set([
    'workbox-precache-v2-https://salvageunion.io/build/',
    'workbox-precache-v2-https://salvageunion.io/',
    'pages',
  ])
  const navigate = mock((_url: string) => Promise.resolve())
  const unregister = mock(() => Promise.resolve(true))
  const sw = {
    registration: { unregister },
    caches: {
      keys: () => Promise.resolve([...caches]),
      delete: (name: string) => Promise.resolve(caches.delete(name)),
    },
    clients: {
      matchAll: () =>
        Promise.resolve([{ url: 'https://salvageunion.io/build/sheet/pilot/1', navigate }]),
    },
    skipWaiting: mock(() => Promise.resolve()),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  }
  new Function('self', SOURCE)(sw)

  const fire = async (type: string) => {
    const pending: Promise<unknown>[] = []
    listeners.get(type)?.({ waitUntil: (promise) => pending.push(promise) })
    await Promise.all(pending)
  }
  await fire('install')
  await fire('activate')

  expect(sw.skipWaiting).toHaveBeenCalledTimes(1)
  expect([...caches]).toEqual(['workbox-precache-v2-https://salvageunion.io/', 'pages'])
  expect(unregister).toHaveBeenCalledTimes(1)
  expect(navigate).toHaveBeenCalledWith('https://salvageunion.io/build/sheet/pilot/1')
})

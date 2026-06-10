/**
 * Cross-tab store-change notifications (plan 2.7, gap 16).
 *
 * Two ITUN tabs share one IndexedDB but keep independent Zustand caches —
 * without invalidation they silently overwrite each other. After every
 * successful write, the writing tab publishes the affected object-store name;
 * other tabs re-hydrate that store from IndexedDB.
 *
 * Transport: BroadcastChannel when available (same-origin tabs, message NOT
 * delivered to the posting context — no self-echo). Fallback: a localStorage
 * ping + `storage` events (also fires only in OTHER tabs). In non-browser
 * contexts (tests without either API) publishing is a no-op.
 */

import type { StoreName } from './stores'

const CHANNEL_NAME = 'itun-db'
const STORAGE_PING_KEY = 'itun-db-ping'

export type StoreChangeListener = (store: StoreName) => void

const listeners = new Set<StoreChangeListener>()

let channel: BroadcastChannel | null = null
let initialized = false

function notify(store: StoreName): void {
  for (const listener of listeners) {
    try {
      listener(store)
    } catch (err) {
      console.error('[itun-db] store-change listener threw', err)
    }
  }
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent) => {
      const store = (event.data as { store?: unknown } | null)?.store
      if (typeof store === 'string') notify(store as StoreName)
    }
    return
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key !== STORAGE_PING_KEY || event.newValue === null) return
      try {
        const parsed = JSON.parse(event.newValue) as { store?: unknown }
        if (typeof parsed.store === 'string') notify(parsed.store as StoreName)
      } catch {
        // Malformed ping — ignore.
      }
    })
  }
}

/** Announce that `store` changed in this tab. Other tabs re-hydrate it. */
export function publishStoreChange(store: StoreName): void {
  ensureInitialized()
  if (channel) {
    channel.postMessage({ store })
    return
  }
  if (typeof localStorage !== 'undefined') {
    try {
      // The nonce makes consecutive writes to the same store distinct so the
      // storage event fires every time.
      localStorage.setItem(STORAGE_PING_KEY, JSON.stringify({ store, nonce: Date.now() }))
    } catch {
      // Storage full/unavailable — cross-tab sync degrades gracefully.
    }
  }
}

/**
 * Subscribe to store changes made by OTHER tabs. Returns an unsubscribe
 * function. Listeners never fire for this tab's own writes.
 */
export function subscribeStoreChanges(listener: StoreChangeListener): () => void {
  ensureInitialized()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

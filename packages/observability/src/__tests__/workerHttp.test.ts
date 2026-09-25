import { afterEach, describe, expect, test } from 'bun:test'
import { BASE_SECURITY_HEADERS, edgeCache, IMMUTABLE_CACHE_CONTROL } from '../workerHttp'

const scope = globalThis as { caches?: unknown }
const original = Object.getOwnPropertyDescriptor(globalThis, 'caches')

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'caches', original)
  else delete scope.caches
})

describe('edgeCache', () => {
  test('is null where there is no `caches` global (bun test, not workerd)', () => {
    delete scope.caches
    expect(edgeCache()).toBeNull()
  })

  test('is null where `caches` exists but has no Cloudflare `default`', () => {
    Object.defineProperty(globalThis, 'caches', { value: {}, configurable: true, writable: true })
    expect(edgeCache()).toBeNull()
  })

  test("returns workerd's `caches.default`", () => {
    const fakeDefault = { put: () => Promise.resolve() }
    Object.defineProperty(globalThis, 'caches', {
      value: { default: fakeDefault },
      configurable: true,
      writable: true,
    })
    expect(edgeCache()).toBe(fakeDefault as unknown as Cache)
  })
})

describe('shared header constants', () => {
  test('the base set carries no CSP — that is per surface', () => {
    expect(Object.keys(BASE_SECURITY_HEADERS)).not.toContain('content-security-policy')
    expect(BASE_SECURITY_HEADERS['x-frame-options']).toBe('DENY')
    expect(BASE_SECURITY_HEADERS['strict-transport-security']).toContain('preload')
  })

  test('immutable cache-control is a year, immutable', () => {
    expect(IMMUTABLE_CACHE_CONTROL).toBe('public, max-age=31536000, immutable')
  })
})

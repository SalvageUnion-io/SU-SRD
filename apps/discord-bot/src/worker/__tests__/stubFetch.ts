import { afterEach } from 'bun:test'

/**
 * The input is spelled out rather than using `RequestInfo`: this app has no DOM
 * lib, so that name does not exist here — the same reason `verify.ts` declares
 * its own WebCrypto slice.
 */
type FetchHandler = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Call at a test file's top level: the real `fetch` comes back after each of
 * its tests, and the returned `stubFetch` replaces it for one test.
 */
export function withFetchStub(): (handler: FetchHandler) => void {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })
  return (handler) => {
    globalThis.fetch = handler as typeof fetch
  }
}

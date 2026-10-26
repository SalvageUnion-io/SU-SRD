/**
 * Run a test file's writes signed in and live.
 *
 * A write goes up only `live` (`sync.ts`), so every test that writes is a test
 * of the signed-in path: this publishes `live` before each test, and every
 * send in `outbox.ts` lands on the stand-in rooms the test preload installs
 * (`apps/web/test/roomsStub.ts`), and every Games call (a move's
 * `entities.move`, `roomCalls.ts`) on a stand-in Worker that answers null.
 *
 * The status is module state and Bun runs a workspace's test files in one
 * process, so the undo is installed with it: a file left live would make every
 * file after it run signed in without saying so.
 *
 * Call it once at the top level of a test file (or of a `describe`).
 */

import { afterEach, beforeEach } from 'bun:test'
import { ROOMS_CALL_PATH } from '../../rooms/routes'
import { resetSync, setSyncStatus } from '../sync'

export function withSignedInBackend(): void {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    setSyncStatus('live')
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === ROOMS_CALL_PATH
        ? new Response(JSON.stringify({ ok: true, value: null }))
        : realFetch(input, init)) as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    resetSync()
  })
}

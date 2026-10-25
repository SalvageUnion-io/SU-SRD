/**
 * Run a test file's writes signed in and live.
 *
 * A write goes up only `live` (`sync.ts`), so every test that writes is a test
 * of the signed-in path: this publishes `live` before each test, and every
 * send in `outbox.ts` lands on the stub client the test preload installs
 * (`apps/web/test/convexClientStub.ts`).
 *
 * The status is module state and Bun runs a workspace's test files in one
 * process, so the undo is installed with it: a file left live would make every
 * file after it run signed in without saying so.
 *
 * Call it once at the top level of a test file (or of a `describe`).
 */

import { afterEach, beforeEach } from 'bun:test'
import { resetSync, setSyncStatus } from '../sync'

export function withSignedInBackend(): void {
  beforeEach(() => {
    setSyncStatus('live')
  })
  afterEach(() => {
    resetSync()
  })
}

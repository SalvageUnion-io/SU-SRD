/**
 * Run a test file's store writes through the SIGNED-IN backend.
 *
 * ## Why this exists
 *
 * There is one place a write can land: `remote` — the IndexedDB cache in front
 * of the Convex server of record — for somebody signed in. An anonymous
 * visitor (`signedOut`, the test build's default) is read-only and reads
 * nothing, so every test that writes, rehydrates, or reads `db.*` back through
 * a store is by definition a test of the signed-in path.
 *
 * This pushes a settled, online, signed-in session, which resolves to
 * `remote`; every `commit*` in `entityBackend.ts` then lands on the stub client
 * the test preload installs (`apps/itun/test/convexClientStub.ts`). The result
 * is exactly "signed in, server commits stubbed" — the store, the cache and
 * hydration all run for real.
 *
 * ## Why it registers its own reset
 *
 * `setEntityBackendAuthState` writes module scope, and Bun runs a workspace's
 * test files in one process. Leaving a file signed in would make every file
 * after it silently exercise `remote` instead of the anonymous default — the
 * same leak `mock.module` causes, and just as quiet. So the undo is not
 * optional and not the caller's job: calling this installs both halves.
 *
 * Call it once at the top level of a test file (or of a `describe`).
 */

import { afterEach, beforeEach } from 'bun:test'
import { setEntityBackendAuthState } from '../entityBackend'

const ANONYMOUS = { signedIn: false, online: true, authSettled: true } as const

export function withSignedInBackend(): void {
  beforeEach(() => {
    setEntityBackendAuthState({
      signedIn: true,
      online: true,
      authSettled: true,
    })
  })
  afterEach(() => {
    setEntityBackendAuthState(ANONYMOUS)
  })
}

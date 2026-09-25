/**
 * Run a test file's store writes through the SIGNED-IN backend.
 *
 * ## Why this exists
 *
 * There are two places a write can land since the `local` backend was retired:
 * `memory` for an anonymous visitor, and `remote` — the IndexedDB cache in
 * front of the Convex server of record — for somebody signed in. Only the
 * second is durable, so every test that asserts a write survives a rehydrate,
 * a reset of the in-memory cache, or a direct read of `db.*` is by definition a
 * test of the signed-in path.
 *
 * The test build has no `VITE_CONVEX_URL`, so the real mode resolution can
 * never reach `connected`. This pushes `convexConfigured: true` alongside a
 * settled, online, signed-in session, which resolves to `remote`; with no
 * client compiled in, every `commit*` in `entityBackend.ts` then returns before
 * touching the network. The result is exactly "signed in, server commits
 * stubbed" — the store, the cache, hydration and cross-tab broadcast all run
 * for real.
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
      convexConfigured: true,
    })
  })
  afterEach(() => {
    setEntityBackendAuthState(ANONYMOUS)
  })
}

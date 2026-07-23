import { describe, expect, it } from 'bun:test'

import { initBrowserObservability } from '../observability'

describe('initBrowserObservability', () => {
  it('is a no-op that resolves when VITE_SENTRY_DSN is unset', async () => {
    // No DSN is configured in the test env, so this must resolve without
    // importing or initializing Sentry (and without throwing).
    expect(import.meta.env.VITE_SENTRY_DSN).toBeUndefined()
    await initBrowserObservability()
  })

  it('is idempotent across repeated calls', async () => {
    await initBrowserObservability()
    await initBrowserObservability()
  })
})

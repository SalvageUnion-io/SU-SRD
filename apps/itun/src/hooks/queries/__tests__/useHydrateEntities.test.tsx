/**
 * useHydrateOnMount tests (production incident 2026-07-09).
 *
 * The load-bearing guarantee: a rejected hydrator (e.g. a blocked or failed
 * IndexedDB open) must SURFACE to the nearest error boundary — in the app, the
 * router's RootErrorComponent recovery screen — rather than leaving the caller
 * on `false` (the loading skeleton) forever. Previously the hook had no error
 * branch, so a rejected hydrate hung the Dashboard silently.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Component } from 'react'
import { useHydrateOnMount } from '../useHydrateEntities'

// biome-ignore lint/style/useComponentExportOnlyModules: local test-only error boundary, no fast-refresh boundary here
class Boundary extends Component<{ children: ReactNode }, { caught: boolean; error: unknown }> {
  // Track "caught" separately from the value: a thrown `null`/`undefined` must
  // still show the fallback (mirrors why the hook uses a symbol sentinel).
  state: { caught: boolean; error: unknown } = { caught: false, error: null }
  static getDerivedStateFromError(error: unknown) {
    return { caught: true, error }
  }
  render() {
    if (this.state.caught) {
      const message = this.state.error instanceof Error ? this.state.error.message : 'non-error'
      return <div role="alert">caught: {message}</div>
    }
    return this.props.children
  }
}

// biome-ignore lint/style/useComponentExportOnlyModules: local test-only probe component
function Probe({ hydrate }: { hydrate: () => Promise<unknown> }) {
  const hydrated = useHydrateOnMount(hydrate)
  return <div>{hydrated ? 'ready' : 'loading'}</div>
}

afterEach(cleanup)

describe('useHydrateOnMount', () => {
  test('flips to ready when the hydrator resolves', async () => {
    render(
      <Boundary>
        <Probe hydrate={() => Promise.resolve()} />
      </Boundary>
    )
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy())
  })

  test('a rejected hydrator surfaces to the error boundary instead of loading forever', async () => {
    // React logs the caught error to console.error; silence the expected noise.
    const originalError = console.error
    console.error = () => {}
    try {
      render(
        <Boundary>
          <Probe hydrate={() => Promise.reject(new Error('db open failed'))} />
        </Boundary>
      )
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
      expect(screen.getByText(/db open failed/)).toBeTruthy()
    } finally {
      console.error = originalError
    }
  })

  test('even a null rejection surfaces (sentinel guard), never a silent skeleton', async () => {
    const originalError = console.error
    console.error = () => {}
    try {
      render(
        <Boundary>
          <Probe hydrate={() => Promise.reject(null)} />
        </Boundary>
      )
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    } finally {
      console.error = originalError
    }
  })
})

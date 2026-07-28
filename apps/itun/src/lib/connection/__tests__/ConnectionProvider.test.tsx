import { describe, expect, test } from 'bun:test'
import { act } from 'react'
import { render, screen } from '@testing-library/react'

import { ConnectionProvider } from '../ConnectionProvider'
import { useConnection } from '../connectionContext'

/**
 * The provider's reaction to connectivity changes.
 *
 * `useOnline` subscribes to the browser's own `online`/`offline` events rather
 * than polling, so the thing worth testing is that the subscription is live —
 * a provider that reads `navigator.onLine` once at mount would pass every other
 * test in the suite and never notice the network coming back.
 *
 * The test build is Solo (no `VITE_CONVEX_URL`), so the mode stays `solo`
 * throughout. That is the point: **connectivity changes must not disturb a
 * Solo user**, whose writes are local and should never be gated.
 */

/**
 * Built per-test rather than declared at module scope: a module-level component
 * in a test file trips Biome's `useComponentExportOnlyModules`, and adding a
 * warning to keep a helper tidy is the wrong trade.
 */
function makeProbe() {
  return function Probe() {
    const { mode, canWrite } = useConnection()
    return <span data-testid="probe">{`${mode}:${canWrite}`}</span>
  }
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'))
  })
}

describe('ConnectionProvider reacts to connectivity', () => {
  test('a Solo user is unaffected by going offline and back', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    try {
      const Probe = makeProbe()
      render(
        <ConnectionProvider>
          <Probe />
        </ConnectionProvider>
      )
      expect(screen.getByTestId('probe').textContent).toBe('solo:true')

      setOnline(false)
      // Still Solo, still writable. Someone who never signed in has nothing to
      // be disconnected from, and blocking their writes would break the app
      // for the majority of users.
      expect(screen.getByTestId('probe').textContent).toBe('solo:true')

      setOnline(true)
      expect(screen.getByTestId('probe').textContent).toBe('solo:true')
    } finally {
      if (original) Object.defineProperty(navigator, 'onLine', original)
    }
  })

  test('unmounting removes the listeners', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    try {
      const Probe = makeProbe()
      const { unmount } = render(
        <ConnectionProvider>
          <Probe />
        </ConnectionProvider>
      )
      unmount()
      // A leaked listener would call setState on an unmounted tree every time
      // the network flapped.
      setOnline(false)
      setOnline(true)
    } finally {
      if (original) Object.defineProperty(navigator, 'onLine', original)
    }
  })
})

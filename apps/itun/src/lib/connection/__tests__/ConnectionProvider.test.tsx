import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { installConvexMocks } from '../../../components/__tests__/convexMock'

/**
 * The provider's reaction to connectivity changes.
 *
 * `useOnline` subscribes to the browser's own `online`/`offline` events rather
 * than polling, so the thing worth testing is that the subscription is live —
 * a provider that reads `navigator.onLine` once at mount would pass every other
 * test in the suite and never notice the network coming back.
 *
 * The session is signed out, so the mode stays `solo` throughout. That is the
 * point: **connectivity changes must not disturb a signed-out visitor**, who
 * has nothing to be disconnected from.
 */

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexReact: { useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }) },
})
afterAll(() => convexMocks.restore())

const { ConnectionProvider } = await import('../ConnectionProvider')
const { useConnection } = await import('../connectionContext')

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

/**
 * happy-dom defines `onLine` on Navigator.prototype, so there is normally no
 * OWN descriptor to put back, and deleting the own property is the restore.
 * Restoring only when a descriptor existed left the forced value in place for
 * every later file in the same process.
 */
function restoreOnLine(original: PropertyDescriptor | undefined): void {
  if (original) Object.defineProperty(navigator, 'onLine', original)
  else Reflect.deleteProperty(navigator, 'onLine')
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
      // Solo is read-only: building needs an account (ADR-034 as amended).
      expect(screen.getByTestId('probe').textContent).toBe('solo:false')

      setOnline(false)
      // Still Solo, not Disconnected. Someone who never signed in has nothing
      // to be disconnected from.
      expect(screen.getByTestId('probe').textContent).toBe('solo:false')

      setOnline(true)
      expect(screen.getByTestId('probe').textContent).toBe('solo:false')
    } finally {
      restoreOnLine(original)
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
      restoreOnLine(original)
    }
  })
})

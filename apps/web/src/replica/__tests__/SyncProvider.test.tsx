import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { installServerMocks } from '../../components/__tests__/serverMock'

/**
 * `SyncProvider`: the one status, worked out from the session and the
 * browser's own `online`/`offline` events, published to the tree and to the
 * replica's writers.
 *
 * The subscription is what is worth testing: a provider that read
 * `navigator.onLine` once at mount would pass every other test and never
 * notice the network coming back.
 */

let auth = { isAuthenticated: false, isLoading: false }

// Module scope, before the imports below: see `serverMock.ts`.
const serverMocks = await installServerMocks({
  authReact: { useSession: () => auth },
})
afterAll(() => serverMocks.restore())

const { SyncProvider } = await import('../SyncProvider')
const { useSync } = await import('../syncContext')
const { resetSync, syncStatus } = await import('../sync')

afterEach(() => {
  auth = { isAuthenticated: false, isLoading: false }
  resetSync()
})

/** Built per test: a module-level component trips Biome's export-only rule. */
function makeProbe() {
  return function Probe() {
    const { status, canWrite } = useSync()
    return <span data-testid="probe">{`${status}:${canWrite}`}</span>
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
 * own descriptor to put back, and deleting the own property is the restore.
 */
function withOnLine(run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(navigator, 'onLine')
  try {
    run()
  } finally {
    if (original) Object.defineProperty(navigator, 'onLine', original)
    else Reflect.deleteProperty(navigator, 'onLine')
  }
}

const probe = () => screen.getByTestId('probe').textContent

describe('SyncProvider', () => {
  test('a signed-out visitor is unaffected by going offline and back', () => {
    withOnLine(() => {
      const Probe = makeProbe()
      render(
        <SyncProvider>
          <Probe />
        </SyncProvider>
      )
      // Signed out is read-only: building needs an account (ADR-034 as amended).
      expect(probe()).toBe('signedOut:false')
      setOnline(false)
      expect(probe()).toBe('signedOut:false')
      setOnline(true)
      expect(probe()).toBe('signedOut:false')
    })
  })

  test('signed in, the status follows the network, and the writers hear it', () => {
    auth = { isAuthenticated: true, isLoading: false }
    withOnLine(() => {
      const Probe = makeProbe()
      render(
        <SyncProvider>
          <Probe />
        </SyncProvider>
      )
      expect(probe()).toBe('live:true')
      expect(syncStatus()).toBe('live')

      setOnline(false)
      expect(probe()).toBe('offline:false')
      expect(syncStatus()).toBe('offline')

      setOnline(true)
      expect(probe()).toBe('live:true')
    })
  })

  test('unmounting removes the listeners', () => {
    withOnLine(() => {
      const Probe = makeProbe()
      const { unmount } = render(
        <SyncProvider>
          <Probe />
        </SyncProvider>
      )
      unmount()
      // A leaked listener would set state on an unmounted tree each flap.
      setOnline(false)
      setOnline(true)
    })
  })
})

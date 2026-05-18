/**
 * Tests for PublishButton.
 *
 * Dep-injection pattern (no mock.module()):
 *   - `publishFn` replaces publishSnapshot
 *   - `entityStore` replaces the real Zustand store
 *
 * Conventions:
 *   - toBeTruthy() / toBeFalsy() — not toBeInTheDocument()
 *   - No mock.module()
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { PublishButton } from '../PublishButton'
import type { EntityLookup } from '../Sheet'
import type { PublishResult, SnapshotPayload } from '../../../lib/snapshot/client'
import type { Pilot } from '../../../lib/schemas/pilot'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['scavenge'],
  equipment: ['pistol'],
  rollResults: [],
  motto: 'Waste not.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeEntityStore(pilot: Pilot | null): EntityLookup {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (_type, id) => (id === pilot?.id ? (pilot as any) : null),
  }
}

function makePublishFn(
  result: PublishResult
): (payload: SnapshotPayload) => Promise<PublishResult> {
  return mock(async () => result)
}

function makeFailPublishFn(message: string): (payload: SnapshotPayload) => Promise<PublishResult> {
  return mock(async () => {
    throw new Error(message)
  })
}

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('PublishButton — rendering', () => {
  test('renders Share button', () => {
    render(
      <PublishButton
        entityKind="pilot"
        entityId="pilot-1"
        entityStore={makeEntityStore(fakePilot)}
        publishFn={makePublishFn({ id: 'abc', url: '/api/snapshots/abc' })}
      />
    )
    expect(screen.getByRole('button', { name: /publish snapshot/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Success flow
// ---------------------------------------------------------------------------

describe('PublishButton — success flow', () => {
  test('calls publishFn on click and opens ShareURLDialog', async () => {
    const publishFn = makePublishFn({ id: 'abc123', url: '/api/snapshots/abc123' })

    render(
      <PublishButton
        entityKind="pilot"
        entityId="pilot-1"
        entityStore={makeEntityStore(fakePilot)}
        publishFn={publishFn}
      />
    )

    const btn = screen.getByRole('button', { name: /publish snapshot/i })

    await act(async () => {
      fireEvent.click(btn)
    })

    // publishFn should have been called once
    expect(publishFn).toHaveBeenCalledTimes(1)

    // ShareURLDialog appears with the constructed URL
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })
  })

  test('ShareURLDialog shows share URL containing the snapshot id', async () => {
    // Stub window.location.origin — happy-dom sets it to 'about:blank' by default;
    // we override via Object.defineProperty for the duration of this test.
    const originalOrigin = window.location.origin
    Object.defineProperty(window, 'location', {
      value: { ...window.location, origin: 'https://example.com' },
      configurable: true,
    })

    const publishFn = makePublishFn({ id: 'xyz99', url: '/api/snapshots/xyz99' })

    render(
      <PublishButton
        entityKind="pilot"
        entityId="pilot-1"
        entityStore={makeEntityStore(fakePilot)}
        publishFn={publishFn}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    await waitFor(() => {
      const urlEl = screen.getByLabelText('Share URL')
      expect((urlEl as HTMLElement).textContent).toContain('xyz99')
    })

    // Restore
    Object.defineProperty(window, 'location', {
      value: { ...window.location, origin: originalOrigin },
      configurable: true,
    })
  })
})

// ---------------------------------------------------------------------------
// Error flow
// ---------------------------------------------------------------------------

describe('PublishButton — error flow', () => {
  test('shows error message when publishFn throws', async () => {
    const publishFn = makeFailPublishFn('network timeout')

    render(
      <PublishButton
        entityKind="pilot"
        entityId="pilot-1"
        entityStore={makeEntityStore(fakePilot)}
        publishFn={publishFn}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeTruthy()
      expect((alert as HTMLElement).textContent).toContain('network timeout')
    })
  })

  test('shows error when entity is not found in store', async () => {
    const publishFn = makePublishFn({ id: 'abc', url: '/api/snapshots/abc' })
    const emptyStore = makeEntityStore(null)

    render(
      <PublishButton
        entityKind="pilot"
        entityId="pilot-1"
        entityStore={emptyStore}
        publishFn={publishFn}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect((alert as HTMLElement).textContent).toContain('Entity not found')
    })

    // publishFn should NOT have been called (guard fired before publish)
    expect(publishFn).toHaveBeenCalledTimes(0)
  })
})

// ---------------------------------------------------------------------------
// Dialog dismissal
// ---------------------------------------------------------------------------

describe('PublishButton — dialog dismissal', () => {
  test('closes ShareURLDialog when Close is clicked', async () => {
    const publishFn = makePublishFn({ id: 'abc', url: '/api/snapshots/abc' })

    render(
      <PublishButton
        entityKind="pilot"
        entityId="pilot-1"
        entityStore={makeEntityStore(fakePilot)}
        publishFn={publishFn}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /close/i }))
    })

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

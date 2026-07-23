/**
 * Tests for ShareSnapshotScreen (design §3.4, plan 5.2).
 *
 * Dep-injection pattern (no mock.module()):
 *   - `entityStore` replaces the real Zustand store
 *   - `publishFn` replaces publishSnapshot
 *   - `probeFn` replaces probeSnapshotService (S6 feature-detect)
 *   - `clipboardWriter` replaces navigator.clipboard.writeText
 *
 * Conventions:
 *   - toBeTruthy() / toBeFalsy() — not toBeInTheDocument()
 *   - AppLink degrades to <a href> without a router
 */

import { afterEach, beforeAll, describe, expect, mock, type Mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { ShareSnapshotScreen } from '../ShareSnapshotScreen'
import type { EntityLookup } from '../composition'
import type { PublishResult, SnapshotPayload } from '../../../lib/snapshot/client'
import { recordPublishedSnapshot } from '../../../lib/snapshot/publishedSnapshots'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { makeEntityLookupMock } from '../../__tests__/mockEntityStore'

// Preload chassis data so the mech preview can resolve chassis stats
beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis'])
})

afterEach(() => {
  // The publish flow now records the shared link in localStorage — clear it so
  // the revoke-ledger never leaks between tests.
  localStorage.clear()
  cleanup()
})

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Mara Vex',
  callsign: 'Wrench',
  classRef: 'engineer',
  abilities: [],
  equipment: [],
  motto: 'Hold the line.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMech: Mech = {
  id: 'mech-1',
  schemaVersion: 1,
  name: 'Iron Jaw',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeEntityStore(entities: Array<Pilot | Mech>): EntityLookup {
  return makeEntityLookupMock(entities)
}

const probeUp = () => Promise.resolve(true)
const probeDown = () => Promise.resolve(false)

function makePublishFn(
  result: PublishResult
): Mock<(payload: SnapshotPayload) => Promise<PublishResult>> {
  return mock(async (_payload: SnapshotPayload) => result)
}

// ---------------------------------------------------------------------------
// Layout — §3.4 surfaces
// ---------------------------------------------------------------------------

describe('ShareSnapshotScreen — layout', () => {
  test('renders preview panel with the entity name in the read-only card', async () => {
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeUp}
        publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
      />
    )
    expect(screen.getByRole('heading', { name: /snapshot preview/i })).toBeTruthy()
    expect(screen.getAllByText(/Mara Vex/).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /publish snapshot/i })).toBeTruthy()
    })
  })

  test('back link returns to the sheet view', async () => {
    // render inside act so the probe effect's setState resolves cleanly
    await act(async () => {
      render(
        <ShareSnapshotScreen
          kind="pilot"
          id="pilot-1"
          entityStore={makeEntityStore([fakePilot])}
          probeFn={probeUp}
          publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
        />
      )
    })
    const back = screen.getByRole('link', { name: /back to mara vex/i })
    expect(back.getAttribute('href')).toBe('/sheet/pilot/pilot-1')
  })

  test('renders QR panel and a print link to the sheet view', async () => {
    await act(async () => {
      render(
        <ShareSnapshotScreen
          kind="mech"
          id="mech-1"
          entityStore={makeEntityStore([fakeMech])}
          probeFn={probeUp}
          publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
        />
      )
    })
    expect(screen.getByRole('heading', { name: /qr code/i })).toBeTruthy()
    // Pre-publish the panel shows the generate hint; 'Scan to open' appears
    // only once a share URL exists (audit item 14).
    expect(screen.getByText(/publish to generate a qr code/i)).toBeTruthy()
    const printLink = screen.getByRole('link', { name: /open print view/i })
    expect(printLink.getAttribute('href')).toBe('/sheet/mech/mech-1')
  })

  test('renders Nothing-to-share state when the entity is missing', async () => {
    await act(async () => {
      render(
        <ShareSnapshotScreen
          kind="pilot"
          id="ghost"
          entityStore={makeEntityStore([])}
          probeFn={probeUp}
          publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
        />
      )
    })
    expect(screen.getByRole('heading', { name: /nothing to share/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Publish flow
// ---------------------------------------------------------------------------

describe('ShareSnapshotScreen — publish flow', () => {
  test('publishes a bare-entity payload and fills the share URL input', async () => {
    const publishFn = makePublishFn({
      id: 'abc123',
      url: '/api/snapshots/abc123',
    })
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeUp}
        publishFn={publishFn}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>('button', {
          name: /publish snapshot/i,
        }).disabled
      ).toBe(false)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    expect(publishFn).toHaveBeenCalledTimes(1)
    const firstCall = publishFn.mock.calls[0]
    if (!firstCall) throw new Error('publishFn was not called')
    const [payload] = firstCall
    expect(payload.kind).toBe('pilot')
    expect((payload.entity as Pilot).id).toBe('pilot-1')

    await waitFor(() => {
      const input = screen.getByLabelText<HTMLInputElement>('Share URL')
      expect(input.value).toContain('/s/abc123')
    })
  })

  test('copy button is disabled until published, then copies the URL', async () => {
    const writes: string[] = []
    const clipboardWriter = async (text: string) => {
      writes.push(text)
    }
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeUp}
        publishFn={makePublishFn({ id: 'xyz99', url: '/api/snapshots/xyz99' })}
        clipboardWriter={clipboardWriter}
      />
    )

    const copyBtn = screen.getByRole<HTMLButtonElement>('button', {
      name: /copy share url/i,
    })
    expect(copyBtn.disabled).toBe(true)

    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>('button', {
          name: /publish snapshot/i,
        }).disabled
      ).toBe(false)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    await waitFor(() => {
      expect(copyBtn.disabled).toBe(false)
    })
    await act(async () => {
      fireEvent.click(copyBtn)
    })
    expect(writes.length).toBe(1)
    expect(writes[0]).toContain('/s/xyz99')
  })

  test('shows a styled error when publish fails', async () => {
    const publishFn = mock(async () => {
      throw new Error('network timeout')
    })
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeUp}
        publishFn={publishFn}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>('button', {
          name: /publish snapshot/i,
        }).disabled
      ).toBe(false)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('network timeout')
    })
  })
})

// ---------------------------------------------------------------------------
// Revoke / un-publish (FIX #10)
// ---------------------------------------------------------------------------

describe('ShareSnapshotScreen — revoke / un-publish', () => {
  test('publishing records the link and reveals a Remove affordance', async () => {
    const publishFn = makePublishFn({ id: 'REV00001', url: '/api/snapshots/REV00001' })
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeUp}
        publishFn={publishFn}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: /publish snapshot/i }).disabled
      ).toBe(false)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    expect(await screen.findByRole('heading', { name: /shared links/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /remove shared link REV00001/i })).toBeTruthy()
  })

  test('Remove calls the delete fn and drops the link from the panel', async () => {
    const deleteFn = mock(async (_id: string) => {})
    const publishFn = makePublishFn({ id: 'REV00002', url: '/api/snapshots/REV00002' })
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeUp}
        publishFn={publishFn}
        deleteFn={deleteFn}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: /publish snapshot/i }).disabled
      ).toBe(false)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    const removeBtn = await screen.findByRole('button', {
      name: /remove shared link REV00002/i,
    })
    await act(async () => {
      fireEvent.click(removeBtn)
    })

    expect(deleteFn).toHaveBeenCalledTimes(1)
    expect(deleteFn.mock.calls[0]?.[0]).toBe('REV00002')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /remove shared link REV00002/i })).toBeNull()
    })
  })

  test('surfaces previously-tracked links for this entity on mount', async () => {
    recordPublishedSnapshot({
      id: 'PRIOR001',
      kind: 'pilot',
      entityId: 'pilot-1',
      name: 'Mara Vex',
      publishedAt: new Date().toISOString(),
    })
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeUp}
        publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
      />
    )
    expect(await screen.findByRole('button', { name: /remove shared link PRIOR001/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// S6 feature-detect
// ---------------------------------------------------------------------------

describe('ShareSnapshotScreen — backend feature-detect (S6)', () => {
  test('Publish is disabled while the probe is in flight', () => {
    // A probe that never resolves keeps the screen in the checking state.
    const pendingProbe = () => new Promise<boolean>(() => {})
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={pendingProbe}
        publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
      />
    )
    const btn = screen.getByRole<HTMLButtonElement>('button', {
      name: /publish snapshot/i,
    })
    expect(btn.disabled).toBe(true)
  })

  test('hides Publish and shows the unavailable note when the service is down', async () => {
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeDown}
        publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
      />
    )

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /publish snapshot/i })).toBeNull()
    })
    const note = screen.getByRole('note')
    expect(note.textContent).toContain('Publishing unavailable')
    expect(note.getAttribute('title')).toContain('/api/snapshots')
  })
})

// ---------------------------------------------------------------------------
// QR code (audit item 14): a real QR renders once a share URL exists;
// before publish the decorative placeholder + hint copy show instead.
// ---------------------------------------------------------------------------

describe('ShareSnapshotScreen — QR code', () => {
  test('pre-publish: placeholder only, no QR image', async () => {
    await act(async () => {
      render(
        <ShareSnapshotScreen
          kind="pilot"
          id="pilot-1"
          entityStore={makeEntityStore([fakePilot])}
          probeFn={probeUp}
          publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
        />
      )
    })
    expect(screen.queryByTestId('snapshot-qr')).toBeNull()
    expect(screen.getByText('Publish to generate a QR code')).toBeTruthy()
  })

  test('after publish: renders the QR image labeled for screen readers', async () => {
    render(
      <ShareSnapshotScreen
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        probeFn={probeUp}
        publishFn={makePublishFn({ id: 'snap-qr-1', url: '/api/snapshots/snap-qr-1' })}
      />
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /publish snapshot/i })).toBeTruthy()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })
    const qr = await screen.findByTestId('snapshot-qr')
    expect(qr.getAttribute('role')).toBe('img')
    expect(qr.getAttribute('aria-label')).toBe('QR code linking to this snapshot')
    await waitFor(() => {
      expect(qr.querySelector('svg')).not.toBeNull()
    })
  })
})

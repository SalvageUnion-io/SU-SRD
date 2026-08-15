/**
 * Tests for ShareStatusDialog — the share affordance that replaced the
 * `/sheet/:kind/:id/share` screen.
 *
 * Ported from ShareSnapshotScreen.test.tsx. What carried over is everything
 * about the SNAPSHOT contract — publish payload, share URL, copy, QR, revoke
 * ledger, feature-detect. What did not: the preview-panel, back-link and
 * nothing-to-share assertions, all of which described surfaces the dialog
 * deliberately does not have (the live sheet behind it is the preview, and
 * `Sheet` already owns the not-found state). The QR kept its behaviour and
 * lost its panel.
 *
 * One assertion is NEW and is the reason the probe moved behind `open`: a
 * closed dialog must not touch the network, because unlike the old screen this
 * one is mounted by every live sheet.
 *
 * Dep-injection throughout (no mock.module()): publishFn, deleteFn, probeFn and
 * clipboardWriter are all props.
 */

import type { Mock } from 'bun:test'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { PublishResult, SnapshotPayload } from '../../../lib/snapshot/client'
import { recordPublishedSnapshot } from '../../../lib/snapshot/publishedSnapshots'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { ShareStatusDialog } from '../ShareStatusDialog'

afterEach(() => {
  // The publish flow records the shared link in localStorage — clear it so the
  // revoke ledger never leaks between tests.
  localStorage.clear()
  cleanup()
})

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
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

const probeUp = () => Promise.resolve(true)
const probeDown = () => Promise.resolve(false)

function makePublishFn(
  result: PublishResult
): Mock<(payload: SnapshotPayload) => Promise<PublishResult>> {
  return mock(async (_payload: SnapshotPayload) => result)
}

/** The dialog under test, open, with the injectables defaulted. */
function renderDialog(
  props: Partial<React.ComponentProps<typeof ShareStatusDialog>> = {}
): ReturnType<typeof render> {
  return render(
    <ShareStatusDialog
      kind="pilot"
      id="pilot-1"
      entity={fakePilot}
      open
      onOpenChange={() => {}}
      probeFn={probeUp}
      publishFn={makePublishFn({ id: 'a', url: '/api/snapshots/a' })}
      {...props}
    />
  )
}

const publishButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /publish/i })

async function waitForProbe(): Promise<void> {
  await waitFor(() => {
    expect(publishButton().disabled).toBe(false)
  })
}

// ---------------------------------------------------------------------------
// Status — the thing the dialog is named for
// ---------------------------------------------------------------------------

describe('ShareStatusDialog — status', () => {
  test('reads "Not shared" with no published links', async () => {
    await act(async () => {
      renderDialog()
    })
    expect(screen.getByText(/not shared/i)).toBeTruthy()
  })

  test('counts existing links for this entity, and offers to revoke each', async () => {
    recordPublishedSnapshot({
      id: 'PRIOR001',
      kind: 'pilot',
      entityId: 'pilot-1',
      name: 'Mara Vex',
      publishedAt: FIXTURE_NOW,
    })
    await act(async () => {
      renderDialog()
    })
    expect(screen.getByText(/shared — 1 live link/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /remove shared link PRIOR001/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Publish flow
// ---------------------------------------------------------------------------

describe('ShareStatusDialog — publish flow', () => {
  test('publishes a bare-entity payload and reveals the share URL', async () => {
    const publishFn = makePublishFn({ id: 'abc123', url: '/api/snapshots/abc123' })
    renderDialog({ publishFn })

    await waitForProbe()
    await act(async () => {
      fireEvent.click(publishButton())
    })

    expect(publishFn).toHaveBeenCalledTimes(1)
    const firstCall = publishFn.mock.calls[0]
    if (!firstCall) throw new Error('publishFn was not called')
    const [payload] = firstCall
    expect(payload.kind).toBe('pilot')
    expect((payload.entity as Pilot).id).toBe('pilot-1')
    // No pilot abilities were passed, so no context rides along.
    expect(payload.context).toBeUndefined()

    await waitFor(() => {
      const input = screen.getByLabelText<HTMLInputElement>('Share URL')
      expect(input.value).toContain('/s/abc123')
    })
  })

  /**
   * The regression the old preview panel hid rather than caused: a mech's
   * numbers depend on its pilot's abilities (ADR-029), so they must travel with
   * the snapshot or the shared mech reads lower than the owner's.
   */
  test('carries pilot ability refs as snapshot context when given them', async () => {
    const publishFn = makePublishFn({ id: 'ctx1', url: '/api/snapshots/ctx1' })
    renderDialog({ publishFn, pilotAbilities: ['beefcake'] })

    await waitForProbe()
    await act(async () => {
      fireEvent.click(publishButton())
    })

    expect(publishFn.mock.calls[0]?.[0].context).toEqual({ pilotAbilities: ['beefcake'] })
  })

  test('copies the URL once published', async () => {
    const writes: string[] = []
    renderDialog({
      publishFn: makePublishFn({ id: 'xyz99', url: '/api/snapshots/xyz99' }),
      clipboardWriter: async (text: string) => {
        writes.push(text)
      },
    })

    // Nothing to copy before publishing, so the control is not there to press.
    expect(screen.queryByRole('button', { name: /copy share url/i })).toBeNull()

    await waitForProbe()
    await act(async () => {
      fireEvent.click(publishButton())
    })

    const copyBtn = await screen.findByRole('button', { name: /copy share url/i })
    await act(async () => {
      fireEvent.click(copyBtn)
    })
    expect(writes.length).toBe(1)
    expect(writes[0]).toContain('/s/xyz99')
  })

  /**
   * The QR outlived the share screen because passing a phone across a table is
   * the actual use. It lost the panel, the heading and the placeholder — it is
   * simply absent until there is a link to encode.
   */
  test('renders a QR of the link, and only once there is one', async () => {
    renderDialog({ publishFn: makePublishFn({ id: 'snapqr1', url: '/api/snapshots/snapqr1' }) })

    await waitForProbe()
    expect(screen.queryByTestId('snapshot-qr')).toBeNull()

    await act(async () => {
      fireEvent.click(publishButton())
    })

    const qr = await screen.findByTestId('snapshot-qr')
    expect(qr.getAttribute('role')).toBe('img')
    expect(qr.getAttribute('aria-label')).toBe('QR code linking to this snapshot')
    await waitFor(() => {
      expect(qr.querySelector('svg')).not.toBeNull()
    })
  })

  test('shows a styled error when publish fails', async () => {
    renderDialog({
      publishFn: mock(async () => {
        throw new Error('network timeout')
      }),
    })

    await waitForProbe()
    await act(async () => {
      fireEvent.click(publishButton())
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('network timeout')
    })
  })
})

// ---------------------------------------------------------------------------
// Revoke / un-publish
// ---------------------------------------------------------------------------

describe('ShareStatusDialog — revoke', () => {
  test('publishing records the link and reveals a Remove affordance', async () => {
    renderDialog({ publishFn: makePublishFn({ id: 'REV00001', url: '/api/snapshots/REV00001' }) })

    await waitForProbe()
    await act(async () => {
      fireEvent.click(publishButton())
    })

    expect(await screen.findByRole('button', { name: /remove shared link REV00001/i })).toBeTruthy()
  })

  test('Remove calls the delete fn and drops the link', async () => {
    const deleteFn = mock(async (_id: string) => {})
    renderDialog({
      publishFn: makePublishFn({ id: 'REV00002', url: '/api/snapshots/REV00002' }),
      deleteFn,
    })

    await waitForProbe()
    await act(async () => {
      fireEvent.click(publishButton())
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
})

// ---------------------------------------------------------------------------
// Backend feature-detect
// ---------------------------------------------------------------------------

describe('ShareStatusDialog — backend feature-detect', () => {
  /**
   * NEW, and the reason the probe is gated on `open`. This dialog is mounted by
   * every live sheet; probing on mount would put a request on the app's
   * most-visited surface for a feature most visits never touch.
   */
  test('does not probe while closed', async () => {
    const probeFn = mock(async () => true)
    await act(async () => {
      renderDialog({ open: false, probeFn })
    })
    expect(probeFn).toHaveBeenCalledTimes(0)
  })

  test('Publish is disabled while the probe is in flight', () => {
    // A probe that never resolves holds the dialog in the checking state.
    renderDialog({ probeFn: () => new Promise<boolean>(() => {}) })
    expect(publishButton().disabled).toBe(true)
  })

  test('hides Publish and shows the unavailable note when the service is down', async () => {
    renderDialog({ probeFn: probeDown })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /publish/i })).toBeNull()
    })
    const note = screen.getByRole('note')
    expect(note.textContent).toContain('Publishing unavailable')
    expect(note.getAttribute('title')).toContain('/api/snapshots')
  })
})

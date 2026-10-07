/**
 * ShareStatusDialog outside Connected — the share affordance that replaced the
 * `/sheet/:kind/:id/share` screen.
 *
 * Snapshots are retired (ADR-036): the dialog no longer publishes, lists or
 * revokes them, and must not offer to. The live public sheet is the only way to
 * share, and it needs an account and a connection, so outside Connected the
 * dialog explains what sharing needs instead. The Connected half — the toggle,
 * the link, the QR — is `ShareStatusDialog.connected.test.tsx`.
 *
 * No Convex provider and no mock here: that is the point. The panel that calls
 * Convex hooks must not mount, or this file would throw.
 */

import { describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { ConnectionContext } from '../../../lib/connection/connectionContext'
import type { Pilot } from '../../../lib/schemas/pilot'
import { pilotFixture } from '../../__tests__/fixtures'
import { ShareStatusDialog } from '../ShareStatusDialog'

const fakePilot: Pilot = pilotFixture({ id: 'pilot-1', name: 'Mara Vex' })

function renderDialog(state?: ConnectionState): ReturnType<typeof render> {
  const dialog = (
    <ShareStatusDialog kind="pilot" id="pilot-1" entity={fakePilot} open onOpenChange={() => {}} />
  )
  return render(
    state ? <ConnectionContext.Provider value={state}>{dialog}</ConnectionContext.Provider> : dialog
  )
}

describe('ShareStatusDialog — snapshots are gone', () => {
  test('offers no way to mint, copy or revoke a snapshot', async () => {
    await act(async () => {
      renderDialog()
    })

    expect(screen.queryByRole('button', { name: /publish snapshot/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /publish a new link/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /remove shared link/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /frozen snapshot/i })).toBeNull()
    expect(screen.queryByLabelText('Share URL')).toBeNull()
    expect(screen.queryByTestId('share-qr')).toBeNull()
  })

  test('still promises read-only, whichever branch renders', async () => {
    await act(async () => {
      renderDialog()
    })
    expect(screen.getByText(/read-only view of Mara Vex/i)).toBeTruthy()
  })
})

describe('ShareStatusDialog — Solo', () => {
  test('says sharing needs an account, rather than offering a control that cannot work', async () => {
    // No provider at all is Solo (`SOLO_STATE`), the anonymous visitor.
    await act(async () => {
      renderDialog()
    })
    expect(screen.getByText(/sharing needs an account/i)).toBeTruthy()
    // The live panel is Convex-backed and must not mount here.
    expect(screen.queryByRole('heading', { name: /live public sheet/i })).toBeNull()
  })
})

describe('ShareStatusDialog — signed in but not connected', () => {
  test('says sharing needs a live connection', async () => {
    await act(async () => {
      renderDialog({
        mode: 'disconnected',
        canWrite: false,
        showDisconnectedWarning: true,
        settling: false,
      })
    })
    expect(screen.getByText(/need a live connection/i)).toBeTruthy()
    expect(screen.queryByText(/sharing needs an account/i)).toBeNull()
  })
})

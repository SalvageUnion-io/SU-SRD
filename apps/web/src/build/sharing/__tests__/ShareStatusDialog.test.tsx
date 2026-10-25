/**
 * ShareStatusDialog outside Connected — the share affordance.
 *
 * There are no snapshots (ADR-036): the dialog must not offer to publish, list
 * or revoke one. The live public sheet is the only way to
 * share, and it needs an account and a connection, so outside Connected the
 * dialog explains what sharing needs instead. The Connected half — who can see
 * it, the link, the QR — is `ShareStatusDialog.connected.test.tsx`.
 *
 * No query is answered here: the panel that reads Convex must not mount, or
 * the query mock would throw.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `convexMock.ts`. The signed-out
// branch mounts `SignInControl`, whose auth hook needs the auth module.
const convexMocks = await installConvexMocks({ authReact: true })
setQueryAnswers({})
afterAll(() => convexMocks.restore())

const { SyncContext } = await import('../../../replica/syncContext')
const { ShareStatusDialog } = await import('../ShareStatusDialog')

function renderDialog(state?: SyncState): ReturnType<typeof render> {
  const dialog = (
    <ShareStatusDialog kind="pilot" id="pilot-1" name="Mara Vex" open onOpenChange={() => {}} />
  )
  return render(
    state ? <SyncContext.Provider value={state}>{dialog}</SyncContext.Provider> : dialog
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
    expect(screen.getByText(/whoever can see Mara Vex gets a read-only view/i)).toBeTruthy()
  })
})

describe('ShareStatusDialog — Solo', () => {
  test('says sharing needs an account, rather than offering a control that cannot work', async () => {
    // No provider at all is Solo (`SIGNED_OUT`), the anonymous visitor.
    await act(async () => {
      renderDialog()
    })
    expect(screen.getByText(/sharing needs an account/i)).toBeTruthy()
    // The settings are Convex-backed and must not mount here.
    expect(screen.queryByRole('group', { name: /who can see it/i })).toBeNull()
  })
})

describe('ShareStatusDialog — signed in but not connected', () => {
  test('says sharing needs a live connection', async () => {
    await act(async () => {
      renderDialog({
        status: 'offline',
        canWrite: false,
        outdated: false,
      })
    })
    expect(screen.getByText(/need a live connection/i)).toBeTruthy()
    expect(screen.queryByText(/sharing needs an account/i)).toBeNull()
  })
})

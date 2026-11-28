/**
 * ShareStatusDialog outside Connected — the share affordance.
 *
 * There are no snapshots (ADR-036): the dialog must not offer to publish, list
 * or revoke one. The live public sheet is the only way to
 * share, and it needs an account and a connection, so outside Connected the
 * dialog explains what sharing needs instead. The Connected half — who can see
 * it, the link, the QR — is `ShareStatusDialog.connected.test.tsx`.
 *
 * No query is answered here: the panel that reads the server must not mount, or
 * the query mock would throw.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `serverMock.ts`. The signed-out
// branch mounts `SignInControl`, whose auth hook needs the auth module.
const serverMocks = await installServerMocks()
setQueryAnswers({})
afterAll(() => serverMocks.restore())

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
    // The settings read the server and must not mount here.
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

describe('ShareStatusDialog — a pilot’s share is the pilot’s alone (r4 E18)', () => {
  test('one way to share the crew: no paragraph, no links (r7 G9)', async () => {
    const { crawlerFixture, mechFixture, softLinkFixture } = await import(
      '../../../components/__tests__/fixtures'
    )
    cleanup()
    const { useUnits } = await import('../../../replica/units')
    useUnits.setState({
      mechs: [mechFixture({ id: 'm1', name: 'Iron Mongrel' })],
      crawlers: [crawlerFixture({ id: 'c1', name: 'Tenacity' })],
      softLinks: [
        softLinkFixture('mech-to-pilot', 'm1', 'pilot-1'),
        softLinkFixture('pilot-to-crawler', 'pilot-1', 'c1'),
      ],
    })
    await act(async () => {
      renderDialog()
    })
    expect(screen.queryByText(/shared separately/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open Iron Mongrel to share it' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open Tenacity to share it' })).toBeNull()
  })

  test('a pilot with neither says nothing of it', async () => {
    cleanup()
    const { useUnits } = await import('../../../replica/units')
    useUnits.setState({ mechs: [], crawlers: [], softLinks: [] })
    await act(async () => {
      renderDialog()
    })
    expect(screen.queryByRole('region', { name: 'Shared separately' })).toBeNull()
  })
})

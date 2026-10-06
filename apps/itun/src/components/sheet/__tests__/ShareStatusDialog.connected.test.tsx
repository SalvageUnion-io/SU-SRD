import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * ShareStatusDialog when Connected: the live public sheet is the whole of
 * sharing (ADR-032, ADR-036) — a toggle, the `/p/:kind/:appId` link, a copy
 * button and a QR of it. No snapshot control survives anywhere in it.
 *
 * Queries are answered **by name** (`convexMock.ts`); the toggle's mutation is
 * recorded through the `useMutation` override.
 */

import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { pilotFixture } from '../../__tests__/fixtures'

const mutations: unknown[] = []

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
// `authReact` because the dialog can mount `SignInControl`.
const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: {
    useMutation: () => async (args: unknown) => {
      mutations.push(args)
    },
  },
})

const { ShareStatusDialog } = await import('../ShareStatusDialog')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

const PILOT = pilotFixture({ id: 'pilot-1', name: 'Mara Vex' })
const PUBLIC_URL = `${window.location.origin}/p/pilot/pilot-1`

function renderDialog(clipboardWriter?: (text: string) => Promise<void>) {
  return render(
    <ConnectionContext.Provider value={CONNECTED}>
      <ShareStatusDialog
        kind="pilot"
        id="pilot-1"
        entity={PILOT}
        open
        onOpenChange={() => {}}
        clipboardWriter={clipboardWriter}
      />
    </ConnectionContext.Provider>
  )
}

beforeEach(() => {
  mutations.length = 0
})

describe('ShareStatusDialog — Connected, not yet public', () => {
  test('offers to publish the live sheet, and nothing about snapshots', async () => {
    setQueryAnswers({ 'publicSheet:get': null })
    await act(async () => {
      renderDialog()
    })

    expect(screen.getByRole('heading', { name: /live public sheet/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /publish live sheet/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /snapshot/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /frozen snapshot/i })).toBeNull()
    // Nothing is public, so there is no link to show or encode.
    expect(screen.queryByRole('button', { name: /copy public sheet link/i })).toBeNull()
    expect(screen.queryByTestId('share-qr')).toBeNull()
  })

  test('publishing sets publicRead on exactly this entity', async () => {
    setQueryAnswers({ 'publicSheet:get': null })
    await act(async () => {
      renderDialog()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish live sheet/i }))
    })

    expect(mutations).toEqual([{ kind: 'pilot', appId: 'pilot-1', isPublic: true }])
  })
})

describe('ShareStatusDialog — Connected and public', () => {
  test('shows the /p/ link, copies it, and renders a QR of it', async () => {
    setQueryAnswers({ 'publicSheet:get': { kind: 'pilot', body: {} } })
    const writes: string[] = []
    await act(async () => {
      renderDialog(async (text) => {
        writes.push(text)
      })
    })

    expect(screen.getByText(PUBLIC_URL)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy public sheet link/i }))
    })
    expect(writes).toEqual([PUBLIC_URL])

    const qr = await screen.findByTestId('share-qr')
    expect(qr.getAttribute('aria-label')).toBe('QR code linking to this sheet')
    await waitFor(() => {
      expect(qr.querySelector('svg')).not.toBeNull()
    })
  })

  test('"Stop sharing" turns it off', async () => {
    setQueryAnswers({ 'publicSheet:get': { kind: 'pilot', body: {} } })
    await act(async () => {
      renderDialog()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stop sharing/i }))
    })

    expect(mutations).toEqual([{ kind: 'pilot', appId: 'pilot-1', isPublic: false }])
  })
})

afterAll(convexMocks.restore)

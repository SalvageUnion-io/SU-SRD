import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * ShareStatusDialog when Connected: one "Who can see it" control for every
 * kind a player shares — Only me, My Game's crew, Anyone with the link — and,
 * while it is shared by link, the `/p/:kind/:appId` link, a copy button and a
 * QR of it (ADR-032, ADR-036). No snapshot control survives anywhere in it.
 *
 * Queries are answered **by name** (`convexMock.ts`); every mutation is
 * recorded through the `useMutation` override.
 */

import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { APP_BASE } from '../../../lib/appBase'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import type { ShareKind } from '../../../lib/sharing/visibility'
import { pageOrigin } from '../../../lib/site'

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

const GAMES = [{ _id: 'game-1', name: 'The Long Haul', mediator: false }]

function renderDialog({
  kind = 'pilot',
  id = 'pilot-1',
  gameId = null,
  clipboardWriter,
}: {
  kind?: ShareKind
  id?: string
  gameId?: string | null
  clipboardWriter?: (text: string) => Promise<void>
} = {}) {
  return render(
    <ConnectionContext.Provider value={CONNECTED}>
      <ShareStatusDialog
        kind={kind}
        id={id}
        name="Mara Vex"
        gameId={gameId}
        open
        onOpenChange={() => {}}
        clipboardWriter={clipboardWriter}
      />
    </ConnectionContext.Provider>
  )
}

function radio(name: RegExp): HTMLInputElement {
  return screen.getByRole('radio', { name }) as HTMLInputElement
}

beforeEach(() => {
  mutations.length = 0
})

describe('ShareStatusDialog — a sheet on the shelf, not shared', () => {
  test('asks who can see it, answered Only me, and nothing about snapshots', async () => {
    setQueryAnswers({ 'publicSheet:get': null })
    await act(async () => {
      renderDialog()
    })

    expect(screen.getByRole('group', { name: /who can see it/i })).toBeTruthy()
    expect(radio(/only me/i).checked).toBe(true)
    expect(radio(/anyone with the link/i).checked).toBe(false)
    // On the shelf there is no crew to share with: shown, disabled, explained.
    expect(radio(/my game’s crew/i).disabled).toBe(true)
    expect(screen.getByText(/move it into a game/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /snapshot/i })).toBeNull()
    // Nothing is public, so there is no link to show or encode.
    expect(screen.queryByRole('button', { name: /copy public link/i })).toBeNull()
    expect(screen.queryByTestId('share-qr')).toBeNull()
  })

  test('Anyone with the link sets publicRead on exactly this entity', async () => {
    setQueryAnswers({ 'publicSheet:get': null })
    await act(async () => {
      renderDialog()
    })

    await act(async () => {
      fireEvent.click(radio(/anyone with the link/i))
    })

    expect(mutations).toEqual([{ kind: 'pilot', appId: 'pilot-1', isPublic: true }])
  })
})

describe('ShareStatusDialog — a sheet shared by link', () => {
  test('shows the /p/ link, copies it, and renders a QR of it', async () => {
    setQueryAnswers({ 'publicSheet:get': { kind: 'pilot', body: {} } })
    const writes: string[] = []
    await act(async () => {
      renderDialog({
        clipboardWriter: async (text) => {
          writes.push(text)
        },
      })
    })

    const url = `${pageOrigin()}${APP_BASE}/p/pilot/pilot-1`
    expect(radio(/anyone with the link/i).checked).toBe(true)
    expect(screen.getByText(url)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy public link/i }))
    })
    expect(writes).toEqual([url])

    const qr = await screen.findByTestId('share-qr')
    expect(qr.getAttribute('aria-label')).toBe('QR code linking to this sheet')
    await waitFor(() => {
      expect(qr.querySelector('svg')).not.toBeNull()
    })
  })

  test('Only me turns it off', async () => {
    setQueryAnswers({ 'publicSheet:get': { kind: 'pilot', body: {} } })
    await act(async () => {
      renderDialog()
    })

    await act(async () => {
      fireEvent.click(radio(/only me/i))
    })

    expect(mutations).toEqual([{ kind: 'pilot', appId: 'pilot-1', isPublic: false }])
  })
})

describe('ShareStatusDialog — a sheet in a Game', () => {
  test('its crew can see it, so the answer is My Game’s crew and Only me is out of reach', async () => {
    setQueryAnswers({ 'publicSheet:get': null, 'games:listMine': GAMES })
    await act(async () => {
      renderDialog({ kind: 'mech', id: 'mech-1', gameId: 'game-1' })
    })

    expect(radio(/my game’s crew/i).checked).toBe(true)
    expect(radio(/only me/i).disabled).toBe(true)
    expect(screen.getByText(/everyone in the long haul can see it/i)).toBeTruthy()
  })

  test('going back from the link to the crew clears publicRead', async () => {
    setQueryAnswers({ 'publicSheet:get': { kind: 'mech', body: {} }, 'games:listMine': GAMES })
    await act(async () => {
      renderDialog({ kind: 'mech', id: 'mech-1', gameId: 'game-1' })
    })

    await act(async () => {
      fireEvent.click(radio(/my game’s crew/i))
    })

    expect(mutations).toEqual([{ kind: 'mech', appId: 'mech-1', isPublic: false }])
  })
})

describe('ShareStatusDialog — a built NPC', () => {
  test('shares by link exactly as a sheet does, at /p/npc/', async () => {
    setQueryAnswers({ 'publicSheet:get': { kind: 'npc', body: {} } })
    await act(async () => {
      renderDialog({ kind: 'npc', id: 'npc-1' })
    })

    expect(radio(/anyone with the link/i).checked).toBe(true)
    expect(screen.getByText(`${pageOrigin()}${APP_BASE}/p/npc/npc-1`)).toBeTruthy()

    await act(async () => {
      fireEvent.click(radio(/only me/i))
    })
    expect(mutations).toEqual([{ kind: 'npc', appId: 'npc-1', isPublic: false }])
  })
})

describe('ShareStatusDialog — a mech pattern', () => {
  test('takes all three answers through the pattern’s own write', async () => {
    setQueryAnswers({
      'shelf:patternSharing': [
        {
          appId: 'pattern-1',
          visibility: 'private',
          gameId: null,
          gameName: null,
          builtCount: 0,
        },
      ],
      'games:listMine': GAMES,
    })
    await act(async () => {
      renderDialog({ kind: 'pattern', id: 'pattern-1' })
    })

    expect(radio(/only me/i).checked).toBe(true)
    expect(radio(/my game’s crew/i).disabled).toBe(false)

    await act(async () => {
      fireEvent.click(radio(/my game’s crew/i))
    })
    await act(async () => {
      fireEvent.click(radio(/anyone with the link/i))
    })

    expect(mutations).toEqual([
      { patternId: 'pattern-1', visibility: 'game', gameId: 'game-1' },
      { patternId: 'pattern-1', visibility: 'link' },
    ])
  })

  test('shared by link: the /p/pattern/ link', async () => {
    setQueryAnswers({
      'shelf:patternSharing': [
        { appId: 'pattern-1', visibility: 'link', gameId: null, gameName: null, builtCount: 2 },
      ],
      'games:listMine': [],
    })
    await act(async () => {
      renderDialog({ kind: 'pattern', id: 'pattern-1' })
    })

    expect(radio(/anyone with the link/i).checked).toBe(true)
    // No Game to share with: the crew answer is shown, disabled, explained.
    expect(radio(/my game’s crew/i).disabled).toBe(true)
    expect(screen.getByText(`${pageOrigin()}${APP_BASE}/p/pattern/pattern-1`)).toBeTruthy()
  })
})

afterAll(convexMocks.restore)

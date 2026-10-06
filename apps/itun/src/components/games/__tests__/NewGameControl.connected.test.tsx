import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ConvexError } from 'convex/values'

/**
 * "+ New game" — every way into a Game, from the top of the hub.
 *
 * What these pin: there is no game UI for somebody who is not signed in; a
 * game started by name or from a template, or joined with a code, becomes what
 * the hub shows (the active container) and the dialog gets out of the way; a
 * gated code says it is waiting and selects nothing; and a refusal is shown in
 * the words the server chose.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { getFunctionName } from 'convex/server'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

let authed = true
const mutations: { name: string; args: unknown }[] = []
/** What each mutation resolves to, by name. */
let results: Record<string, unknown> = {}
let mutationError: unknown = null

const convexMocks = await installConvexMocks({
  convexReact: {
    useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
    useMutation: (ref: unknown) => async (args: unknown) => {
      if (mutationError !== null) throw mutationError
      const name = getFunctionName(ref as never)
      mutations.push({ name, args })
      return results[name]
    },
  },
})

const { NewGameControl } = await import('../NewGameControl')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { getActiveContainer, setActiveContainer } = await import(
  '../../../stores/activeContainerStore'
)
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')

const TEMPLATES = [
  { id: 'starter-set', name: 'Reclamation of the Wastes', description: 'Six pre-gens.' },
]

beforeEach(() => {
  authed = true
  mutations.length = 0
  mutationError = null
  results = {
    'games:create': 'g-new',
    'templates:createGame': 'g-template',
    'invites:redeem': { kind: 'joined', gameId: 'g-joined', granted: 0 },
  }
  setActiveContainer({ kind: 'shelf' })
  setQueryAnswers({ 'templates:list': TEMPLATES })
})

afterEach(() => {
  // Process-global: a leaked signed-in state changes what later files exercise.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

afterAll(() => {
  setActiveContainer({ kind: 'shelf' })
  convexMocks.restore()
})

async function renderOpen(): Promise<void> {
  await act(async () => {
    render(
      <ConnectionProvider>
        <NewGameControl />
      </ConnectionProvider>
    )
  })
  fireEvent.click(screen.getByRole('button', { name: '+ New game' }))
}

async function press(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

describe('who gets it', () => {
  test('nothing at all for somebody who is not signed in', async () => {
    authed = false
    let container: HTMLElement | undefined
    await act(async () => {
      container = render(
        <ConnectionProvider>
          <NewGameControl />
        </ConnectionProvider>
      ).container
    })
    expect(container?.textContent).toBe('')
  })

  test('the dialog holds all three doors: by name, from a template, with a code', async () => {
    await renderOpen()
    expect(screen.getByRole('heading', { name: 'Start a game' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'From a template' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Join with a code' })).toBeTruthy()
    expect(screen.getByText('Reclamation of the Wastes')).toBeTruthy()
  })
})

describe('starting a game', () => {
  test('Create waits for a name, then makes the game and shows it', async () => {
    await renderOpen()
    const create = screen.getByRole('button', { name: 'Create' })
    expect(create.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('New game name'), {
      target: { value: 'Union Crawler #430' },
    })
    await press('Create')

    expect(mutations).toEqual([{ name: 'games:create', args: { name: 'Union Crawler #430' } }])
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g-new' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('from a template, the new game is shown too', async () => {
    await renderOpen()
    await press('Start this game')

    expect(mutations).toEqual([
      { name: 'templates:createGame', args: { templateId: 'starter-set' } },
    ])
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g-template' })
  })
})

describe('joining with a code', () => {
  test('Join waits for a code, then shows the game it joined', async () => {
    await renderOpen()
    expect(screen.getByRole('button', { name: 'Join' }).hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    await press('Join')

    expect(mutations).toEqual([{ name: 'invites:redeem', args: { code: 'A1B2C3D4' } }])
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g-joined' })
  })

  test('already in it: shows that game', async () => {
    results['invites:redeem'] = { kind: 'already', gameId: 'g-old' }
    await renderOpen()
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    await press('Join')
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g-old' })
  })

  test('a gated code says it is waiting, and shows nothing it cannot see yet', async () => {
    results['invites:redeem'] = { kind: 'pending', gameId: 'g-gated' }
    await renderOpen()
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    await press('Join')

    expect(screen.getByRole('status').textContent).toMatch(/once the organizer approves/i)
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })

  test('a refusal is shown in the server’s own words', async () => {
    await renderOpen()
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    mutationError = new ConvexError('That invite code has expired')
    await press('Join')

    expect(screen.getByRole('alert').textContent).toBe('That invite code has expired')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})

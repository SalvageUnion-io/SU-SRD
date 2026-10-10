import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ConvexError } from 'convex/values'

/**
 * "+ New game" — starting a Game, from the top of the hub.
 *
 * What these pin: there is no game UI for somebody who is not signed in; a game
 * started by name or from a template is shown (on its own page, with a router —
 * `useShowContainer`) and the dialog gets out of the way; a refusal is shown in the words the server chose; and there
 * is no code to type — a Game is joined from an invite link (issue 1255).
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
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const { getActiveContainer, setActiveContainer } = await import(
  '../../../stores/activeContainerStore'
)

const TEMPLATES = [
  { id: 'starter-set', name: 'Reclamation of the Wastes', description: 'Six pre-gens.' },
]

beforeEach(() => {
  authed = true
  mutations.length = 0
  setActiveContainer({ kind: 'shelf' })
  mutationError = null
  results = {
    'games:create': 'g-new',
    'templates:createGame': 'g-template',
  }
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

  test('"+ New game" opens the two ways to start one, and no code to type', async () => {
    await renderOpen()
    expect(screen.getByRole('heading', { name: 'Start a game' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'From a template' })).toBeTruthy()
    expect(screen.getByText('Reclamation of the Wastes')).toBeTruthy()
    expect(screen.queryByLabelText('Invite code')).toBeNull()
    // Joining is an invite link's job, and the dialog says where to look.
    expect(screen.queryByRole('button', { name: 'Join game' })).toBeNull()
    expect(screen.getByText(/Open the invite link/)).toBeTruthy()
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

  test('a refusal is shown in the server’s own words, and goes nowhere', async () => {
    await renderOpen()
    mutationError = new ConvexError('You have too many games')
    await press('Start this game')

    expect(screen.getByRole('alert').textContent).toBe('You have too many games')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})

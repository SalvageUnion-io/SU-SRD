import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { RoomDeclined } from '../../../replica/roomSocket'

/**
 * "+ New Game" — starting a Game, from the Play hub.
 *
 * What these pin: there is no game UI for somebody who is not signed in; a game
 * started by name or from a template opens on its page in Play
 * (`/play/games/$gameId`) and the dialog gets out of the way; a refusal is shown in the words the server chose; and there
 * is no code to type — a Game is joined from an invite link.
 *
 * Queries are answered **by name** — see `serverMock.ts`.
 */

import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'

let authed = true
const mutations: { name: string; args: unknown }[] = []
/** What each mutation resolves to, by name. */
let results: Record<string, unknown> = {}
let mutationError: unknown = null

const serverMocks = await installServerMocks({
  authReact: { useSession: () => ({ isAuthenticated: authed, isLoading: false }) },
  call: (name, args) => {
    if (mutationError !== null) throw mutationError
    mutations.push({ name, args })
    return results[name]
  },
})

const { NewGameControl } = await import('../NewGameControl')
const { SyncProvider } = await import('../../../replica/SyncProvider')
const { resetSync } = await import('../../../replica/sync')

const TEMPLATES = [
  { id: 'starter-set', name: 'Reclamation of the Wastes', description: 'Six pre-gens.' },
]

/** No router is mounted, so `useGo` falls back to `location.assign`, observed here. */
let assigned: string[] = []
const assignSpy = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
  assigned.push(String(to))
})

beforeEach(() => {
  authed = true
  mutations.length = 0
  assigned = []
  mutationError = null
  results = {
    'games.create': 'g-new',
    'templates.createGame': 'g-template',
  }
  setQueryAnswers({ 'templates.list': TEMPLATES })
})

afterEach(() => {
  // Process-global: a leaked signed-in state changes what later files exercise.
  resetSync()
})

afterAll(() => {
  assignSpy.mockRestore()
  serverMocks.restore()
})

async function renderOpen(): Promise<void> {
  await act(async () => {
    render(
      <SyncProvider>
        <NewGameControl />
      </SyncProvider>
    )
  })
  fireEvent.click(screen.getByRole('button', { name: '+ New Game' }))
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
        <SyncProvider>
          <NewGameControl />
        </SyncProvider>
      ).container
    })
    expect(container?.textContent).toBe('')
  })

  test('"+ New Game" opens the two ways to start one, and no code to type', async () => {
    await renderOpen()
    expect(screen.getByRole('heading', { name: 'Start a Game' })).toBeTruthy()
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

    fireEvent.change(screen.getByLabelText('New Game name'), {
      target: { value: 'Union Crawler #430' },
    })
    await press('Create')

    expect(mutations).toEqual([{ name: 'games.create', args: { name: 'Union Crawler #430' } }])
    expect(assigned).toEqual(['/play/games/g-new'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('from a template, the new game is shown too', async () => {
    await renderOpen()
    await press('Start this Game')

    expect(mutations).toEqual([
      { name: 'templates.createGame', args: { templateId: 'starter-set' } },
    ])
    expect(assigned).toEqual(['/play/games/g-template'])
  })

  test('a refusal is shown in the server’s own words, and goes nowhere', async () => {
    await renderOpen()
    mutationError = new RoomDeclined('You have too many games')
    await press('Start this Game')

    expect(screen.getByRole('alert').textContent).toBe('You have too many games')
    expect(assigned).toEqual([])
  })
})

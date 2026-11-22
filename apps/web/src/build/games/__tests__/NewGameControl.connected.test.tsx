import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { RoomDeclined } from '../../../replica/roomSocket'

/**
 * "+ New Game" — starting a Game, from the Play hub.
 *
 * What these pin: there is no game UI for somebody who is not signed in; a game
 * started by name or from a template opens on its page in Play
 * (`/games/$gameId`) and the dialog gets out of the way; a refusal is shown in the words the server chose; and there
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
  {
    id: 'starter-set',
    name: "Reclamation of the Wastes — Union Crawler #430 'Tenacity'",
    shortName: 'Reclamation of the Wastes',
    crawler: "Union Crawler #430 'Tenacity'",
    description: 'Six pre-gens.',
  },
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

describe('the dialog’s focus (MD2-04)', () => {
  test('typing starts in the name, not on Close', async () => {
    // The dialog focuses on the next frame; the frame is run here, so the
    // test waits on no timer.
    const frame = spyOn(globalThis, 'requestAnimationFrame').mockImplementation((run) => {
      run(0)
      return 0
    })
    try {
      await renderOpen()
      await act(async () => undefined)
      expect(document.activeElement === screen.getByLabelText('New Game name')).toBe(true)
    } finally {
      frame.mockRestore()
    }
  })
})

describe('starting a game', () => {
  test('Create waits for a name, then makes the game and shows it', async () => {
    await renderOpen()
    const create = screen.getByRole('button', { name: 'Create' })
    expect(create.hasAttribute('disabled')).toBe(true)
    // No longer than the room takes.
    expect(screen.getByLabelText('New Game name').getAttribute('maxlength')).toBe('80')

    fireEvent.change(screen.getByLabelText('New Game name'), {
      target: { value: 'Union Crawler #430' },
    })
    // Asked "Will you be the Mediator?", and Yes is the answer given.
    expect(screen.getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('true')
    await press('Create')

    expect(mutations).toEqual([
      { name: 'games.create', args: { name: 'Union Crawler #430', mediator: true } },
    ])
    expect(assigned).toEqual(['/games/g-new'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // LG3-10, MD3-04: the cursor is in the name, so Enter there is Create.
  test('Enter in the name creates the Game, and does nothing while it is empty', async () => {
    await renderOpen()
    const name = screen.getByLabelText('New Game name')
    await act(async () => {
      fireEvent.keyDown(name, { key: 'Enter' })
    })
    expect(mutations).toEqual([])

    fireEvent.change(name, { target: { value: 'Rust Coast' } })
    await act(async () => {
      fireEvent.keyDown(name, { key: 'Enter' })
    })
    expect(mutations).toEqual([
      { name: 'games.create', args: { name: 'Rust Coast', mediator: true } },
    ])
    expect(assigned).toEqual(['/games/g-new'])
  })

  test('from a template, the new game is shown too', async () => {
    await renderOpen()
    // Somebody who only organises says so, and is told what an Organiser is.
    expect(screen.getByText(/You are this Game’s Organiser either way/)).toBeTruthy()
    await press('No')
    await press('Start this Game')

    expect(mutations).toEqual([
      {
        name: 'templates.createGame',
        args: { templateId: 'starter-set', name: 'Reclamation of the Wastes', mediator: false },
      },
    ])
    expect(assigned).toEqual(['/games/g-template'])
  })

  // r6 C9 (MD6-13): the Game is named before it exists, its crawler on a line of its own.
  test('a template asks for its name, filled with the campaign’s short name', async () => {
    await renderOpen()
    const name = screen.getByLabelText(/^Name of the Game from /) as HTMLInputElement
    expect(name.value).toBe('Reclamation of the Wastes')
    expect(screen.getByText("Your crawler: Union Crawler #430 'Tenacity'")).toBeTruthy()
    fireEvent.change(name, { target: { value: 'Rust Coast' } })
    await press('Start this Game')
    expect(mutations).toEqual([
      {
        name: 'templates.createGame',
        args: { templateId: 'starter-set', name: 'Rust Coast', mediator: true },
      },
    ])
  })

  test('a refusal is shown in the server’s own words, and goes nowhere', async () => {
    await renderOpen()
    mutationError = new RoomDeclined('You have too many games')
    await press('Start this Game')

    expect(screen.getByRole('alert').textContent).toBe('You have too many games')
    expect(assigned).toEqual([])
  })
})

/**
 * The Homebrew library's surfaces (ADR-053): the gallery, its admin queue, the
 * Share dialog's opt-in, and a listed page's Report and Hide. Pins what each
 * shows to whom and which server write each control makes.
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { ReactNode } from 'react'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { FIXTURE_NOW, npcFixture } from '../../../components/__tests__/fixtures'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'

const writes: Array<[string, unknown]> = []

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
  convexReact: {
    useMutation: (ref: unknown) => async (args: unknown) => {
      writes.push([getFunctionName(ref as FunctionReference<'mutation'>), args])
      return null
    },
  },
  authReact: true,
  router: true,
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { usePatternStore } = await import('../../../stores/patternStore')
const { useEntityStore } = await import('../../../stores/entityStore')
const { HomebrewLibrary } = await import('../HomebrewLibrary')
const { LibraryShareToggle } = await import('../LibraryShareToggle')
const { LibraryPageControls } = await import('../LibraryPageControls')
const { PublicNpcActions } = await import('../PublicNpcActions')

withSignedInBackend()

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}
const SIGNED_OUT: ConnectionState = { ...CONNECTED, mode: 'solo', canWrite: false }

const PATTERN = {
  kind: 'pattern',
  appId: 'pat-tow-rig',
  body: {
    id: 'pat-tow-rig',
    schemaVersion: 1,
    name: 'Tow Rig',
    chassisRef: 'scrapper',
    systems: [],
    modules: [],
    cargoLots: [],
    createdAt: FIXTURE_NOW,
  },
  madeBy: 'Rosa',
  listedAt: 2,
  mine: false,
}
const NPC_BODY = { ...npcFixture({ id: 'npc-mags', name: 'Old Mags' }), position: 'Medic' }
const NPC = {
  kind: 'npc',
  appId: 'npc-mags',
  body: NPC_BODY,
  madeBy: 'Ash',
  listedAt: 1,
  mine: true,
}

const STATUS = { listed: true, hidden: false, reported: false, mine: false, admin: false }

const QUEUE = {
  reported: [
    {
      kind: 'pattern',
      appId: 'pat-tow-rig',
      name: 'Tow Rig',
      madeBy: 'Rosa',
      reportCount: 2,
      reasons: ['Copied book text', 'Spam'],
      hiddenAt: null,
    },
  ],
  hidden: [
    {
      kind: 'npc',
      appId: 'npc-gone',
      name: 'Gone',
      madeBy: 'Ash',
      reportCount: 0,
      reasons: [],
      hiddenAt: 5,
    },
  ],
}

async function show(node: ReactNode, connection: ConnectionState = CONNECTED) {
  await act(async () => {
    render(<ConnectionContext.Provider value={connection}>{node}</ConnectionContext.Provider>)
  })
}

async function press(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

async function pick(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitem', { name }))
  })
}

// The stores are module singletons shared with every other file in the run:
// put back the `create` each test swaps in.
const realPatternCreate = usePatternStore.getState().create
const realEntityCreate = useEntityStore.getState().create
beforeEach(() => {
  writes.length = 0
})
afterEach(() => {
  usePatternStore.setState({ create: realPatternCreate })
  useEntityStore.setState({ create: realEntityCreate })
})

describe('the gallery', () => {
  test('lists every readable listing, newest first, each opening its page', async () => {
    setQueryAnswers({
      'library:list': [PATTERN, NPC, { ...PATTERN, appId: 'bad', body: { name: 7 } }],
      'library:moderation': null,
    })
    await show(<HomebrewLibrary />)
    const list = screen.getByRole('list', { name: 'Homebrew' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(screen.getByText('Homebrew Library')).toBeTruthy()
    expect(screen.queryByText('Reported')).toBeNull()
  })

  test('filters by kind and searches, and says when nothing matches', async () => {
    setQueryAnswers({ 'library:list': [PATTERN, NPC], 'library:moderation': null })
    await show(<HomebrewLibrary />)
    await press('NPCs')
    expect(
      within(screen.getByRole('list', { name: 'Homebrew' })).getAllByRole('listitem')
    ).toHaveLength(1)
    await press('All')
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Search the library'), { target: { value: 'zzz' } })
    })
    expect(screen.getByText(/Nothing in the library matches/)).toBeTruthy()
  })

  test('empty, it says so; loading, it shows the skeleton', async () => {
    setQueryAnswers({ 'library:list': [], 'library:moderation': null })
    await show(<HomebrewLibrary />)
    expect(screen.getByText('Nothing is listed yet.')).toBeTruthy()
  })

  test('signed out, it reads with no account and asks nobody about moderation', async () => {
    setQueryAnswers({ 'library:list': [PATTERN] })
    await show(<HomebrewLibrary />, SIGNED_OUT)
    expect(screen.getByText(/sign in to copy one/)).toBeTruthy()
  })

  test('a reader copies a pattern to their Training Bay and reports one', async () => {
    const created: unknown[] = []
    usePatternStore.setState({
      create: async (input: unknown) => {
        created.push(input)
        return { ...(input as object), id: 'new', createdAt: 1 } as never
      },
    } as never)
    setQueryAnswers({ 'library:list': [PATTERN], 'library:moderation': null })
    await show(<HomebrewLibrary />)

    await press('More for Tow Rig')
    await pick('Make a copy')
    await press('Make a copy')
    expect(created).toHaveLength(1)

    await press('More for Tow Rig')
    await pick('Report…')
    await act(async () => {
      fireEvent.change(screen.getByLabelText('What is wrong with it'), {
        target: { value: 'Copied book text' },
      })
    })
    await press('Report')
    expect(writes).toEqual([
      ['library:report', { kind: 'pattern', appId: 'pat-tow-rig', reason: 'Copied book text' }],
    ])
  })

  test('an empty report is refused on the dialog, and nothing is sent', async () => {
    setQueryAnswers({ 'library:list': [PATTERN], 'library:moderation': null })
    await show(<HomebrewLibrary />)
    await press('More for Tow Rig')
    await pick('Report…')
    await press('Report')
    expect(screen.getByText('Say what is wrong with it first.')).toBeTruthy()
    expect(writes).toEqual([])
  })

  test('a copied NPC goes through the entity store', async () => {
    const created: unknown[] = []
    useEntityStore.setState({
      create: async (_type: unknown, input: unknown) => {
        created.push(input)
        return { ...(input as object), id: 'new' } as never
      },
    } as never)
    setQueryAnswers({ 'library:list': [NPC], 'library:moderation': null })
    await show(<HomebrewLibrary />)
    await press('More for Old Mags')
    // Your own listing: no Report.
    expect(screen.queryByRole('menuitem', { name: 'Report…' })).toBeNull()
    await pick('Make a copy')
    await press('Make a copy')
    expect(created).toMatchObject([{ name: 'Old Mags', gameId: null }])
  })

  test('an admin sees the queue, and hides, dismisses and puts back', async () => {
    setQueryAnswers({ 'library:list': [PATTERN], 'library:moderation': QUEUE })
    await show(<HomebrewLibrary />)
    expect(screen.getByText('Copied book text')).toBeTruthy()
    await press('Hide')
    await press('Dismiss 2 reports')
    await press('Put back')
    expect(writes).toEqual([
      ['library:setHidden', { kind: 'pattern', appId: 'pat-tow-rig', hidden: true }],
      ['library:dismissReports', { kind: 'pattern', appId: 'pat-tow-rig' }],
      ['library:setHidden', { kind: 'npc', appId: 'npc-gone', hidden: false }],
    ])

    await press('More for Tow Rig')
    await pick('Hide from the library…')
    await press(/^Hide$/)
    expect(writes.at(-1)).toEqual([
      'library:setHidden',
      { kind: 'pattern', appId: 'pat-tow-rig', hidden: true },
    ])
  })
})

describe('the Share dialog’s opt-in', () => {
  test('unlisted, it lists; listed, it delists', async () => {
    setQueryAnswers({ 'library:status': { ...STATUS, listed: false, mine: true } })
    await show(<LibraryShareToggle kind="npc" appId="npc-mags" />)
    await press('List it in the Homebrew library')
    expect(writes).toEqual([
      ['library:setListed', { kind: 'npc', appId: 'npc-mags', listed: true }],
    ])
  })

  test('listed, it says where', async () => {
    setQueryAnswers({ 'library:status': { ...STATUS, mine: true } })
    await show(<LibraryShareToggle kind="pattern" appId="pat-tow-rig" />)
    expect(
      screen
        .getByRole('button', { name: 'List it in the Homebrew library' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(screen.getByRole('link', { name: 'Homebrew library' })).toBeTruthy()
  })

  test('taken down, it says so and offers nothing', async () => {
    setQueryAnswers({ 'library:status': { ...STATUS, listed: false, hidden: true, mine: true } })
    await show(<LibraryShareToggle kind="pattern" appId="pat-tow-rig" />)
    expect(screen.getByText(/A site admin took this out/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('a listed page’s controls', () => {
  test('a reader reports it; already reported, it says so', async () => {
    setQueryAnswers({ 'library:status': { ...STATUS, reported: true } })
    await show(<LibraryPageControls kind="pattern" appId="pat-tow-rig" name="Tow Rig" />)
    expect(screen.getByRole('button', { name: 'Report Tow Rig' }).textContent).toBe('Reported')
    expect(screen.queryByText('Hide from library')).toBeNull()
  })

  test('its maker is offered nothing; unlisted, nobody is', async () => {
    setQueryAnswers({ 'library:status': { ...STATUS, mine: true } })
    await show(<LibraryPageControls kind="pattern" appId="pat-tow-rig" name="Tow Rig" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('an admin hides it, and puts a hidden one back', async () => {
    setQueryAnswers({ 'library:status': { ...STATUS, admin: true } })
    await show(<LibraryPageControls kind="npc" appId="npc-mags" name="Old Mags" />)
    await press('Hide from library')
    expect(writes).toEqual([
      ['library:setHidden', { kind: 'npc', appId: 'npc-mags', hidden: true }],
    ])
  })

  test('a shared NPC’s page: Make a copy, signed in only', async () => {
    const created: unknown[] = []
    useEntityStore.setState({
      create: async (_type: unknown, input: unknown) => {
        created.push(input)
        return { ...(input as object), id: 'new' } as never
      },
    } as never)
    setQueryAnswers({ 'library:status': { ...STATUS, listed: false } })
    await show(<PublicNpcActions npc={NPC_BODY} />)
    await press('Make a copy')
    expect(created).toMatchObject([{ name: 'Old Mags' }])
  })

  test('signed out, a shared NPC’s page offers nothing', async () => {
    setQueryAnswers({})
    await show(<PublicNpcActions npc={NPC_BODY} />, SIGNED_OUT)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

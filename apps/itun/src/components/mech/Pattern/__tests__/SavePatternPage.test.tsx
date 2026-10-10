/**
 * Save as pattern (issue 1276, board P1): the mech's chassis and loadout, solid; a
 * name, notes and who may read it; a dashed, credited preview; then the save.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ConnectionState } from '../../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../../__tests__/convexMock'
import { mechFixture } from '../../../__tests__/fixtures'

const visibilityWrites: unknown[] = []

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
  convexReact: {
    useMutation: () => async (args: unknown) => {
      visibilityWrites.push(args)
      return null
    },
  },
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../../lib/connection/connectionContext')
const { useEntityStore } = await import('../../../../stores/entityStore')
const { usePatternStore } = await import('../../../../stores/patternStore')
const { SavePatternPage } = await import('../SavePatternPage')

withSignedInBackend()

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

const mech = mechFixture({
  id: 'm-scrapper',
  name: 'Scrapper',
  chassisRef: 'scrapper',
  systems: ['rigging-arm', 'transport-hold'],
  modules: ['comms-module'],
  currentHeat: 4,
  cargoLots: [{ id: 'lot-1', kind: 'unit', name: 'scrap', cat: 'SEALED', units: 1, code: 'SCR' }],
  gameId: 'game-1',
})

let saved: Array<{ id: string; visibility: string }> = []

async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

async function renderPage() {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <SavePatternPage
          mechId="m-scrapper"
          onSaved={(id, visibility) => saved.push({ id, visibility })}
          onCancel={() => undefined}
        />
      </ConnectionContext.Provider>
    )
  })
}

beforeEach(() => {
  saved = []
  visibilityWrites.length = 0
  useEntityStore.setState({
    mechs: [mech],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
  })
  usePatternStore.setState({ mechPatterns: [], hydrated: true })
  setQueryAnswers({
    'account:me': { _id: 'u1', displayName: 'alxjrvs', avatarUrl: null, email: null },
    'games:listMine': [{ _id: 'game-1', name: 'Reclamation of the Wastes' }],
  })
})

describe('what gets saved', () => {
  test('the chassis and every part of the loadout, as solid reference cards', async () => {
    await renderPage()
    expect(screen.getByText('from your Scrapper')).toBeTruthy()
    for (const part of ['Rigging Arm', 'Transport Hold', 'Comms Module']) {
      expect(screen.getAllByText(part).length).toBeGreaterThan(0)
    }
  })

  test('the preview is the pattern as others see it: dashed, User-made, credited', async () => {
    await renderPage()
    expect(screen.getByText('User-made')).toBeTruthy()
    expect(screen.getByText('Made by alxjrvs')).toBeTruthy()
    expect(screen.getByText('Not a legal starting mech')).toBeTruthy()
  })

  test('crew sharing names the mech’s own Game', async () => {
    await renderPage()
    expect(screen.getByText(/Everyone in Reclamation of the Wastes/)).toBeTruthy()
  })
})

describe('saving', () => {
  test('keeps the loadout, leaves the cargo, and shares it as chosen', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Pattern name'), { target: { value: 'Tow Rig' } })
    fireEvent.change(screen.getByLabelText('Notes for whoever builds it'), {
      target: { value: 'Rig first, rivet later.' },
    })
    fireEvent.click(screen.getByLabelText(/Anyone with the link/))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await settle(() => saved.length > 0)

    const [pattern] = usePatternStore.getState().mechPatterns
    expect(pattern).toMatchObject({
      name: 'Tow Rig',
      notes: 'Rig first, rivet later.',
      chassisRef: 'scrapper',
      systems: ['rigging-arm', 'transport-hold'],
      modules: ['comms-module'],
      cargoLots: [],
    })
    expect(visibilityWrites).toEqual([{ patternId: pattern?.id, visibility: 'link' }])
    expect(saved).toEqual([{ id: pattern?.id ?? '', visibility: 'link' }])
  })

  test('kept to its maker, it writes no visibility at all', async () => {
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await settle(() => saved.length > 0)

    expect(usePatternStore.getState().mechPatterns[0]?.name).toBe('Scrapper')
    expect(visibilityWrites).toEqual([])
    expect(saved[0]?.visibility).toBe('private')
  })

  test('shared with the crew, it names the Game', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText(/My Game’s crew/))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await settle(() => saved.length > 0)

    expect(visibilityWrites).toEqual([
      expect.objectContaining({ visibility: 'game', gameId: 'game-1' }),
    ])
  })
})

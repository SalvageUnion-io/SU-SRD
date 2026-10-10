/**
 * Board N2 — crawler crew (issue 1277, ADR-043): design a bay's NPC, save and
 * assign it, unassign it to fall back to the book's line, and the read-only
 * board for anyone who may not write the crawler (D7).
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { crawlerFixture } from '../../__tests__/fixtures'

const writes: unknown[] = []

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (_ref: unknown, args: unknown) => {
      writes.push(args)
      return { updatedAt: 1 }
    },
  },
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { useEntityStore } = await import('../../../stores/entityStore')
const { CrewBoard } = await import('../CrewBoard')

withSignedInBackend()

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

/** A shelf crawler: its Med Bay's book crew already named inline. */
const SHELF_CRAWLER = crawlerFixture({
  id: 'c1',
  name: '#430 Tenacity',
  gameId: null,
  type: 'augmented',
  crawlerBays: [
    { bayRef: 'command-bay' },
    { bayRef: 'med-bay', npcName: 'Old Mags', npcCurrentHP: 3 },
  ],
})

function Board({ crawlerId, initialSlot }: { crawlerId: string; initialSlot?: string }) {
  const [slot, setSlot] = useState(initialSlot)
  return (
    <CrewBoard
      crawlerId={crawlerId}
      slot={slot}
      madeBy="alxjrvs"
      onSelect={(next) => setSlot(next.slot)}
    />
  )
}

async function renderBoard(crawlerId: string, initialSlot?: string) {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <Board crawlerId={crawlerId} initialSlot={initialSlot} />
      </ConnectionContext.Provider>
    )
  })
}

beforeEach(() => {
  writes.length = 0
  useEntityStore.setState({
    crawlers: [SHELF_CRAWLER],
    npcs: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  setQueryAnswers({ 'games:listMine': [] })
})

describe('the slots', () => {
  test('the type first, then one per bay, each keeping the book’s line', async () => {
    await renderBoard('c1')
    expect(
      screen.getByRole('button', { name: 'Type · Augmented: Union Crawler A.I.' })
    ).toBeTruthy()
    expect(screen.getByText(/Old Mags ·/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Design Med Bay crew' })).toBeTruthy()
  })
})

describe('design, assign, unassign', () => {
  test('the book’s line comes back exactly as it was', async () => {
    const before = JSON.stringify(useEntityStore.getState().crawlers[0])
    await renderBoard('c1')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Design Med Bay crew' }))
    })
    // Position and HP are the slot's; the form is the book's four choices.
    expect(screen.getByText(/position Doc, HP 4/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Roll Keepsake/ })).toBeNull()
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Doc Ambrose' } })
      fireEvent.change(screen.getByLabelText(/Keepsake/), {
        target: { value: 'A dented tin of boiled sweets' },
      })
    })
    expect(screen.getAllByText('Crawler crew · Med Bay').length).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save and assign to Med Bay' }))
    })
    await waitFor(() => expect(useEntityStore.getState().softLinks).toHaveLength(1))

    const [npc] = useEntityStore.getState().npcs
    expect(npc).toMatchObject({
      name: 'Doc Ambrose',
      position: 'Doc',
      hitPoints: 4,
      keepsake: 'A dented tin of boiled sweets',
      gameId: null,
    })
    expect(useEntityStore.getState().softLinks[0]).toMatchObject({
      type: 'npc-to-crawler',
      from: { type: 'npc', id: npc?.id },
      to: { type: 'crawler', id: 'c1' },
      slot: { kind: 'bay', bayRef: 'med-bay' },
    })
    // Linking wrote nothing to the crawler.
    expect(JSON.stringify(useEntityStore.getState().crawlers[0])).toBe(before)

    // The slot now shows the NPC, dashed and stamped.
    expect(screen.getByRole('button', { name: 'Med Bay: Doc Ambrose' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Med Bay: Doc Ambrose' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unassign Doc Ambrose from Med Bay' }))
    })
    await waitFor(() => expect(useEntityStore.getState().softLinks).toHaveLength(0))

    // The NPC survives, and the bay is back to the book's line, byte for byte.
    expect(useEntityStore.getState().npcs).toHaveLength(1)
    expect(JSON.stringify(useEntityStore.getState().crawlers[0])).toBe(before)
    expect(screen.getByText(/Old Mags ·/)).toBeTruthy()
  })

  test('the Augmented A.I. rolls its personality, because its data has a table (D1)', async () => {
    await renderBoard('c1', 'type')
    expect(
      screen.getByRole('button', { name: 'Roll A.I. Personality on the A.I. Personality table' })
    ).toBeTruthy()
  })
})

describe('only whoever may write the crawler assigns its crew (D7)', () => {
  test('a player sees a Game crawler read-only, and is told why', async () => {
    useEntityStore.setState({ crawlers: [{ ...SHELF_CRAWLER, gameId: 'g1' }] })
    setQueryAnswers({
      'games:listMine': [{ _id: 'g1', name: 'Tenacity', tableRunner: false }],
      'entities:listForGame': {
        pilots: [],
        mechs: [],
        crawlers: [],
        npcs: [],
        softLinks: [],
        primaryCrawlerId: null,
      },
      'games:members': [],
    })
    await renderBoard('c1')
    expect(screen.queryByRole('button', { name: 'Design Med Bay crew' })).toBeNull()
    expect(screen.getByText(/Only the Mediator assigns crawler crew/)).toBeTruthy()
  })
})

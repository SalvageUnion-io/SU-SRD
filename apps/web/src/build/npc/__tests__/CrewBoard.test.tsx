/**
 * Crawler crew (ADR-044): design a bay's NPC, save and
 * assign it, unassign it to fall back to the book's line, and the read-only
 * board for anyone who may not write the crawler (D7).
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { crawlerFixture } from '../../../components/__tests__/fixtures'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'

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
    // Each slot is a Compact in select mode: picking it opens the slot.
    expect(screen.getByRole('radio', { name: 'Type · Augmented: Union Crawler A.I.' })).toBeTruthy()
    // The book's crew line: its name on the Compact, its HP a label-first chip.
    const mags = screen.getByText('Old Mags').closest('.su-entity-compact')
    if (!(mags instanceof HTMLElement)) throw new Error('no Old Mags row')
    expect(within(mags).getByText('Book’s crew line')).toBeTruthy()
    expect(within(mags).getByText('HP')).toBeTruthy()
    // Design is the Compact's control, never inside its radio.
    const design = screen.getByRole('button', { name: 'Design Med Bay crew' })
    expect(design.closest('[role="radio"]')).toBeNull()
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
    expect(screen.getByText(/position Doc, 4 Hit Points/)).toBeTruthy()
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
    expect(screen.getByRole('radio', { name: 'Med Bay: Doc Ambrose' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Med Bay: Doc Ambrose' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unassign Doc Ambrose from Med Bay' }))
    })
    await waitFor(() => expect(useEntityStore.getState().softLinks).toHaveLength(0))

    // The NPC survives, and the bay is back to the book's line, byte for byte.
    expect(useEntityStore.getState().npcs).toHaveLength(1)
    expect(JSON.stringify(useEntityStore.getState().crawlers[0])).toBe(before)
    // The slot closes in the write's success callback, a tick after the store empties.
    await waitFor(() => expect(screen.getByText('Old Mags')).toBeTruthy())
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

describe('below 48rem the slot opens in a modal (§5)', () => {
  /** A phone viewport: the designer's wide query does not match. */
  function onPhone() {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia
    return () => {
      window.matchMedia = original
    }
  }

  test('the modal names the slot once, and its body carries its own gutter', async () => {
    const restore = onPhone()
    try {
      await renderBoard('c1', 'med-bay')
      const dialog = await screen.findByRole('dialog')
      // The modal title is the only heading naming the slot: the panel drops its own.
      expect(within(dialog).getAllByRole('heading', { name: 'Med Bay · the Doc' })).toHaveLength(1)
      // ModalShell's Card body adds no padding, so the panel's wrapper does.
      const intro = within(dialog).getByText(/position Doc, 4 Hit Points/)
      expect(intro.parentElement?.style.padding).not.toBe('')
    } finally {
      restore()
    }
  })

  test('on a wide screen the panel keeps its own heading', async () => {
    await renderBoard('c1', 'med-bay')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('heading', { name: 'Med Bay · the Doc' })).toHaveLength(1)
  })
})

import type { UnitsState } from '../../../replica/units'
/**
 * Crawler crew, the paths `CrewBoard.test.tsx` leaves open:
 * choosing which crawler to crew, the name the form insists on, assigning an
 * NPC that is already in the crawler's container, a refused assignment (on
 * its own, and after a save that landed), a Game crawler's crew read live
 * from the Game, the read-only slot panel, the Roll that fills a choice, and
 * the phone modal closing back to the board.
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { crawlerFixture, npcFixture, softLinkFixture } from '../../../components/__tests__/fixtures'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../replica/syncContext'

/** How the stub server answers a link write this test. */
let linkWrite: 'ok' | 'defect' | 'refused' = 'ok'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (_ref: unknown, args: unknown) => {
      const isLink = typeof args === 'object' && args !== null && 'from' in args
      if (isLink && linkWrite === 'defect') throw new Error('socket closed')
      if (isLink && linkWrite === 'refused') throw new ConvexError('That NPC is crewing elsewhere.')
      return { updatedAt: 1 }
    },
  },
})
afterAll(() => convexMocks.restore())

const { ToasterMount, toast } = await import('../../../components/index')
const { SyncContext } = await import('../../../replica/syncContext')
const { useUnits } = await import('../../../replica/units')
const { CrewBoard } = await import('../CrewBoard')

withSignedInBackend()

const CONNECTED: SyncState = {
  status: 'live',
  canWrite: true,
  outdated: false,
}

const TENACITY = crawlerFixture({
  id: 'c1',
  name: '#430 Tenacity',
  gameId: null,
  type: 'augmented',
  crawlerBays: [{ bayRef: 'command-bay' }, { bayRef: 'med-bay', npcName: 'Old Mags' }],
})
const BULWARK = crawlerFixture({
  id: 'c2',
  name: 'Bulwark',
  gameId: null,
  crawlerBays: [{ bayRef: 'med-bay' }],
})

type Selection = { crawler?: string | undefined; slot?: string | undefined }

function Board({
  crawlerId,
  initialSlot,
  log,
}: {
  crawlerId?: string
  initialSlot?: string
  log: Selection[]
}) {
  const [slot, setSlot] = useState(initialSlot)
  return (
    <CrewBoard
      crawlerId={crawlerId}
      slot={slot}
      madeBy="alxjrvs"
      onSelect={(next) => {
        log.push(next)
        setSlot(next.slot)
      }}
    />
  )
}

async function renderBoard(crawlerId?: string, initialSlot?: string) {
  const log: Selection[] = []
  await act(async () => {
    render(
      <SyncContext.Provider value={CONNECTED}>
        <ToasterMount />
        <Board crawlerId={crawlerId} initialSlot={initialSlot} log={log} />
      </SyncContext.Provider>
    )
  })
  return log
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

function seed(state: Partial<UnitsState>) {
  useUnits.setState({
    crawlers: [TENACITY],
    npcs: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
    ...state,
  })
}

/** The Game listing for g1, holding another member's NPC (and one this app cannot read). */
function gameListing() {
  return {
    pilots: [],
    mechs: [],
    crawlers: [],
    npcs: [
      {
        appId: 'n-sam',
        body: npcFixture({ id: 'n-sam', name: 'Rook', gameId: 'g1' }),
        ownerId: 'u-sam',
      },
      { appId: 'n-bad', body: { name: 42 }, ownerId: 'u-sam' },
    ],
    softLinks: [],
    primaryCrawlerId: null,
  }
}

beforeEach(() => {
  linkWrite = 'ok'
  toast.dismiss()
  seed({})
  setQueryAnswers({ 'games:listMine': [] })
})
afterEach(() => {
  toast.dismiss()
})

describe('which crawler', () => {
  test('with several to crew, the player picks one', async () => {
    seed({ crawlers: [TENACITY, BULWARK] })
    const log = await renderBoard()
    const select = screen.getByLabelText('Crawler')
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Choose a crawler…', '#430 Tenacity', 'Bulwark'])
    await act(async () => {
      fireEvent.change(select, { target: { value: 'c2' } })
    })
    expect(log).toEqual([{ crawler: 'c2' }])
  })

  test('with none to crew, it says where crew comes from', async () => {
    seed({ crawlers: [] })
    await renderBoard()
    expect(screen.getByText(/You have no crawler to crew here/)).toBeTruthy()
  })

  test('a crawler this browser does not hold is said, not guessed at', async () => {
    await renderBoard('nowhere')
    expect(screen.getByText(/That crawler is not one this browser holds/)).toBeTruthy()
  })
})

describe('designing a slot', () => {
  test('a nameless NPC is not saved', async () => {
    await renderBoard('c1', 'med-bay')
    await click(screen.getByRole('button', { name: 'Save and assign to Med Bay' }))
    expect(useUnits.getState().npcs).toHaveLength(0)
    expect(screen.getByText('Give the NPC a name.')).toBeTruthy()
  })

  test('Roll fills the choice from its table and says what it rolled', async () => {
    await renderBoard('c1', 'type')
    const roll = screen.getByRole('button', {
      name: 'Roll A.I. Personality on the A.I. Personality table',
    })
    await click(roll)
    // The field the button sits beside.
    const field = roll.parentElement?.querySelector('input, textarea') as HTMLInputElement
    await waitFor(() => expect(field.value).not.toBe(''))
    expect(screen.getByText(`Rolled: ${field.value}`)).toBeTruthy()
  })

  test('Keep the book’s line closes the slot, writing nothing', async () => {
    const log = await renderBoard('c1', 'med-bay')
    await click(screen.getByRole('button', { name: 'Keep the book’s line' }))
    expect(log).toEqual([{ crawler: 'c1', slot: undefined }])
    expect(useUnits.getState().npcs).toHaveLength(0)
  })

  test('a saved NPC whose assignment fails is said to be saved, not assigned', async () => {
    linkWrite = 'defect'
    await renderBoard('c1', 'med-bay')
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Doc Ambrose' } })
    })
    await click(screen.getByRole('button', { name: 'Save and assign to Med Bay' }))
    expect(
      await screen.findByText(
        'Doc Ambrose is saved, but not assigned: That NPC could not be assigned to the Med Bay. Try again.'
      )
    ).toBeTruthy()
    expect(useUnits.getState().npcs).toHaveLength(1)
    expect(useUnits.getState().softLinks).toHaveLength(0)
  })
})

describe('assigning an NPC already here', () => {
  const MAGS = npcFixture({ id: 'n-mags', name: 'Mags', gameId: null })

  test('assigns it to the slot and closes the slot', async () => {
    seed({ npcs: [MAGS] })
    const log = await renderBoard('c1', 'med-bay')
    const list = screen.getByRole('list', { name: 'NPCs that can crew the Med Bay' })
    await click(within(list).getByRole('button', { name: 'Assign Mags to Med Bay' }))
    await waitFor(() => expect(useUnits.getState().softLinks).toHaveLength(1))
    expect(useUnits.getState().softLinks[0]).toMatchObject({
      from: { type: 'npc', id: 'n-mags' },
      to: { type: 'crawler', id: 'c1' },
      slot: { kind: 'bay', bayRef: 'med-bay' },
    })
    expect(await screen.findByText('Mags crews the Med Bay.')).toBeTruthy()
    expect(log.at(-1)).toEqual({ crawler: 'c1', slot: undefined })
  })

  test('a refusal says the server’s own words, and nothing is linked', async () => {
    linkWrite = 'refused'
    seed({ npcs: [MAGS] })
    await renderBoard('c1', 'med-bay')
    await click(screen.getByRole('button', { name: 'Assign Mags to Med Bay' }))
    expect(await screen.findByText('That NPC is crewing elsewhere.')).toBeTruthy()
    expect(useUnits.getState().softLinks).toHaveLength(0)
  })
})

describe('a Game crawler, crewed by its table runner', () => {
  const GAME_CRAWLER = { ...TENACITY, gameId: 'g1' }

  beforeEach(() => {
    setQueryAnswers({
      'games:listMine': [{ _id: 'g1', name: 'Tenacity', tableRunner: true }],
      'entities:listForGame': gameListing(),
      'games:members': [{ userId: 'u-sam', displayName: 'Sam' }],
    })
  })

  test('another member’s NPC in the Game is offered, and once assigned credited to them', async () => {
    seed({
      crawlers: [GAME_CRAWLER],
      softLinks: [
        softLinkFixture('npc-to-crawler', 'n-sam', 'c1', 'l-sam', {
          kind: 'bay',
          bayRef: 'command-bay',
        }),
      ],
    })
    await renderBoard('c1', 'command-bay')
    // The slot shows the member's NPC, read live from the Game.
    expect(screen.getByRole('radio', { name: /Command Bay: Rook/ })).toBeTruthy()
    expect(screen.getByText('Made by Sam')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Rook' })).toBeTruthy()
    // Unassign is offered to the runner.
    expect(screen.getByRole('button', { name: 'Unassign Rook from Command Bay' })).toBeTruthy()
  })

  test('an assigned NPC that cannot be found is said so', async () => {
    seed({
      crawlers: [GAME_CRAWLER],
      softLinks: [softLinkFixture('npc-to-crawler', 'n-gone', 'c1', 'l-gone')],
    })
    await renderBoard('c1', 'med-bay')
    expect(screen.getByText('Assigned NPC unavailable')).toBeTruthy()
    expect(screen.getByText(/The NPC assigned here cannot be shown/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Unassign the assigned NPC from Med Bay' })
    ).toBeTruthy()
  })

  test('the Game’s NPCs are candidates for an open slot', async () => {
    seed({ crawlers: [GAME_CRAWLER] })
    await renderBoard('c1', 'med-bay')
    const list = screen.getByRole('list', { name: 'NPCs that can crew the Med Bay' })
    expect(within(list).getByRole('button', { name: 'Assign Rook to Med Bay' })).toBeTruthy()
  })
})

describe('a player in someone else’s Game', () => {
  test('an open slot reads the book’s line and the Game rule, offering nothing', async () => {
    seed({ crawlers: [{ ...TENACITY, gameId: 'g1' }] })
    setQueryAnswers({
      'games:listMine': [{ _id: 'g1', name: 'Tenacity', tableRunner: false }],
      'entities:listForGame': gameListing(),
      'games:members': [],
    })
    await renderBoard('c1', 'med-bay')
    expect(screen.getByText(/Old Mags, the Doc holds/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Save and assign/ })).toBeNull()
    expect(screen.queryByLabelText(/Name/)).toBeNull()
  })
})

describe('below 48rem', () => {
  test('closing the slot’s modal goes back to the board', async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia
    try {
      const log = await renderBoard('c1', 'med-bay')
      const dialog = await screen.findByRole('dialog')
      await click(within(dialog).getByRole('button', { name: /close/i }))
      expect(log.at(-1)).toEqual({ crawler: 'c1', slot: undefined })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    } finally {
      window.matchMedia = original
    }
  })
})

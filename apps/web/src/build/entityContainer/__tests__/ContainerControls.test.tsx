import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'

/**
 * The Game / shelf controls (ADR-030 §2): the
 * live-sheet move, and a shelf item's "Move to a Game…" (Shelves).
 *
 * What these pin: both render nothing for somebody who is not signed in
 * (there is no second container to offer), all list the account's Games once
 * loaded, a move re-stamps `gameId` on the SAME entity rather than copying it,
 * a move OUT of a Game asks first (and does nothing until confirmed), a move
 * INTO one asks only when it clears an assignment (ADR-037) and otherwise runs
 * at once, a row offers only the Games the server would accept for its kind,
 * and a record in a container the account cannot reach says so instead of
 * reading as "in your shelves".
 *
 * Signed in here means a real `ConnectionProvider` over a mocked Convex client,
 * whose `mutation` records the server commit a move makes.
 */

import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import {
  crawlerFixture,
  FIXTURE_NOW,
  mechFixture,
  pilotFixture,
} from '../../../components/__tests__/fixtures'

let authed = true
const serverWrites: { name: string; args: Record<string, unknown> }[] = []
/** Set to make the next server commit fail, as an offline or refused write would. */
let failWrites = false

const convexMocks = await installConvexMocks({
  convexReact: { useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }) },
  also: {
    '../../lib/connection/convexClient': () => ({
      convexClient: {
        mutation: async (ref: unknown, args: Record<string, unknown>) => {
          if (failWrites) throw new Error('[CONVEX M(entities:upsertByAppId)] Server Error')
          serverWrites.push({ name: getFunctionName(ref as FunctionReference<'mutation'>), args })
          // `upsertByAppId` answers with the row's new version.
          return { updatedAt: 1 }
        },
      },
    }),
  },
})

const { MoveToContainerControl } = await import('../MoveToContainerControl')
const { MoveToGameDialog } = await import('../../shelves/MoveToGameDialog')
const { useConfirm } = await import('../../../components/shared/useConfirm')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const { resetStores } = await import('../../../stores/__tests__/resetStores')

afterAll(() => {
  convexMocks.restore()
})

const GAMES = [
  { _id: 'g1', name: 'Union Crawler #430' },
  { _id: 'g2', name: 'The Long Haul' },
]

const wrap = (ui: ReactNode) => render(<ConnectionProvider>{ui}</ConnectionProvider>)

beforeEach(() => {
  authed = true
  failWrites = false
  serverWrites.length = 0
  resetStores()
  // The server's first answer is in, as `ShelfSync` marks it.
  useEntityStore.getState().markArrived(['pilot', 'mech', 'crawler', 'npc', 'softLink'])
  setQueryAnswers({ 'games:listMine': GAMES })
})

afterEach(() => {
  // Process-global: a leaked signed-in state changes what later files exercise.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

type MoveProps = Omit<ComponentProps<typeof MoveToContainerControl>, 'confirm'>

/** The control as the sheet mounts it: the confirm owned by an ancestor. */
function MoveHarness(props: MoveProps) {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <MoveToContainerControl {...props} confirm={confirm} />
      {dialog}
    </>
  )
}

/** A signed-in player's pilot, held in the store where a move will look for it. */
async function heldPilot(gameId: string | null) {
  const pilot = pilotFixture({ id: 'p1', name: 'Mira Cole', gameId })
  // Held the way a signed-in player's roster is: adopted as the server sent it.
  // `ConnectionProvider` pushes this same signed-in state on mount; pushing it
  // first lets the move commit.
  setEntityBackendAuthState({ signedIn: true, online: true, authSettled: true })
  await useEntityStore.getState().adopt('pilot', pilot)
  return pilot
}

const gameIdOf = () => useEntityStore.getState().list('pilot')[0]?.gameId

/** Thresher, a mech on the shelf, flying Mira Cole (who must be held first). */
async function pairedWithShelfMech() {
  await useEntityStore
    .getState()
    .adopt('mech', mechFixture({ id: 'm1', name: 'Thresher', gameId: null }))
  await useEntityStore.getState().adopt('softLink', {
    id: 'link-pairing',
    type: 'mech-to-pilot',
    from: { type: 'mech', id: 'm1' },
    to: { type: 'pilot', id: 'p1' },
    createdAt: FIXTURE_NOW,
  })
}

/** Big Sal, a crawler on the shelf, crewed by Mira Cole (who must be held first). */
async function crewingShelfCrawler() {
  await useEntityStore
    .getState()
    .adopt('crawler', crawlerFixture({ id: 'c1', name: 'Big Sal', gameId: null }))
  await useEntityStore.getState().adopt('softLink', {
    id: 'link-crew',
    type: 'pilot-to-crawler',
    from: { type: 'pilot', id: 'p1' },
    to: { type: 'crawler', id: 'c1' },
    createdAt: FIXTURE_NOW,
  })
}

const linkIds = () => useEntityStore.getState().softLinks.map((l) => l.id)

describe('MoveToContainerControl', () => {
  test('renders nothing for somebody who is not signed in', () => {
    authed = false
    const { container } = wrap(
      <MoveHarness entityType="pilot" entityId="p1" entity={{ name: 'Mira Cole', gameId: null }} />
    )
    expect(container.textContent).toBe('')
  })

  test('a move re-homes the same entity — same id, new gameId, sent to the server', async () => {
    const pilot = await heldPilot(null)
    let changed = 0
    wrap(
      <MoveHarness entityType="pilot" entityId="p1" entity={pilot} onChanged={() => changed++} />
    )

    fireEvent.change(screen.getByLabelText('Move to a Game or your Training Bay'), {
      target: { value: 'game:g1' },
    })

    await waitFor(() => expect(changed).toBe(1))
    // Into a Game from the Shelf, with nothing to clear: no confirm.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    const pilots = useEntityStore.getState().list('pilot')
    // One entity, moved — never a copy. A copy would leave two of the same
    // character with no way to tell which one the table can see.
    expect(pilots.map((p) => [p.id, p.gameId])).toEqual([['p1', 'g1']])
    // The unit's op: the move is the field it writes (ADR-063).
    expect(serverWrites.find((w) => w.name === 'ops:apply')?.args).toMatchObject({
      gameId: 'g1',
      op: { unitId: 'p1', patch: { gameId: 'g1' } },
    })
  })

  test('a crawler moves through its own mutation, which files it in every place at once', async () => {
    setQueryAnswers({
      'games:listMine': [
        { _id: 'g1', name: 'Run by me', tableRunner: true },
        { _id: 'g2', name: 'Not mine to run', tableRunner: false },
      ],
    })
    const crawler = crawlerFixture({ id: 'c1', gameId: null })
    setEntityBackendAuthState({ signedIn: true, online: true, authSettled: true })
    await useEntityStore.getState().adopt('crawler', crawler)
    let changed = 0
    wrap(
      <MoveHarness
        entityType="crawler"
        entityId="c1"
        entity={crawler}
        onChanged={() => changed++}
      />
    )

    const select = screen.getByLabelText('Move to a Game or your Training Bay') as HTMLSelectElement
    // Only a Game this user runs is on offer for a crawler (ADR-037).
    expect([...select.options].map((o) => o.textContent)).toEqual(['Training Bay', 'Run by me'])

    fireEvent.change(select, { target: { value: 'game:g1' } })

    await waitFor(() => expect(changed).toBe(1))
    expect(serverWrites.find((w) => w.name === 'entities:moveCrawler')?.args).toEqual({
      appId: 'c1',
      gameId: 'g1',
    })
    // Never as an op: a "moved" crawler stays put that way.
    expect(serverWrites.some((w) => w.name === 'ops:apply')).toBe(false)
  })

  test('a crawler in a Game somebody else runs offers nowhere to go', () => {
    setQueryAnswers({ 'games:listMine': [{ _id: 'g2', name: 'Not mine', tableRunner: false }] })
    wrap(
      <MoveHarness
        entityType="crawler"
        entityId="c1"
        entity={crawlerFixture({ id: 'c1', gameId: 'g2' })}
      />
    )
    const select = screen.getByLabelText('Move to a Game or your Training Bay') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['Not mine'])
    expect(select.disabled).toBe(true)
  })

  test('a container the account cannot reach is named, not passed off as Training Bay', () => {
    wrap(
      <MoveHarness
        entityType="pilot"
        entityId="p1"
        entity={{ name: 'Mira Cole', gameId: 'phantom' }}
      />
    )
    const select = screen.getByLabelText('Move to a Game or your Training Bay') as HTMLSelectElement
    expect(select.value).toBe('game:phantom')
    expect(select.selectedOptions[0]?.textContent).toBe('Unknown Game')
  })
})

describe('MoveToContainerControl — moving into a Game clears an assignment', () => {
  const select = () =>
    screen.getByLabelText('Move to a Game or your Training Bay') as HTMLSelectElement

  test('asks first, naming what is cleared, and writes nothing until confirmed', async () => {
    const pilot = await heldPilot(null)
    await pairedWithShelfMech()
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(select(), { target: { value: 'game:g1' } })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Move Mira Cole into Union Crawler #430?')
    expect(dialog.textContent).toContain(
      'Their pairing with Thresher (still in your Training Bay) is cleared.'
    )
    expect(gameIdOf()).toBeNull()
    expect(linkIds()).toEqual(['link-pairing'])
    expect(serverWrites).toHaveLength(0)
  })

  test('Cancel leaves the build, its pairing and the select where they were', async () => {
    const pilot = await heldPilot(null)
    await pairedWithShelfMech()
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(select(), { target: { value: 'game:g1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(gameIdOf()).toBeNull()
    expect(linkIds()).toEqual(['link-pairing'])
    expect(serverWrites).toHaveLength(0)
    expect(select().value).toBe('shelf')
  })

  test('confirming moves it, and clears exactly what the dialog named', async () => {
    const pilot = await heldPilot(null)
    await pairedWithShelfMech()
    let changed = 0
    wrap(
      <MoveHarness entityType="pilot" entityId="p1" entity={pilot} onChanged={() => changed++} />
    )

    fireEvent.change(select(), { target: { value: 'game:g1' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move' }))
    })

    await waitFor(() => expect(changed).toBe(1))
    expect(gameIdOf()).toBe('g1')
    expect(linkIds()).toEqual([])
    expect(serverWrites.find((w) => w.name === 'ops:apply')?.args).toMatchObject({
      gameId: 'g1',
      op: { unitId: 'p1', patch: { gameId: 'g1' } },
    })
  })
})

describe('MoveToContainerControl — taking a build out of a Game', () => {
  test('asks first, naming the game, and moves nothing until confirmed', async () => {
    const pilot = await heldPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a Game or your Training Bay'), {
      target: { value: 'shelf' },
    })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Move Mira Cole out of Union Crawler #430?')
    expect(dialog.textContent).toContain('goes back to your Training Bay')
    // A move prunes what it would leave straddling two containers (ADR-037).
    expect(dialog.textContent).toContain(
      'Their crawler assignment in Union Crawler #430 is cleared'
    )
    expect(gameIdOf()).toBe('g1')
    expect(serverWrites).toHaveLength(0)
  })

  test('Cancel leaves it in the game', async () => {
    const pilot = await heldPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a Game or your Training Bay'), {
      target: { value: 'shelf' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(gameIdOf()).toBe('g1')
    expect(serverWrites).toHaveLength(0)
    // The select still says where the build actually is.
    expect(
      (screen.getByLabelText('Move to a Game or your Training Bay') as HTMLSelectElement).value
    ).toBe('game:g1')
  })

  test('confirming moves it to your shelves', async () => {
    const pilot = await heldPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a Game or your Training Bay'), {
      target: { value: 'shelf' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move to your Training Bay' }))
    })

    await waitFor(() => expect(gameIdOf()).toBeNull())
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(serverWrites.find((w) => w.name === 'ops:apply')?.args).toMatchObject({
      gameId: null,
      op: { unitId: 'p1', patch: { gameId: null } },
    })
  })

  test('a move to another game is asked about too, naming both', async () => {
    const pilot = await heldPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a Game or your Training Bay'), {
      target: { value: 'game:g2' },
    })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Move Mira Cole to The Long Haul?')
    expect(dialog.textContent).toContain("leaves Union Crawler #430's roster")
    expect(gameIdOf()).toBe('g1')
  })

  test('a failed move keeps the dialog open with a reason, and the build where it was', async () => {
    const pilot = await heldPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a Game or your Training Bay'), {
      target: { value: 'shelf' },
    })
    failWrites = true
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move to your Training Bay' }))
    })

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    // The redacted server string is never what the player reads.
    expect(screen.getByRole('alert').textContent).toBe('Mira Cole could not be moved. Try again.')
    expect(gameIdOf()).toBe('g1')
  })
})

type DialogProps = Omit<ComponentProps<typeof MoveToGameDialog>, 'confirm' | 'onClose'>

/** The dialog as Shelves mounts it: the confirm owned by the page. */
function DialogHarness(props: DialogProps) {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <MoveToGameDialog {...props} onClose={() => {}} confirm={confirm} />
      {dialog}
    </>
  )
}

/** `GAMES`, with who runs each — the shape the move rules read. */
const GAMES_RUN = GAMES.map((g) => ({ ...g, tableRunner: false }))

describe('MoveToGameDialog — "Move to a Game…" in a Training Bay item', () => {
  const RUN_AND_NOT = [
    { _id: 'g1', name: 'Run by me', tableRunner: true },
    { _id: 'g2', name: 'Not mine to run', tableRunner: false },
  ]
  // Each destination is a Compact (ruleset §1.9), the whole Compact the pick.
  const choices = () =>
    within(screen.getByRole('list', { name: 'Where to' }))
      .getAllByRole('button')
      .map((row) => row.getAttribute('aria-label'))
  const pilotIn = (gameId: string | null) => ({
    type: 'pilot' as const,
    id: 'p1',
    entity: { name: 'Mira Cole', gameId },
  })

  test('a pilot or mech may go into any of my Games', () => {
    wrap(<DialogHarness subject={pilotIn(null)} games={RUN_AND_NOT} />)
    expect(choices()).toEqual(['Run by me', 'Not mine to run'])
  })

  test('out of a Game, the shelf reads "Not in a Game"', () => {
    wrap(<DialogHarness subject={pilotIn('g1')} games={RUN_AND_NOT} />)
    expect(choices()).toEqual(['Not in a Game', 'Not mine to run'])
  })

  test('a crawler only into a Game I run — and with none, it says so', () => {
    const hulk = { type: 'crawler' as const, id: 'c1', entity: { name: 'Hulk', gameId: null } }
    wrap(<DialogHarness subject={hulk} games={RUN_AND_NOT} />)
    expect(choices()).toEqual(['Run by me'])

    cleanup()
    wrap(<DialogHarness subject={hulk} games={RUN_AND_NOT.slice(1)} />)
    expect(screen.queryByRole('list', { name: 'Where to' })).toBeNull()
    expect(screen.getByText(/only into a Game you run/)).toBeTruthy()
  })

  test('moving in asks nothing and re-homes the same entity on the server', async () => {
    const pilot = await heldPilot(null)
    wrap(<DialogHarness subject={{ type: 'pilot', id: 'p1', entity: pilot }} games={GAMES_RUN} />)

    fireEvent.click(screen.getByRole('button', { name: 'The Long Haul' }))

    await waitFor(() => expect(gameIdOf()).toBe('g2'))
    // Into a Game with nothing to clear: no confirm.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(
      useEntityStore
        .getState()
        .list('pilot')
        .map((p) => p.id)
    ).toEqual(['p1'])
    expect(serverWrites.find((w) => w.name === 'ops:apply')?.args).toMatchObject({
      gameId: 'g2',
      op: { unitId: 'p1', patch: { gameId: 'g2' } },
    })
  })

  test('a move that clears an assignment asks first and writes nothing until confirmed', async () => {
    const pilot = await heldPilot(null)
    await crewingShelfCrawler()
    wrap(<DialogHarness subject={{ type: 'pilot', id: 'p1', entity: pilot }} games={GAMES_RUN} />)

    fireEvent.click(screen.getByRole('button', { name: 'The Long Haul' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Move Mira Cole into The Long Haul?')
    expect(dialog.textContent).toContain("They leave Big Sal's crew.")
    expect(gameIdOf()).toBeNull()
    expect(linkIds()).toEqual(['link-crew'])
    expect(serverWrites).toHaveLength(0)
  })

  test('confirming moves it and clears the crew link', async () => {
    const pilot = await heldPilot(null)
    await crewingShelfCrawler()
    wrap(<DialogHarness subject={{ type: 'pilot', id: 'p1', entity: pilot }} games={GAMES_RUN} />)

    fireEvent.click(screen.getByRole('button', { name: 'The Long Haul' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move' }))
    })

    await waitFor(() => expect(gameIdOf()).toBe('g2'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(linkIds()).toEqual([])
    expect(serverWrites.find((w) => w.name === 'ops:apply')?.args).toMatchObject({
      gameId: 'g2',
      op: { unitId: 'p1', patch: { gameId: 'g2' } },
    })
  })

  test('back out of a Game always asks first', async () => {
    const pilot = await heldPilot('g1')
    wrap(<DialogHarness subject={{ type: 'pilot', id: 'p1', entity: pilot }} games={GAMES_RUN} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not in a Game' }))

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(gameIdOf()).toBe('g1')
    expect(serverWrites).toHaveLength(0)
  })
})

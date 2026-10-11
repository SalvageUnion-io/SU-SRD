import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'

/**
 * The Game / Shelves controls (ADR-030 §2): the hub's "Showing" select, the
 * live-sheet move, and a Shelves row's "Move to game…".
 *
 * What these pin: all three render nothing for somebody who is not signed in
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
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { crawlerFixture, FIXTURE_NOW, mechFixture, pilotFixture } from '../../__tests__/fixtures'

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

const { ContainerSwitcher } = await import('../ContainerSwitcher')
const { MoveToContainerControl } = await import('../MoveToContainerControl')
const { MoveToGameSelect } = await import('../MoveToGameSelect')
const { useConfirm } = await import('../../shared/useConfirm')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const db = await import('../../../lib/db/index')

afterAll(() => {
  convexMocks.restore()
})

const GAMES = [
  { _id: 'g1', name: 'Union Crawler #430' },
  { _id: 'g2', name: 'The Long Haul' },
]

const wrap = (ui: ReactNode) => render(<ConnectionProvider>{ui}</ConnectionProvider>)

beforeEach(async () => {
  authed = true
  failWrites = false
  serverWrites.length = 0
  db._resetDbSingleton()
  await db.clearCache()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
  })
  setQueryAnswers({ 'games:listMine': GAMES })
})

afterEach(() => {
  // Process-global: a leaked signed-in state changes what later files exercise.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

describe('ContainerSwitcher', () => {
  test('renders nothing for somebody who is not signed in', () => {
    authed = false
    const { container } = wrap(
      <ContainerSwitcher activeContainer={{ kind: 'shelf' }} onSelect={() => {}} />
    )
    expect(container.textContent).toBe('')
  })

  test('"Showing" offers Shelves and every Game, and reports the pick as a container', () => {
    const picks: unknown[] = []
    wrap(<ContainerSwitcher activeContainer={{ kind: 'shelf' }} onSelect={(c) => picks.push(c)} />)

    // Named by its visible label, so what a screen reader says matches what
    // the page shows.
    const select = screen.getByLabelText('Showing') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Shelves',
      'Union Crawler #430',
      'The Long Haul',
    ])

    fireEvent.change(select, { target: { value: 'game:g2' } })
    expect(picks).toEqual([{ kind: 'game', gameId: 'g2' }])
  })

  test('while Games load, the current selection still has an option', () => {
    setQueryAnswers({ 'games:listMine': undefined })
    wrap(<ContainerSwitcher activeContainer={{ kind: 'shelf' }} onSelect={() => {}} />)
    const select = screen.getByLabelText('Showing') as HTMLSelectElement
    expect(select.value).toBe('shelf')
  })
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

/** A signed-in player's pilot, cached where a move will look for it. */
async function cachedPilot(gameId: string | null) {
  const pilot = pilotFixture({ id: 'p1', name: 'Mira Cole', gameId })
  // Cached the way a signed-in player's roster is: in the IndexedDB cache.
  // `ConnectionProvider` pushes this same state on mount; pushing it first
  // puts the row where the move will look for it.
  setEntityBackendAuthState({ signedIn: true, online: true, authSettled: true })
  await useEntityStore.getState().adopt('pilot', pilot)
  return pilot
}

const gameIdOf = () => useEntityStore.getState().list('pilot')[0]?.gameId

/** Thresher, a mech on the shelf, flying Mira Cole (who must be cached first). */
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

/** Big Sal, a crawler on the shelf, crewed by Mira Cole (who must be cached first). */
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
    const pilot = await cachedPilot(null)
    let changed = 0
    wrap(
      <MoveHarness entityType="pilot" entityId="p1" entity={pilot} onChanged={() => changed++} />
    )

    fireEvent.change(screen.getByLabelText('Move to a game or your shelves'), {
      target: { value: 'game:g1' },
    })

    await waitFor(() => expect(changed).toBe(1))
    // Into a Game from the Shelf, with nothing to clear: no confirm.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    const pilots = useEntityStore.getState().list('pilot')
    // One entity, moved — never a copy. A copy would leave two of the same
    // character with no way to tell which one the table can see.
    expect(pilots.map((p) => [p.id, p.gameId])).toEqual([['p1', 'g1']])
    // The entity commit, not the Change Log row that follows it.
    expect(serverWrites.find((w) => w.args.appId === 'p1')?.args).toMatchObject({
      appId: 'p1',
      gameId: 'g1',
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

    const select = screen.getByLabelText('Move to a game or your shelves') as HTMLSelectElement
    // Only a Game this user runs is on offer for a crawler (ADR-037).
    expect([...select.options].map((o) => o.textContent)).toEqual(['Shelves', 'Run by me'])

    fireEvent.change(select, { target: { value: 'game:g1' } })

    await waitFor(() => expect(changed).toBe(1))
    expect(serverWrites.find((w) => w.name === 'entities:moveCrawler')?.args).toEqual({
      appId: 'c1',
      gameId: 'g1',
    })
    // Never as a body patch: that is how a "moved" crawler used to stay put.
    expect(serverWrites.some((w) => w.name === 'entities:patchCrawlerByAppId')).toBe(false)
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
    const select = screen.getByLabelText('Move to a game or your shelves') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['Not mine'])
    expect(select.disabled).toBe(true)
  })

  test('a container the account cannot reach is named, not passed off as Shelves', () => {
    wrap(
      <MoveHarness
        entityType="pilot"
        entityId="p1"
        entity={{ name: 'Mira Cole', gameId: 'phantom' }}
      />
    )
    const select = screen.getByLabelText('Move to a game or your shelves') as HTMLSelectElement
    expect(select.value).toBe('game:phantom')
    expect(select.selectedOptions[0]?.textContent).toBe('Unknown game')
  })
})

describe('MoveToContainerControl — moving into a Game clears an assignment', () => {
  const select = () => screen.getByLabelText('Move to a game or your shelves') as HTMLSelectElement

  test('asks first, naming what is cleared, and writes nothing until confirmed', async () => {
    const pilot = await cachedPilot(null)
    await pairedWithShelfMech()
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(select(), { target: { value: 'game:g1' } })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Move Mira Cole into Union Crawler #430?')
    expect(dialog.textContent).toContain(
      'Their pairing with Thresher (still on your shelves) is cleared.'
    )
    expect(gameIdOf()).toBeNull()
    expect(linkIds()).toEqual(['link-pairing'])
    expect(serverWrites).toHaveLength(0)
  })

  test('Cancel leaves the build, its pairing and the select where they were', async () => {
    const pilot = await cachedPilot(null)
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
    const pilot = await cachedPilot(null)
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
    expect(serverWrites.find((w) => w.args.appId === 'p1')?.args).toMatchObject({
      appId: 'p1',
      gameId: 'g1',
    })
  })
})

describe('MoveToContainerControl — taking a build out of a Game', () => {
  test('asks first, naming the game, and moves nothing until confirmed', async () => {
    const pilot = await cachedPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a game or your shelves'), {
      target: { value: 'shelf' },
    })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Take Mira Cole out of Union Crawler #430?')
    expect(dialog.textContent).toContain('goes back to your shelves')
    // A move prunes what it would leave straddling two containers (ADR-037).
    expect(dialog.textContent).toContain(
      'Their crawler assignment in Union Crawler #430 is cleared'
    )
    expect(gameIdOf()).toBe('g1')
    expect(serverWrites).toHaveLength(0)
  })

  test('Cancel leaves it in the game', async () => {
    const pilot = await cachedPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a game or your shelves'), {
      target: { value: 'shelf' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(gameIdOf()).toBe('g1')
    expect(serverWrites).toHaveLength(0)
    // The select still says where the build actually is.
    expect(
      (screen.getByLabelText('Move to a game or your shelves') as HTMLSelectElement).value
    ).toBe('game:g1')
  })

  test('confirming moves it to your shelves', async () => {
    const pilot = await cachedPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a game or your shelves'), {
      target: { value: 'shelf' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move to your shelves' }))
    })

    await waitFor(() => expect(gameIdOf()).toBeNull())
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(serverWrites.find((w) => w.args.appId === 'p1')?.args).toMatchObject({
      appId: 'p1',
      gameId: null,
    })
  })

  test('a move to another game is asked about too, naming both', async () => {
    const pilot = await cachedPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a game or your shelves'), {
      target: { value: 'game:g2' },
    })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Move Mira Cole to The Long Haul?')
    expect(dialog.textContent).toContain("leaves Union Crawler #430's roster")
    expect(gameIdOf()).toBe('g1')
  })

  test('a failed move keeps the dialog open with a reason, and the build where it was', async () => {
    const pilot = await cachedPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to a game or your shelves'), {
      target: { value: 'shelf' },
    })
    failWrites = true
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move to your shelves' }))
    })

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    // The redacted server string is never what the player reads.
    expect(screen.getByRole('alert').textContent).toBe('Mira Cole could not be moved. Try again.')
    expect(gameIdOf()).toBe('g1')
  })
})

type RowProps = Omit<ComponentProps<typeof MoveToGameSelect>, 'confirm'>

/** The select as the Roster mounts it: the confirm owned by the page. */
function RowHarness(props: RowProps) {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <MoveToGameSelect {...props} confirm={confirm} />
      {dialog}
    </>
  )
}

describe('MoveToGameSelect — "Move to game…" on a Shelves row', () => {
  const RUN_AND_NOT = [
    { _id: 'g1', name: 'Run by me', tableRunner: true },
    { _id: 'g2', name: 'Not mine to run', tableRunner: false },
  ]
  const optionsOf = (name: string) =>
    [...(screen.getByLabelText(`Move ${name} to a game`) as HTMLSelectElement).options].map(
      (o) => o.textContent
    )

  test('renders nothing for somebody who is not signed in', () => {
    authed = false
    const { container } = wrap(
      <RowHarness entityType="pilot" entityId="p1" entity={{ name: 'Mira Cole', gameId: null }} />
    )
    expect(container.textContent).toBe('')
  })

  test('a pilot or mech may go into any of my Games', () => {
    setQueryAnswers({ 'games:listMine': RUN_AND_NOT })
    wrap(
      <>
        <RowHarness entityType="pilot" entityId="p1" entity={{ name: 'Mira', gameId: null }} />
        <RowHarness entityType="mech" entityId="m1" entity={{ name: 'Jaw', gameId: null }} />
      </>
    )
    expect(optionsOf('Mira')).toEqual(['Move to game…', 'Run by me', 'Not mine to run'])
    expect(optionsOf('Jaw')).toEqual(['Move to game…', 'Run by me', 'Not mine to run'])
  })

  test('a crawler only into a Game I run — and with none, there is no control at all', () => {
    setQueryAnswers({ 'games:listMine': RUN_AND_NOT })
    wrap(<RowHarness entityType="crawler" entityId="c1" entity={{ name: 'Hulk', gameId: null }} />)
    expect(optionsOf('Hulk')).toEqual(['Move to game…', 'Run by me'])

    cleanup()
    setQueryAnswers({ 'games:listMine': [RUN_AND_NOT[1]] })
    const { container } = wrap(
      <RowHarness entityType="crawler" entityId="c1" entity={{ name: 'Hulk', gameId: null }} />
    )
    expect(container.textContent).toBe('')
  })

  test('moving in asks nothing and re-homes the same entity on the server', async () => {
    const pilot = await cachedPilot(null)
    wrap(<RowHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move Mira Cole to a game'), {
      target: { value: 'game:g2' },
    })

    await waitFor(() => expect(gameIdOf()).toBe('g2'))
    // Into a Game with nothing to clear: no confirm.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(
      useEntityStore
        .getState()
        .list('pilot')
        .map((p) => p.id)
    ).toEqual(['p1'])
    expect(serverWrites.find((w) => w.args.appId === 'p1')?.args).toMatchObject({
      appId: 'p1',
      gameId: 'g2',
    })
  })

  test('a move that clears an assignment asks first and writes nothing until confirmed', async () => {
    const pilot = await cachedPilot(null)
    await crewingShelfCrawler()
    wrap(<RowHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move Mira Cole to a game'), {
      target: { value: 'game:g2' },
    })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Move Mira Cole into The Long Haul?')
    expect(dialog.textContent).toContain("They leave Big Sal's crew.")
    expect(gameIdOf()).toBeNull()
    expect(linkIds()).toEqual(['link-crew'])
    expect(serverWrites).toHaveLength(0)
  })

  test('Cancel leaves the row as it was', async () => {
    const pilot = await cachedPilot(null)
    await crewingShelfCrawler()
    wrap(<RowHarness entityType="pilot" entityId="p1" entity={pilot} />)

    const select = screen.getByLabelText('Move Mira Cole to a game') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'game:g2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(gameIdOf()).toBeNull()
    expect(linkIds()).toEqual(['link-crew'])
    expect(serverWrites).toHaveLength(0)
    // Back on the placeholder: no move is chosen.
    expect(select.value).toBe('')
  })

  test('confirming moves it and clears the crew link', async () => {
    const pilot = await cachedPilot(null)
    await crewingShelfCrawler()
    wrap(<RowHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move Mira Cole to a game'), {
      target: { value: 'game:g2' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move' }))
    })

    await waitFor(() => expect(gameIdOf()).toBe('g2'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(linkIds()).toEqual([])
    expect(serverWrites.find((w) => w.args.appId === 'p1')?.args).toMatchObject({
      appId: 'p1',
      gameId: 'g2',
    })
  })
})

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'

/**
 * The two Game / Shelf controls (ADR-030 §2): the header switcher and the
 * live-sheet move.
 *
 * What these pin: both render nothing for somebody who is not signed in (there
 * is no second container to offer), both list the account's Games once loaded,
 * a move re-stamps `gameId` on the SAME entity rather than copying it, a move
 * OUT of a Game asks first (and does nothing until confirmed), and a record in
 * a container the account cannot reach says so instead of reading as "on the
 * Shelf".
 *
 * Signed in here means a real `ConnectionProvider` over a mocked Convex client,
 * whose `mutation` records the server commit a move makes.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { pilotFixture } from '../../__tests__/fixtures'

let authed = true
const serverWrites: { args: Record<string, unknown> }[] = []
/** Set to make the next server commit fail, as an offline or refused write would. */
let failWrites = false

const convexMocks = await installConvexMocks({
  convexReact: { useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }) },
  also: {
    '../../lib/connection/convexClient': () => ({
      isConvexConfigured: true,
      convexClient: {
        mutation: async (_ref: unknown, args: Record<string, unknown>) => {
          if (failWrites) throw new Error('[CONVEX M(entities:upsertByAppId)] Server Error')
          serverWrites.push({ args })
        },
      },
    }),
  },
})

const { ContainerSwitcher } = await import('../ContainerSwitcher')
const { MoveToContainerControl } = await import('../MoveToContainerControl')
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
  await db._clearAllStores()
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

  test('offers the Shelf and every Game, and reports the pick as a container', () => {
    const picks: unknown[] = []
    wrap(<ContainerSwitcher activeContainer={{ kind: 'shelf' }} onSelect={(c) => picks.push(c)} />)

    const select = screen.getByLabelText('Select container') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Shelf',
      'Union Crawler #430',
      'The Long Haul',
    ])

    fireEvent.change(select, { target: { value: 'game:g2' } })
    expect(picks).toEqual([{ kind: 'game', gameId: 'g2' }])
  })

  test('while Games load, the current selection still has an option', () => {
    setQueryAnswers({ 'games:listMine': undefined })
    wrap(<ContainerSwitcher activeContainer={{ kind: 'shelf' }} onSelect={() => {}} />)
    const select = screen.getByLabelText('Select container') as HTMLSelectElement
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

    fireEvent.change(screen.getByLabelText('Move to Game or Shelf'), {
      target: { value: 'game:g1' },
    })

    await waitFor(() => expect(changed).toBe(1))
    // Into a Game from the Shelf takes nothing from anybody: no confirm.
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

  test('a container the account cannot reach is named, not passed off as the Shelf', () => {
    wrap(
      <MoveHarness
        entityType="pilot"
        entityId="p1"
        entity={{ name: 'Mira Cole', gameId: 'phantom' }}
      />
    )
    const select = screen.getByLabelText('Move to Game or Shelf') as HTMLSelectElement
    expect(select.value).toBe('game:phantom')
    expect(select.selectedOptions[0]?.textContent).toBe('Unknown game')
  })
})

describe('MoveToContainerControl — taking a build out of a Game', () => {
  test('asks first, naming the game, and moves nothing until confirmed', async () => {
    const pilot = await cachedPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to Game or Shelf'), {
      target: { value: 'shelf' },
    })

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Take Mira Cole out of Union Crawler #430?')
    expect(dialog.textContent).toContain('goes back to My stuff')
    expect(gameIdOf()).toBe('g1')
    expect(serverWrites).toHaveLength(0)
  })

  test('Cancel leaves it in the game', async () => {
    const pilot = await cachedPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to Game or Shelf'), {
      target: { value: 'shelf' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(gameIdOf()).toBe('g1')
    expect(serverWrites).toHaveLength(0)
    // The select still says where the build actually is.
    expect((screen.getByLabelText('Move to Game or Shelf') as HTMLSelectElement).value).toBe(
      'game:g1'
    )
  })

  test('confirming moves it to the Shelf', async () => {
    const pilot = await cachedPilot('g1')
    wrap(<MoveHarness entityType="pilot" entityId="p1" entity={pilot} />)

    fireEvent.change(screen.getByLabelText('Move to Game or Shelf'), {
      target: { value: 'shelf' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move to My stuff' }))
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

    fireEvent.change(screen.getByLabelText('Move to Game or Shelf'), {
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

    fireEvent.change(screen.getByLabelText('Move to Game or Shelf'), {
      target: { value: 'shelf' },
    })
    failWrites = true
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move to My stuff' }))
    })

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    // The redacted server string is never what the player reads.
    expect(screen.getByRole('alert').textContent).toBe('Mira Cole could not be moved. Try again.')
    expect(gameIdOf()).toBe('g1')
  })
})

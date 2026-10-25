/**
 * The Cockpit's end column (`PlayCrewSection`, `PlayerTablesAndFeed` over one
 * `usePlaySide`, as `PlayCockpit` stacks them; play.md §7–§9) against
 * answered queries: the Crew's presence and attention lines and the sheet
 * they open, the Feed's order and Accept, the Tables' pinned rolls, and every
 * roll's Discord post (`channelBindings.postRoll`, mocked), its failure shown
 * on the Feed. Offline, nothing is offered and a roll says it was not posted.
 *
 * The column is handed a hand-built `Play`: its own reads (`useGameFeed`,
 * the seats, the binding) are what is under test.
 */

import { afterAll, afterEach, beforeAll, describe, expect, jest, mock, test } from 'bun:test'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { PostRollResult } from 'game-domain/games/discord'
import { PRESENCE_HEARTBEAT_MS, PRESENCE_STALE_MS } from 'game-domain/schemas/seat'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import { pilotFixture } from '../../components/__tests__/fixtures'
import type { SyncStatus } from '../../replica/sync'
import type { PlayTarget } from '../play.model'
import type { Play } from '../situation.model'
import { crewAt } from './crewFixture'

const mutations: { name: string; args: unknown }[] = []
let postResult: () => Promise<PostRollResult> = async () => ({
  kind: 'posted',
  channelId: 'c-1',
  messageId: 'm-1',
})
const postRoll = mock((_args: unknown) => postResult())

const convexMocks = await installConvexMocks({
  convexReact: {
    useMutation: (ref: unknown) => {
      const name = getFunctionName(ref as FunctionReference<'mutation'>)
      const send = async (args: unknown) => {
        mutations.push({ name, args })
      }
      return Object.assign(send, { withOptimisticUpdate: () => send })
    },
    useAction: () => postRoll,
  },
})

const { PlayCrewSection, PlayerTablesAndFeed } = await import('../PlaySideColumn')
const { usePlaySide } = await import('../usePlaySide')

/** The end column as the Cockpit stacks it: the Crew, then the Tables and Feed. */
function SideColumn({ target, play }: { target: PlayTarget; play: Play }) {
  const side = usePlaySide({ target, play })
  return (
    <>
      <PlayCrewSection target={target} play={play} side={side} />
      <PlayerTablesAndFeed target={target} play={play} side={side} />
    </>
  )
}
const { SyncContext } = await import('../../replica/syncContext')
const { recordPlayRoll, recordPlayChange, clearPlayRolls, reportingRoll } = await import(
  '../playRolls.model'
)
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')

const GAME = 'side-g1'
const BOUND = { channelId: 'c-1', channelName: 'salvage-run', boundAt: 1 }
const NOW = Date.now()

const PROPOSAL = {
  _id: 'p-1',
  entityId: 'bonesaw',
  entityType: 'pilot',
  targetName: 'Bonesaw',
  field: 'currentHP',
  after: 5,
  reason: 'shrapnel',
  ts: NOW - 60_000,
}

function answers(over: Record<string, unknown> = {}) {
  setQueryAnswers({
    'games:get': { name: 'Rust Belt Run', organizer: false },
    'changeLog:rolls': [
      {
        _id: 'r-1',
        ts: NOW - 30_000,
        description: 'Mags · Core Mechanic · 20 · Nailed it',
        actorName: 'Mags',
        source: 'play',
      },
    ],
    'proposals:alerts': [],
    'proposals:pending': [PROPOSAL],
    'crew:vitals': crewAt(NOW),
    'account:me': { _id: 'u-me', displayName: 'Me', avatarUrl: null, email: null },
    'entities:listForGame': null,
    'seats:forGame': [],
    'channelBindings:current': BOUND,
    ...over,
  })
}

function playFor(target: PlayTarget, canWrite: boolean): Play {
  const pilot = pilotFixture({
    id: 'bonesaw',
    name: 'Bonesaw',
    callsign: 'Bonesaw',
    gameId: target.gameId,
  })
  return {
    target,
    pilot,
    situation: 'onFoot',
    canWrite,
    readOnly: canWrite ? null : { stamp: 'Read-only · disconnected', says: 'offline' },
  } as unknown as Play
}

async function renderSide(
  { gameId = GAME, mediator = false }: { gameId?: string | null; mediator?: boolean } = {},
  status: SyncStatus = 'live'
) {
  const canWrite = status === 'live'
  const target: PlayTarget = {
    pilotId: 'bonesaw',
    gameId,
    gameName: gameId === null ? null : 'Rust Belt Run',
    mediator,
  }
  const tree = () => (
    <SyncContext.Provider
      value={{
        status,
        canWrite,
        outdated: false,
      }}
    >
      <SideColumn target={target} play={playFor(target, canWrite)} />
    </SyncContext.Provider>
  )
  let view: ReturnType<typeof render> | null = null
  await act(async () => {
    view = render(tree())
  })
  /** Render again, as a fresh subscription answer would. */
  return async () => {
    await act(async () => {
      view?.rerender(tree())
    })
  }
}

const feed = () => within(screen.getByRole('list', { name: 'Feed' }))
const feedLines = () =>
  feed()
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '')

async function roll(rolls: number[], post?: boolean) {
  await act(async () => {
    recordPlayRoll({
      tableName: 'Core Mechanic',
      rolls,
      label: 'Core Mechanic',
      outcome: 'Success',
      ...(post === undefined ? {} : { post }),
    })
  })
}

beforeAll(async () => {
  await hydrateStores()
})

afterEach(() => {
  cleanup()
  clearPlayRolls()
  mutations.length = 0
  postRoll.mockClear()
  postResult = async () => ({ kind: 'posted', channelId: 'c-1', messageId: 'm-1' })
})

afterAll(() => convexMocks.restore())

describe('the Crew (play.md §7)', () => {
  test('one line per other seat: presence, mount, and the vital that needs looking at', async () => {
    answers()
    await renderSide()
    const crew = within(screen.getByRole('list', { name: 'Crew' }))
    const links = crew.getAllByRole('button', { name: /Open their sheet/ })
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual([
      'Mags, here, Boarded · Atlas, SP 22, fine. Open their sheet',
      'Rook, here, On foot, Injured. Open their sheet',
      'Wren, away, Boarded · Mule, SP 26, fine. Open their sheet',
    ])
    expect(crew.getByText('▲ HP')).toBeTruthy()
    // Presence is a chip on each crewmate's Mini (ruleset §1.3): two here, one away.
    expect(crew.getAllByText('Here')).toHaveLength(2)
    expect(crew.getByText('Away')).toBeTruthy()
    // Each line is a Mini, never a listing Compact.
    expect(document.querySelectorAll('[data-play-list] .su-entity-compact')).toHaveLength(0)
    expect(crew.getAllByRole('listitem').every((li) => li.querySelector('.su-entity-mini'))).toBe(
      true
    )
  })

  test('a crewmate’s board, damage and leaving show live', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(NOW)
    try {
      answers()
      const rerender = await renderSide()
      const label = (name: string) =>
        screen.getByRole('button', { name: new RegExp(`^${name},`) }).getAttribute('aria-label')
      expect(label('Rook')).toBe('Rook, here, On foot, Injured. Open their sheet')

      // Rook climbs into Mule, healed; Mags takes a hit. The crew read answers anew.
      const crew = crewAt(NOW)
      crew.pilots = crew.pilots.map((p) => {
        if (p.linkId === 'rook') {
          return {
            ...p,
            boarded: true,
            mechId: 'mule',
            currentHP: 10,
            status: { ...p.status, injured: false },
            attention: false,
          }
        }
        if (p.linkId === 'mags') {
          return { ...p, currentHP: 2, status: { ...p.status, injured: true }, attention: true }
        }
        return p
      })
      answers({ 'crew:vitals': crew })
      await rerender()
      expect(label('Rook')).toBe('Rook, here, Boarded · Mule, SP 26, fine. Open their sheet')
      expect(label('Mags')).toBe('Mags, here, Boarded · Atlas, Injured. Open their sheet')
      expect(screen.getByText('▲ HP')).toBeTruthy()

      // Rook closes the tab: Mags keeps beating (a fresh seat heartbeat),
      // Rook does not, and the presence clock turns Rook away.
      const later = NOW + PRESENCE_STALE_MS
      answers({
        'crew:vitals': {
          ...crew,
          pilots: crew.pilots.map((p) => (p.linkId === 'rook' ? p : { ...p, lastSeenAt: later })),
        },
      })
      await rerender()
      expect(label('Rook')).toMatch(/^Rook, here,/)
      await act(async () => {
        jest.advanceTimersByTime(
          Math.ceil(PRESENCE_STALE_MS / PRESENCE_HEARTBEAT_MS) * PRESENCE_HEARTBEAT_MS
        )
      })
      expect(label('Rook')).toBe('Rook, away, Boarded · Mule, SP 26, fine. Open their sheet')
      expect(label('Mags')).toMatch(/^Mags, here,/)
    } finally {
      jest.useRealTimers()
    }
  })

  test('tapping a crewmate opens their sheet read-only over Play', async () => {
    answers()
    await renderSide()
    const mags = screen.getByRole('button', { name: /^Mags, here/ })
    await act(async () => mags.click())
    expect(screen.getByRole('dialog', { name: 'Mags · read-only' })).toBeTruthy()
  })

  test('solo has no Crew', async () => {
    answers()
    await renderSide({ gameId: null })
    expect(screen.queryByRole('heading', { name: 'Crew' })).toBeNull()
  })
})

describe('the Feed (play.md §8)', () => {
  test('the proposal awaiting my answer first, then newest first', async () => {
    answers()
    await renderSide()
    await roll([14])
    expect(feedLines()).toEqual([
      expect.stringContaining('Mediator proposes Bonesaw HP → 5'),
      expect.stringContaining('You · Core Mechanic · 14 · Success'),
      'Mags · Core Mechanic · 20 · Nailed it',
    ])
  })

  test('Accept applies the proposal and lands on the Feed as a change', async () => {
    answers()
    await renderSide()
    await act(async () => {
      feed().getByRole('button', { name: 'Accept: Mediator proposes Bonesaw HP → 5' }).click()
    })
    await waitFor(() =>
      expect(mutations).toEqual([{ name: 'proposals:apply', args: { proposalId: 'p-1' } }])
    )
    await waitFor(() => expect(feed().getByText('You · Applied · Bonesaw HP → 5')).toBeTruthy())
  })

  test('solo shows only my own', async () => {
    answers()
    await renderSide({ gameId: null })
    await roll([9])
    expect(feedLines()).toEqual([expect.stringContaining('You · Core Mechanic · 9 · Success')])
  })
})

describe('Discord (play.md §9)', () => {
  test('a roll posts to the bound channel, and its line says Posted', async () => {
    answers()
    await renderSide()
    await roll([14])
    expect(postRoll).toHaveBeenCalledTimes(1)
    expect(postRoll.mock.calls[0]?.[0]).toEqual({
      gameId: GAME,
      pilotId: 'bonesaw',
      roll: { tableName: 'Core Mechanic', rolls: [14] },
      post: true,
    })
    await waitFor(() => expect(feed().getByText('Posted')).toBeTruthy())
  })

  test('a roll the Actions column makes (reportingRoll) reaches the Feed, the log and Discord', async () => {
    answers()
    await renderSide()
    await act(async () => {
      // As the Actions column's dice do: read, then recorded once with its band.
      reportingRoll(
        () => 14,
        'Core Mechanic',
        () => ({ label: '120mm Cannon' })
      )(20)
      await Promise.resolve()
    })
    expect(postRoll).toHaveBeenCalledTimes(1)
    expect(postRoll.mock.calls[0]?.[0]).toMatchObject({
      roll: { tableName: 'Core Mechanic', rolls: [14] },
    })
    expect(feedLines().some((line) => line.startsWith('You · 120mm Cannon · 14 · Success'))).toBe(
      true
    )
  })

  test('an applied change (a Vent) lands on the Feed and is never posted', async () => {
    answers()
    await renderSide()
    await act(async () => {
      recordPlayChange('Vent · Heat 6→0, Vulnerable')
    })
    expect(feedLines()).toContain('You · Vent · Heat 6→0, Vulnerable')
    expect(postRoll).not.toHaveBeenCalled()
  })

  test('a failed post is shown on the Feed, never silent, with Try again', async () => {
    answers()
    postResult = async () => ({
      kind: 'failed',
      channelId: 'c-1',
      message: 'The Discord bot could not be reached.',
    })
    await renderSide()
    await roll([14])
    await waitFor(() =>
      expect(feed().getByRole('alert').textContent).toBe(
        'Not posted to Discord: The Discord bot could not be reached.'
      )
    )
    postResult = async () => ({ kind: 'posted', channelId: 'c-1', messageId: 'm-2' })
    await act(async () => {
      feed().getByRole('button', { name: 'Try again Core Mechanic to Discord' }).click()
    })
    expect(postRoll).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(feed().getByText('Posted')).toBeTruthy())
  })

  test('a post that throws is shown too', async () => {
    answers()
    postResult = async () => {
      throw new Error('boom')
    }
    await renderSide()
    await roll([14])
    await waitFor(() =>
      expect(feed().getByRole('alert').textContent).toBe(
        'Not posted to Discord: The roll did not reach Discord.'
      )
    )
  })

  test('the toggle off keeps a roll private; its line can still post it', async () => {
    answers()
    await renderSide()
    const toggle = screen.getByRole('checkbox', { name: 'Post rolls to #salvage-run' })
    expect((toggle as HTMLInputElement).checked).toBe(true)
    await act(async () => toggle.click())
    await roll([3])
    expect(postRoll).not.toHaveBeenCalled()
    await act(async () => {
      feed().getByRole('button', { name: 'Post Core Mechanic to Discord' }).click()
    })
    expect(postRoll).toHaveBeenCalledTimes(1)
  })

  test('a roll’s own choice beats the toggle', async () => {
    answers()
    await renderSide()
    await roll([3], false)
    expect(postRoll).not.toHaveBeenCalled()
  })

  test('the Mediator’s rolls default to private', async () => {
    answers()
    await renderSide({ mediator: true })
    const toggle = screen.getByRole('checkbox', { name: 'Post rolls to #salvage-run' })
    expect((toggle as HTMLInputElement).checked).toBe(false)
  })

  test('nothing bound: the toggle is off and says rolls stay in Play; nothing is sent', async () => {
    answers({ 'channelBindings:current': null })
    await renderSide()
    const toggle = screen.getByRole('checkbox', { name: 'Post rolls to the Game’s channel' })
    expect((toggle as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText(/No channel is bound yet/)).toBeTruthy()
    await roll([3])
    expect(postRoll).not.toHaveBeenCalled()
  })
})

describe('the Tables (play.md §8)', () => {
  test('a pinned table opens and its roll lands on the Feed and in Discord', async () => {
    answers()
    await renderSide()
    // A list of roll table Minis, one a line; the open one is the pressed toggle.
    const pins = within(screen.getByRole('list', { name: 'Pinned tables' }))
    expect(pins.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Core Mechanic',
      'Critical Damage',
      'Reactor Overload',
      'Critical Injury',
    ])
    const damage = pins.getByRole('button', { name: 'Critical Damage' })
    expect(damage.getAttribute('aria-pressed')).toBe('false')
    await act(async () => damage.click())
    expect(damage.getAttribute('aria-pressed')).toBe('true')
    const rollButton = await screen.findByRole('button', {
      name: /Roll the die on Critical Damage/,
    })
    await act(async () => rollButton.click())
    await waitFor(() => expect(feed().getByText(/^You · Critical Damage · \d+ · /)).toBeTruthy())
    expect(postRoll).toHaveBeenCalledTimes(1)
  })

  test('Find lists every other table by name', async () => {
    answers()
    await renderSide()
    const find = screen.getByRole('searchbox', { name: 'Roll a table' })
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(find, 'rumour')
      find.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const found = within(screen.getByRole('list', { name: 'Tables found' }))
    expect(found.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toContain(
      'Rumour'
    )
  })
})

describe('read-only (play.md §7)', () => {
  test('offline: Accept is withdrawn and a roll says it was not posted', async () => {
    answers()
    await renderSide({}, 'offline')
    expect(
      (
        feed().getByRole('button', {
          name: 'Accept: Mediator proposes Bonesaw HP → 5',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    await roll([14])
    expect(postRoll).not.toHaveBeenCalled()
    expect(feed().getByRole('alert').textContent).toBe(
      'Not posted to Discord: Not posted: Play is read-only for now.'
    )
  })
})

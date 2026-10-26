/**
 * An encounter running on the Mediator's Opposition (ADR-059 §5), the surface
 * behind the `encounterSheet` flag: its groups sit together with one Reaction
 * and one Morale roll each, Morale due shows when the book calls for a check
 * (Core Book p.268) and is never rolled for the Mediator, each held-back wave
 * has Bring in, and running one asks for waves.
 *
 * A unit test builds for production, where every flag is off, so `flags` is
 * replaced here with the real module and that flag on (`EncounterSheet.test`
 * says why the capture comes first and the restore after).
 */

import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { QueryAnswers } from '../../components/__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import { MEDIATOR_MEMBERS, MEDIATOR_SEATS, mediatorCrewAt, TABLE_HERE } from './mediatorFixture'

type Sent = { name: string; args: Record<string, unknown> }
const sent: Sent[] = []

function useMutation(ref: unknown) {
  const name = getFunctionName(ref as FunctionReference<'mutation'>)
  const mutate = async (args: Record<string, unknown>) => {
    sent.push({ name, args })
    if (name === 'mediator:runEncounter' || name === 'mediator:bringInWave') return { added: 1 }
    return null
  }
  return Object.assign(mutate, { withOptimisticUpdate: () => mutate })
}

const convexMocks = await installConvexMocks({
  convexReact: { useMutation },
  also: { '../../play/useGamePresence': () => ({ useGamePresence: () => TABLE_HERE }) },
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
})

// Capture before mocking: a module namespace is a live view.
const realFlags = { ...(await import('../../lib/flags')) }
mock.module('../../lib/flags', () => ({ ...realFlags, flagOn: () => true }))

afterAll(async () => {
  mock.module('../../lib/flags', () => realFlags)
  convexMocks.restore()
  const { flagOn } = await import('../../lib/flags')
  if (flagOn('encounterSheet')) throw new Error('flags were not restored')
})

const { PlayMediatorCockpit } = await import('../PlayMediatorCockpit')
const { SyncContext } = await import('../../replica/syncContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { clearPlayRolls } = await import('../playRolls.model')
const { useEncounters } = await import('../../replica/collections')
const { withSignedInBackend } = await import('../../replica/__tests__/signedInBackend')

withSignedInBackend()

beforeAll(async () => {
  await hydrateStores()
})

afterEach(() => {
  cleanup()
  clearPlayRolls()
  sent.length = 0
})

const GAME = 'g-rust'
const STAMP = '2026-10-26T00:00:00.000Z'
const BAND = { id: 'band', name: 'Raider Band' }

const raider = (id: string, name: string, currentHp: number, extra = {}) => ({
  _id: id,
  body: {
    name,
    refSchema: 'npcs',
    refSlug: 'raider',
    currentHp,
    maxHp: 3,
    statKind: 'hp',
    group: BAND,
    ...extra,
  },
})

/** Two of the Band down, one standing; a Mule at half its SP; a Raider alone. */
const TRAY = [
  raider('n-1', 'Raider', 0),
  raider('n-2', 'Raider 2', 0),
  raider('n-3', 'Raider 3', 3),
  {
    _id: 'n-mule',
    body: {
      name: 'Mule',
      refSchema: 'chassis',
      refSlug: 'mule',
      currentHp: 6,
      maxHp: 12,
      statKind: 'sp',
    },
  },
  {
    _id: 'n-loner',
    body: { name: 'Loner', refSchema: 'npcs', refSlug: 'raider', currentHp: 3, maxHp: 3 },
  },
]

const RUNNING = {
  encounterId: 'enc-1',
  name: 'Ambush',
  tables: [],
  notes: '',
  groups: [
    { id: 'band', name: 'Raider Band', wave: 1 },
    { id: 'snipers', name: 'Gantry snipers', wave: 2 },
  ],
  held: [
    {
      id: 'o4',
      refSchema: 'npcs',
      refSlug: 'raider',
      refName: 'Raider',
      name: 'Sniper',
      maxHp: 3,
      statKind: 'hp',
      groupId: 'snipers',
    },
  ],
  startedAt: STAMP,
}

function answers(over: QueryAnswers = {}): QueryAnswers {
  return {
    'games:members': MEDIATOR_MEMBERS,
    'crew:vitals': mediatorCrewAt(),
    'seats:forGame': MEDIATOR_SEATS,
    'entities:listForGame': {
      pilots: [],
      mechs: [],
      npcs: [],
      softLinks: [],
      crawlers: [],
      primaryCrawlerId: null,
    },
    'scenes:current': { conditions: [], hours: 0 },
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator:npcs': TRAY,
    'mediator:patterns': [],
    'ledger:get': { factions: [], jobs: [], incomeCollected: false },
    'mediator:running': RUNNING,
    'salvageAreas:here': null,
    'ops:sent': [],
    'changeLog:alerts': [],
    'changeLog:rolls': [],
    'channelBindings:current': null,
    'safety:stopSign': null,
    'account:me': { _id: 'u-gm', displayName: 'GM', avatarUrl: null, email: null },
    ...over,
  }
}

async function renderCockpit(over: QueryAnswers = {}) {
  setQueryAnswers(answers(over))
  await act(async () => {
    render(
      <SyncContext.Provider value={{ status: 'live', canWrite: true, outdated: false }}>
        <PlayMediatorCockpit gameId={GAME} gameName="The Rust Belt Run" />
      </SyncContext.Provider>
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

const named = (name: string | RegExp) => screen.getByRole('button', { name })

describe('groups on the tray', () => {
  test('a group sits together, says how many are down, and its Morale is due', async () => {
    await renderCockpit()
    const group = screen.getByRole('heading', { name: 'Raider Band' }).closest('li')
    if (!(group instanceof HTMLElement)) throw new Error('no group')
    const inside = within(group)
    expect(inside.getByText('2 of 3 down')).toBeTruthy()
    expect(inside.getByText('Morale due')).toBeTruthy()
    const members = inside.getByRole('list', { name: 'Raider Band: its members' })
    expect(within(members).getAllByRole('region')).toHaveLength(3)
    // Nothing was rolled for the Mediator.
    expect(sent).toEqual([])
  })

  test('one Reaction roll for the whole group is sent for its members', async () => {
    await renderCockpit()
    await click(named('Roll Reaction for Raider Band'))
    await waitFor(() => expect(sent.map((s) => s.name)).toEqual(['mediator:recordGroupRoll']))
    expect(sent[0]?.args).toMatchObject({
      gameId: GAME,
      groupId: 'band',
      roll: { table: 'reaction' },
    })
  })

  test('a group roll reads on the group as its own table', async () => {
    const rolled = {
      table: 'reaction',
      roll: 4,
      label: 'Hostile',
      value: 'They threaten.',
      rolledAt: STAMP,
    }
    await renderCockpit({
      'mediator:npcs': TRAY.map((row) =>
        row._id === 'n-3' ? { ...row, body: { ...row.body, lastMediatorRoll: rolled } } : row
      ),
    })
    expect(screen.getAllByText('Reaction 4 · Hostile').length).toBeGreaterThan(0)
  })

  test('a Mech at half its SP shows Morale due with Roll; Roll checks it', async () => {
    await renderCockpit()
    const mule = within(screen.getByRole('region', { name: 'Mech: Mule' }))
    expect(mule.getByText('Morale due')).toBeTruthy()
    const loner = within(screen.getByRole('region', { name: 'NPC: Loner' }))
    expect(loner.queryByText('Morale due')).toBeNull()
    await click(mule.getByRole('button', { name: 'Roll Morale for Mule' }))
    await waitFor(() => expect(sent.map((s) => s.name)).toEqual(['mediator:updateNpc']))
    expect(sent[0]?.args).toMatchObject({
      npcId: 'n-mule',
      patch: { lastMediatorRoll: { table: 'morale' } },
    })
  })
})

describe('waves', () => {
  test('each held-back wave names its groups and Bring in brings it', async () => {
    await renderCockpit()
    expect(screen.getByText('Gantry snipers · held')).toBeTruthy()
    await click(named('Bring in wave 2'))
    expect(sent).toEqual([{ name: 'mediator:bringInWave', args: { gameId: GAME, wave: 2 } }])
  })

  test('running an encounter asks for waves', async () => {
    useEncounters.setState({
      encounters: [
        {
          id: 'enc-1',
          schemaVersion: 1,
          name: 'Ambush',
          opposition: [],
          tables: [],
          notes: '',
          createdAt: STAMP,
          updatedAt: STAMP,
        },
      ],
    })
    await renderCockpit({ 'mediator:running': null })
    await click(named('Run an encounter'))
    const dialog = within(screen.getByRole('alertdialog', { name: 'Run an encounter' }))
    await click(dialog.getByRole('button', { name: 'Run Ambush' }))
    expect(sent).toContainEqual({
      name: 'mediator:runEncounter',
      args: { gameId: GAME, encounterId: 'enc-1', clear: false, waves: true },
    })
    act(() => useEncounters.setState({ encounters: [] }))
  })
})

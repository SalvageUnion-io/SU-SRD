import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { createElement } from 'react'
import { installConvexMocks } from '../../components/__tests__/convexMock'
import { mechFixture, pilotFixture, softLinkFixture } from '../../components/__tests__/fixtures'
import type { SentAct } from '../../replica/__tests__/fakeRooms'
import {
  acts,
  answerActs,
  answerOps,
  batches,
  closeRooms,
  openRooms,
  serve,
} from '../../replica/__tests__/fakeRooms'
import type { SyncStatus } from '../../replica/sync'
import type { Play } from '../situation.model'

/**
 * The Situation (play.md §3) through the whole Cockpit: the seat and the
 * Downtime it reads (`useSeatAt`, `usePlayDowntime`), the Situation they
 * make (`usePlaySituation`), the switch that changes it, the one `Play`
 * object every column is handed.
 *
 * The rooms are fakes (`fakeRooms.ts`) holding a solo seat and its Downtime
 * (the account room's) and a Game's seats and Downtime, served again
 * whenever an act or a step's op changes them, as a live room would. The
 * Games reads stay a Convex stand-in. The columns are probes that keep the
 * `play` they were handed.
 */

type SoloDowntime = {
  runId: string
  stepIndex: number
  startedAt: number
  upkeepSpent: boolean
  doneSteps: number[]
}
type Mount = { kind: 'foot' } | { kind: 'boarded'; mechId: string }
type SeatRow = {
  pilotId: string
  mount: Mount
  range: string
  activeEffects: string[]
  resolving: null
  ejected: boolean
  updatedAt: number | null
}

const GAME_ID = 'g-play'

const server = {
  solo: null as (SeatRow & { downtime: SoloDowntime | null }) | null,
  gameSeats: [] as SeatRow[],
  gameDowntime: null as number | null,
}

function seat(pilotId: string, mount: Mount = { kind: 'foot' }): SeatRow {
  return {
    pilotId,
    mount,
    range: 'Close',
    activeEffects: [],
    resolving: null,
    ejected: false,
    updatedAt: null,
  }
}

/** Serve both rooms' records as they now stand. */
function changed(): void {
  serve(null, { seats: server.solo === null ? [] : [server.solo] })
  serve(GAME_ID, {
    seats: server.gameSeats,
    scene: { conditions: [], hours: 0 },
    safety: null,
    crew: { pilots: [], mechs: [] },
    downtime: {
      running: server.gameDowntime !== null,
      runId: null,
      stepIndex: server.gameDowntime,
      startedAt: null,
      completedBy: [],
      upkeepSpent: false,
      doneSteps: {},
    },
  })
}

/** The Games reads the Cockpit still makes. */
function answer(name: string): unknown {
  switch (name) {
    case 'games:members':
      return []
    // The Play bar's channel button: nothing bound.
    case 'channelBindings:current':
      return null
    case 'account:me':
      return { _id: 'u-me', displayName: 'Me', avatarUrl: null, email: null }
    case 'entities:listForGame':
      return {
        pilots: [{ _id: 'r-rook', appId: 'pg-rook', ownerId: 'u-me', body: { name: 'Rook' } }],
        mechs: [
          { _id: 'r-atlas', appId: 'pg-atlas', ownerId: 'u-me', body: { name: 'Atlas' } },
          { _id: 'r-mule', appId: 'pg-mule', ownerId: null, body: { name: 'Mule' } },
        ],
        // Rook rides crawler c-1, which carries the spare.
        softLinks: [
          {
            type: 'pilot-to-crawler',
            from: { type: 'pilot', id: 'pg-rook' },
            to: { type: 'crawler', id: 'c-1' },
          },
          {
            type: 'mech-to-crawler',
            from: { type: 'mech', id: 'pg-mule' },
            to: { type: 'crawler', id: 'c-1' },
          },
        ],
      }
    default:
      throw new Error(`unanswered query ${name}`)
  }
}

function useFakeQuery(ref: unknown, args?: unknown): unknown {
  if (args === 'skip') return undefined
  return answer(getFunctionName(ref as FunctionReference<'query'>))
}

/** The rooms' side of each act this test makes. */
function apply({ gameId, name, args }: SentAct): void {
  const solo = gameId === null
  const remount = (mount: Mount) => {
    if (solo && server.solo !== null) server.solo = { ...server.solo, mount }
    if (!solo) {
      server.gameSeats = server.gameSeats.map((s) =>
        s.pilotId === args.pilotId ? { ...s, mount } : s
      )
    }
  }
  switch (name) {
    case 'seats.board':
      remount({ kind: 'boarded', mechId: String(args.mechId) })
      break
    case 'seats.dismount':
      remount({ kind: 'foot' })
      break
    case 'downtime.begin':
      if (!solo) server.gameDowntime = 0
      else if (server.solo !== null) {
        server.solo = {
          ...server.solo,
          downtime: {
            runId: 'run1',
            stepIndex: 0,
            startedAt: 1,
            upkeepSpent: false,
            doneSteps: [],
          },
        }
      }
      break
    case 'downtime.end':
      if (!solo) server.gameDowntime = null
      else if (server.solo !== null) server.solo = { ...server.solo, downtime: null }
      break
    default:
      return
  }
  changed()
}

/** A Downtime step's op (`downtimeStepOpId`): a solo seat keeps which it took. */
function takeStep(op: { id: string }): void {
  const stepIndex = Number(op.id.split(':').at(-1))
  const downtime = server.solo?.downtime
  if (server.solo === null || downtime == null || downtime.doneSteps.includes(stepIndex)) return
  server.solo = {
    ...server.solo,
    downtime: { ...downtime, doneSteps: [...downtime.doneSteps, stepIndex] },
  }
  changed()
}

/** Every `play` a column was handed, by column. */
const seen: Record<string, Play[]> = { units: [], actions: [], side: [] }

function probe(column: string) {
  return ({ play }: { play: Play }) => {
    seen[column]?.push(play)
    return createElement('output', {
      'data-column': column,
      'data-situation': play.situation,
      'data-boarded': play.boardedMechId ?? '',
    })
  }
}

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. Specifiers resolve from `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexReact: { useQuery: useFakeQuery },
  also: {
    '../../play/PlayUnitsColumn': () => ({ PlayUnitsColumn: probe('units') }),
    '../../play/PlayActionsColumn': () => ({ PlayActionsColumn: probe('actions') }),
    '../../play/PlaySideColumn': () => ({
      PlayCrewSection: probe('crew'),
      PlayerTablesAndFeed: probe('side'),
    }),
    // The side's reads are `PlaySide.connected.test.tsx`'s.
    '../../play/usePlaySide': () => ({ usePlaySide: () => ({}) }),
  },
})

const { PlayCockpit } = await import('../PlayCockpit')
const { SyncContext } = await import('../../replica/syncContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../replica/units')
const { resetSync } = await import('../../replica/sync')

const LINKS = ['ps-l1', 'pg-l1']

beforeAll(async () => {
  await hydrateStores()
  resetSync()
  const store = useUnits.getState()
  // Solo: Bonesaw on the shelf, assigned Buzzard, and Old Faithful in the hangar.
  await store.adopt('pilot', pilotFixture({ id: 'ps-bonesaw', name: 'Bonesaw' }))
  await store.adopt('mech', mechFixture({ id: 'ps-faithful', name: 'Old Faithful' }))
  await store.adopt('mech', mechFixture({ id: 'ps-buzzard', name: 'Buzzard' }))
  await store.adopt(
    'softLink',
    softLinkFixture('mech-to-pilot', 'ps-buzzard', 'ps-bonesaw', 'ps-l1')
  )
  // A Game: Rook, assigned Atlas; the Game also holds an unassigned spare.
  await store.adopt('pilot', pilotFixture({ id: 'pg-rook', name: 'Rook', gameId: GAME_ID }))
  await store.adopt('mech', mechFixture({ id: 'pg-atlas', name: 'Atlas', gameId: GAME_ID }))
  await store.adopt('softLink', softLinkFixture('mech-to-pilot', 'pg-atlas', 'pg-rook', 'pg-l1'))
})

afterAll(async () => {
  const store = useUnits.getState()
  for (const id of LINKS) await store.forget('softLink', id)
  for (const id of ['ps-faithful', 'ps-buzzard', 'pg-atlas']) await store.forget('mech', id)
  for (const id of ['ps-bonesaw', 'pg-rook']) await store.forget('pilot', id)
  convexMocks.restore()
})

beforeEach(() => {
  server.solo = { ...seat('ps-bonesaw'), downtime: null }
  server.gameSeats = [seat('pg-rook')]
  server.gameDowntime = null
  for (const column of Object.keys(seen)) seen[column] = []
  openRooms(null, GAME_ID)
  answerActs(apply)
  answerOps((batch) => batch.ops.forEach(takeStep))
  changed()
})

afterEach(() => {
  cleanup()
  closeRooms()
})

function connection(status: SyncStatus) {
  return {
    status,
    canWrite: status === 'live',
    outdated: false,
  }
}

async function renderPlay(
  target: { pilotId: string; gameId: string | null; mediator?: boolean },
  status: SyncStatus = 'live'
) {
  await act(async () => {
    render(
      <SyncContext.Provider value={connection(status)}>
        <PlayCockpit
          target={{
            gameName: target.gameId === null ? null : 'The Rust Belt Run',
            mediator: false,
            ...target,
          }}
        />
      </SyncContext.Provider>
    )
  })
}

const situationGroup = () => within(screen.getByRole('group', { name: 'Situation' }))
const pressed = () =>
  situationGroup()
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent)
const columnSituation = (column: string) =>
  document.querySelector(`[data-column="${column}"]`)?.getAttribute('data-situation')
const writes = (name: string) =>
  acts.filter((sent) => sent.name === name).map(({ name, args }) => ({ name, args }))

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element)
  })
}

describe('solo: the solo seat and its own Downtime', () => {
  test('reads the solo seat: on foot, with Board a menu of the shelf’s mechs', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    expect(pressed()).toEqual(['On foot'])
    expect(columnSituation('units')).toBe('onFoot')

    await click(situationGroup().getByRole('button', { name: /^Board, choose a Mech/ }))
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem')
    // The assigned mech first.
    expect(items.map((i) => i.textContent)).toEqual(['Buzzard', 'Old Faithful'])
  })

  test('boarding writes the solo seat (the account room), and every column follows', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    await click(situationGroup().getByRole('button', { name: /^Board/ }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Buzzard' }))

    expect(writes('seats.board')).toEqual([
      { name: 'seats.board', args: { pilotId: 'ps-bonesaw', mechId: 'ps-buzzard' } },
    ])
    expect(acts[0]?.gameId).toBeNull()
    expect(pressed()).toEqual(['Boarded · Buzzard'])
    for (const column of ['units', 'actions', 'side'])
      expect(columnSituation(column)).toBe('boarded')
    expect(document.querySelector('[data-column="units"]')?.getAttribute('data-boarded')).toBe(
      'ps-buzzard'
    )

    await click(situationGroup().getByRole('button', { name: 'On foot' }))
    expect(writes('seats.dismount')).toEqual([
      { name: 'seats.dismount', args: { pilotId: 'ps-bonesaw' } },
    ])
    expect(pressed()).toEqual(['On foot'])
  })

  test('the player starts Downtime; leaving it ends it, behind a confirm', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    const downtime = situationGroup().getByRole('button', { name: 'Downtime' })
    expect(downtime.hasAttribute('disabled')).toBe(false)
    await click(downtime)
    expect(writes('downtime.begin')).toEqual([
      { name: 'downtime.begin', args: { pilotId: 'ps-bonesaw' } },
    ])
    // Downtime wins over the mount.
    expect(pressed()).toEqual(['Downtime'])
    expect(columnSituation('actions')).toBe('downtime')

    await click(situationGroup().getByRole('button', { name: 'On foot' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('You are on step 1 of')
    await click(within(dialog).getByRole('button', { name: 'End Downtime' }))
    expect(writes('downtime.end')).toHaveLength(1)
    expect(pressed()).toEqual(['On foot'])
  })
})

describe('in a Game: the Game’s seat, and Downtime is the Mediator’s', () => {
  test('a player’s Downtime is locked: set by the Mediator', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID })
    const downtime = situationGroup().getByRole('button', { name: /Downtime, set by the Mediator/ })
    expect(downtime.hasAttribute('disabled')).toBe(true)
    expect(downtime.getAttribute('title')).toBe('Set by the Mediator')
  })

  test('the Mediator starts it and the player follows; the player’s switch only shows it', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID })
    await act(async () => {
      server.gameDowntime = 2
      changed()
    })
    expect(pressed()).toEqual(['Downtime'])
    expect(columnSituation('units')).toBe('downtime')

    // The player may still change their mount, which waits out Downtime: no
    // confirm, and nothing ends it.
    await click(situationGroup().getByRole('button', { name: /^Board/ }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Atlas' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(writes('downtime.end')).toHaveLength(0)
    expect(acts.find((sent) => sent.name === 'seats.board')).toEqual({
      gameId: GAME_ID,
      name: 'seats.board',
      args: { pilotId: 'pg-rook', mechId: 'pg-atlas' },
    })
    expect(pressed()).toEqual(['Downtime'])
  })

  test('Board lists the Game’s mechs; a spare is assigned to you first, behind a confirm', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID })
    await click(situationGroup().getByRole('button', { name: /^Board/ }))
    const menu = within(screen.getByRole('menu'))
    expect(menu.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Atlas',
      'Assign and board Mule',
    ])
    await click(menu.getByRole('menuitem', { name: 'Assign and board Mule' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('Mule is an unassigned spare')
  })

  test('the Mediator playing a pilot starts the Game’s Downtime from the switch', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID, mediator: true })
    await click(situationGroup().getByRole('button', { name: 'Downtime' }))
    expect(acts).toEqual([{ gameId: GAME_ID, name: 'downtime.begin', args: {} }])
    expect(pressed()).toEqual(['Downtime'])
  })
})

describe('one Play for the whole Cockpit', () => {
  test('every column is handed the same play object', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    const last = (column: string) => seen[column]?.at(-1)
    expect(last('units')).toBeDefined()
    expect(last('actions')).toBe(last('units'))
    expect(last('side')).toBe(last('units'))
    expect(last('units')?.target.pilotId).toBe('ps-bonesaw')
  })

  test('offline, every Situation option is off', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null }, 'offline')
    for (const option of situationGroup().getAllByRole('button')) {
      expect(option.hasAttribute('disabled')).toBe(true)
    }
  })
})

describe('usePlayDowntime: one handle over the Game’s and the solo Downtime', () => {
  const play = () => seen.units?.at(-1)

  test('solo: unlocked, with setStep, advance and upkeep bound to the solo writes', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    expect(play()?.downtime.locked).toBe(false)
    expect(play()?.downtime.markDone).toBeNull()
    await act(async () => {
      play()?.downtime.setStep?.(3)
      play()?.downtime.advance()
      await play()?.downtime.spendUpkeep()
    })
    expect(writes('downtime.setStep')[0]?.args).toEqual({ pilotId: 'ps-bonesaw', stepIndex: 3 })
    expect(writes('downtime.advance')).toHaveLength(1)
    expect(writes('downtime.spendUpkeep')).toHaveLength(1)
  })

  test('solo: a step is one op with a stable id, taken once', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    await act(async () => {
      play()?.downtime.begin()
    })
    expect(play()?.downtime.doneSteps).toEqual([])
    let first: boolean | undefined
    let second: boolean | undefined
    await act(async () => {
      first = await play()?.downtime.markStepDone?.(4, {})
    })
    await act(async () => {
      second = await play()?.downtime.markStepDone?.(4, {})
    })
    expect([first, second]).toEqual([true, false])
    expect(play()?.downtime.doneSteps).toEqual([4])
    expect(batches[0]).toMatchObject({
      gameId: null,
      ops: [{ id: 'downtime:run1:ps-bonesaw:4', unitId: 'ps-bonesaw', patch: {} }],
    })
  })

  test('in a Game: locked for a player; no setStep, and markDone on the Game', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID })
    expect(play()?.downtime.locked).toBe(true)
    expect(play()?.canChangeDowntime).toBe(false)
    expect(play()?.downtime.setStep).toBeNull()
    expect(play()?.downtime.doneSteps).toEqual([])
    await act(async () => {
      play()?.downtime.markDone?.(true)
    })
    expect(acts).toEqual([{ gameId: GAME_ID, name: 'downtime.markStepDone', args: { done: true } }])
  })

  test('in a Game: a step is an op on this pilot, with what it applies', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID })
    await act(async () => {
      await play()?.downtime.markStepDone?.(2, { currentTP: 3 })
    })
    expect(batches[0]).toMatchObject({
      gameId: GAME_ID,
      ops: [{ id: 'downtime:0:pg-rook:2', unitId: 'pg-rook', patch: { currentTP: 3 } }],
    })
  })

  test('the Mediator’s handle is unlocked', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID, mediator: true })
    expect(play()?.downtime.locked).toBe(false)
    expect(play()?.canChangeDowntime).toBe(true)
  })
})

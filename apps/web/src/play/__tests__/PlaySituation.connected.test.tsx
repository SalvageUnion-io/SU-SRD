import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { PRESENCE_HEARTBEAT_MS } from 'game-domain/schemas/seat'
import { createElement, useSyncExternalStore } from 'react'
import { installConvexMocks } from '../../components/__tests__/convexMock'
import { mechFixture, pilotFixture, softLinkFixture } from '../../components/__tests__/fixtures'
import type { ConnectionMode } from '../../lib/connection/connectionMode'
import type { Play } from '../situation.model'

/**
 * The Situation (play.md §3) through the whole Cockpit: the seat and the
 * Downtime it reads (`useSeatAt`, `usePlayDowntime`), the Situation they
 * make (`usePlaySituation`), the switch that changes it, the one `Play`
 * object every column is handed, and the presence heartbeat.
 *
 * One stand-in for Convex: a solo seat and its Downtime, a Game's seats and
 * Downtime, each subscription re-rendering when a mutation changes them, as a
 * live one would. Every write is recorded, with the optimistic update it was
 * sent with. The columns are probes that keep the `play` they were handed.
 */

type SoloDowntime = {
  stepIndex: number
  startedAt: number
  upkeepSpent: boolean
  doneSteps?: number[]
}
type Mount = { kind: 'foot' } | { kind: 'boarded'; mechId: string }
type SeatRow = {
  pilotId: string
  mount: Mount
  range: string
  activeEffects: string[]
  resolving: null
  lastSeenAt: number | null
  updatedAt: number | null
}

const GAME_ID = 'g-play'

const server = {
  solo: null as (SeatRow & { ejected: boolean; downtime: SoloDowntime | null }) | null,
  gameSeats: [] as SeatRow[],
  gameDowntime: null as number | null,
  writes: [] as { name: string; args: Record<string, unknown> }[],
  optimistic: new Map<string, (store: unknown, args: unknown) => void>(),
  version: 0,
  listeners: new Set<() => void>(),
}

function seat(pilotId: string, mount: Mount = { kind: 'foot' }): SeatRow {
  return {
    pilotId,
    mount,
    range: 'Close',
    activeEffects: [],
    resolving: null,
    lastSeenAt: null,
    updatedAt: null,
  }
}

function changed(): void {
  server.version += 1
  for (const listener of server.listeners) listener()
}

function subscribe(listener: () => void): () => void {
  server.listeners.add(listener)
  return () => server.listeners.delete(listener)
}

function answer(name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case 'seats:solo':
      return server.solo
    case 'seats:forGame':
      return server.gameSeats
    case 'downtime:state': {
      if (args.gameId !== null) {
        return {
          running: server.gameDowntime !== null,
          stepIndex: server.gameDowntime,
          startedAt: null,
          completedBy: [],
          upkeepSpent: false,
          claimed: [],
        }
      }
      const downtime = server.solo?.downtime ?? null
      return downtime === null
        ? {
            running: false,
            stepIndex: null,
            startedAt: null,
            completedBy: [],
            upkeepSpent: false,
            claimed: [],
          }
        : {
            running: true,
            stepIndex: downtime.stepIndex,
            startedAt: downtime.startedAt,
            completedBy: [],
            upkeepSpent: downtime.upkeepSpent,
            claimed: (downtime.doneSteps ?? []).map((stepIndex) => ({
              pilotId: args.pilotId,
              stepIndex,
            })),
          }
    }
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
  useSyncExternalStore(subscribe, () => server.version)
  if (args === 'skip') return undefined
  return answer(getFunctionName(ref as FunctionReference<'query'>), args as Record<string, unknown>)
}

/** The server's side of each write this test makes. */
function apply(name: string, args: Record<string, unknown>): unknown {
  const solo = args.gameId === null
  const remount = (mount: Mount) => {
    if (solo && server.solo !== null) server.solo = { ...server.solo, mount }
    if (!solo) {
      server.gameSeats = server.gameSeats.map((s) =>
        s.pilotId === args.pilotId ? { ...s, mount } : s
      )
    }
  }
  switch (name) {
    case 'seats:board':
      remount({ kind: 'boarded', mechId: String(args.mechId) })
      break
    case 'seats:dismount':
      remount({ kind: 'foot' })
      break
    case 'downtime:begin':
      if (!solo) server.gameDowntime = 0
      else if (server.solo !== null) {
        server.solo = {
          ...server.solo,
          downtime: { stepIndex: 0, startedAt: 1, upkeepSpent: false },
        }
      }
      break
    case 'downtime:end':
      if (!solo) server.gameDowntime = null
      else if (server.solo !== null) server.solo = { ...server.solo, downtime: null }
      break
    case 'downtime:claimStep': {
      const downtime = server.solo?.downtime
      if (server.solo === null || downtime == null) return false
      const done = downtime.doneSteps ?? []
      if (done.includes(Number(args.stepIndex))) return false
      server.solo = {
        ...server.solo,
        downtime: { ...downtime, doneSteps: [...done, Number(args.stepIndex)] },
      }
      changed()
      return true
    }
    default:
      return undefined
  }
  changed()
  return undefined
}

/**
 * One sender per mutation, as Convex's own `useMutation` hands back the same
 * function every render: a fresh one would restart every effect that lists
 * it (the presence beat) whenever anything re-renders.
 */
const senders = new Map<string, ReturnType<typeof makeSender>>()

function makeSender(name: string) {
  const send = async (args: Record<string, unknown>) => {
    server.writes.push({ name, args })
    return apply(name, args)
  }
  return Object.assign(send, {
    withOptimisticUpdate: (update: (store: unknown, args: unknown) => void) => {
      server.optimistic.set(name, update)
      return send
    },
  })
}

function useFakeMutation(ref: unknown) {
  const name = getFunctionName(ref as FunctionReference<'mutation'>)
  const known = senders.get(name)
  if (known) return known
  const sender = makeSender(name)
  senders.set(name, sender)
  return sender
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
  convexReact: { useQuery: useFakeQuery, useMutation: useFakeMutation },
  also: {
    '../../play/PlayUnitsColumn': () => ({ PlayUnitsColumn: probe('units') }),
    '../../play/PlayActionsColumn': () => ({ PlayActionsColumn: probe('actions') }),
    '../../play/PlaySideColumn': () => ({ PlaySideColumn: probe('side') }),
  },
})

const { PlayCockpit } = await import('../PlayCockpit')
const { ConnectionContext } = await import('../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useEntityStore } = await import('../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../stores/entityBackend')

const LINKS = ['ps-l1', 'pg-l1']

beforeAll(async () => {
  await hydrateStores()
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  const store = useEntityStore.getState()
  // Solo: Bonesaw on the shelf, assigned Buzzard, and Old Faithful in the hangar.
  await store.adopt('pilot', pilotFixture({ id: 'ps-bonesaw', name: 'Bonesaw' }))
  await store.adopt('mech', mechFixture({ id: 'ps-faithful', name: 'Old Faithful' }))
  await store.adopt('mech', mechFixture({ id: 'ps-buzzard', name: 'Buzzard' }))
  await store.adopt(
    'softLink',
    softLinkFixture('mech-to-pilot', 'ps-buzzard', 'ps-bonesaw', 'ps-l1')
  )
  // A Game: Rook, assigned Atlas; the Game also holds an unclaimed spare.
  await store.adopt('pilot', pilotFixture({ id: 'pg-rook', name: 'Rook', gameId: GAME_ID }))
  await store.adopt('mech', mechFixture({ id: 'pg-atlas', name: 'Atlas', gameId: GAME_ID }))
  await store.adopt('softLink', softLinkFixture('mech-to-pilot', 'pg-atlas', 'pg-rook', 'pg-l1'))
})

afterAll(async () => {
  const store = useEntityStore.getState()
  for (const id of LINKS) await store.forget('softLink', id)
  for (const id of ['ps-faithful', 'ps-buzzard', 'pg-atlas']) await store.forget('mech', id)
  for (const id of ['ps-bonesaw', 'pg-rook']) await store.forget('pilot', id)
  convexMocks.restore()
})

beforeEach(() => {
  server.solo = { ...seat('ps-bonesaw'), ejected: false, downtime: null }
  server.gameSeats = [seat('pg-rook')]
  server.gameDowntime = null
  server.writes = []
  server.optimistic = new Map()
  server.version = 0
  for (const column of Object.keys(seen)) seen[column] = []
})

function connection(mode: ConnectionMode) {
  return {
    mode,
    canWrite: mode === 'connected',
    showDisconnectedWarning: mode === 'disconnected',
    settling: mode === 'connecting',
  }
}

async function renderPlay(
  target: { pilotId: string; gameId: string | null; mediator?: boolean },
  mode: ConnectionMode = 'connected'
) {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={connection(mode)}>
        <PlayCockpit
          target={{
            gameName: target.gameId === null ? null : 'The Rust Belt Run',
            mediator: false,
            ...target,
          }}
        />
      </ConnectionContext.Provider>
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
const writes = (name: string) => server.writes.filter((w) => w.name === name)

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

  test('boarding writes the solo seat (gameId null), and every column follows', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    await click(situationGroup().getByRole('button', { name: /^Board/ }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Buzzard' }))

    expect(writes('seats:board')).toEqual([
      { name: 'seats:board', args: { gameId: null, pilotId: 'ps-bonesaw', mechId: 'ps-buzzard' } },
    ])
    expect(pressed()).toEqual(['Boarded · Buzzard'])
    for (const column of ['units', 'actions', 'side'])
      expect(columnSituation(column)).toBe('boarded')
    expect(document.querySelector('[data-column="units"]')?.getAttribute('data-boarded')).toBe(
      'ps-buzzard'
    )

    await click(situationGroup().getByRole('button', { name: 'On foot' }))
    expect(writes('seats:dismount')).toEqual([
      { name: 'seats:dismount', args: { gameId: null, pilotId: 'ps-bonesaw' } },
    ])
    expect(pressed()).toEqual(['On foot'])
  })

  test('the board write patches the cached solo seat at once (the optimistic update)', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    const update = server.optimistic.get('seats:board')
    expect(update).toBeDefined()
    let cached: Record<string, unknown> | null = { ...seat('ps-bonesaw'), resolving: null }
    const store = {
      getQuery: (ref: unknown, args: unknown) => {
        expect(getFunctionName(ref as FunctionReference<'query'>)).toBe('seats:solo')
        expect(args).toEqual({ pilotId: 'ps-bonesaw' })
        return cached
      },
      setQuery: (_ref: unknown, _args: unknown, value: Record<string, unknown>) => {
        cached = value
      },
    }
    update?.(store, { gameId: null, pilotId: 'ps-bonesaw', mechId: 'ps-buzzard' })
    expect(cached?.mount).toEqual({ kind: 'boarded', mechId: 'ps-buzzard' })
  })

  test('the player starts Downtime; leaving it ends it, behind a confirm', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    const downtime = situationGroup().getByRole('button', { name: 'Downtime' })
    expect(downtime.hasAttribute('disabled')).toBe(false)
    await click(downtime)
    expect(writes('downtime:begin')).toEqual([
      { name: 'downtime:begin', args: { gameId: null, pilotId: 'ps-bonesaw' } },
    ])
    // Downtime wins over the mount.
    expect(pressed()).toEqual(['Downtime'])
    expect(columnSituation('actions')).toBe('downtime')

    await click(situationGroup().getByRole('button', { name: 'On foot' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('You are on step 1 of')
    await click(within(dialog).getByRole('button', { name: 'End Downtime' }))
    expect(writes('downtime:end')).toHaveLength(1)
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
    expect(writes('downtime:end')).toHaveLength(0)
    expect(writes('seats:board')[0]?.args).toEqual({
      gameId: GAME_ID,
      pilotId: 'pg-rook',
      mechId: 'pg-atlas',
    })
    expect(pressed()).toEqual(['Downtime'])
  })

  test('Board lists the Game’s mechs; a spare is claimed first, behind a confirm', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID })
    await click(situationGroup().getByRole('button', { name: /^Board/ }))
    const menu = within(screen.getByRole('menu'))
    expect(menu.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Atlas',
      'Claim and board Mule',
    ])
    await click(menu.getByRole('menuitem', { name: 'Claim and board Mule' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('Mule is an unclaimed spare')
  })

  test('the Mediator playing a pilot starts the Game’s Downtime from the switch', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID, mediator: true })
    await click(situationGroup().getByRole('button', { name: 'Downtime' }))
    expect(writes('downtime:begin')).toEqual([
      { name: 'downtime:begin', args: { gameId: GAME_ID } },
    ])
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
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null }, 'disconnected')
    for (const option of situationGroup().getAllByRole('button')) {
      expect(option.hasAttribute('disabled')).toBe(true)
    }
  })
})

describe('presence', () => {
  test('connected, it beats for the seat at once and every heartbeat interval', async () => {
    jest.useFakeTimers()
    try {
      await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
      expect(writes('seats:heartbeat')).toEqual([
        { name: 'seats:heartbeat', args: { gameId: null, pilotId: 'ps-bonesaw' } },
      ])
      await act(async () => {
        jest.advanceTimersByTime(PRESENCE_HEARTBEAT_MS)
      })
      expect(writes('seats:heartbeat')).toHaveLength(2)
    } finally {
      jest.useRealTimers()
    }
  })

  test('offline, it sends nothing', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID }, 'disconnected')
    expect(writes('seats:heartbeat')).toHaveLength(0)
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
    expect(writes('downtime:setStep')[0]?.args).toEqual({
      gameId: null,
      pilotId: 'ps-bonesaw',
      stepIndex: 3,
    })
    expect(writes('downtime:advance')).toHaveLength(1)
    expect(writes('downtime:spendUpkeep')).toHaveLength(1)
  })

  test('solo: the done steps come from the seat, and a step is claimed once', async () => {
    await renderPlay({ pilotId: 'ps-bonesaw', gameId: null })
    await act(async () => {
      play()?.downtime.begin()
    })
    expect(play()?.downtime.doneSteps).toEqual([])
    let first: boolean | undefined
    let second: boolean | undefined
    await act(async () => {
      first = await play()?.downtime.markStepDone?.(4)
    })
    await act(async () => {
      second = await play()?.downtime.markStepDone?.(4)
    })
    expect([first, second]).toEqual([true, false])
    expect(play()?.downtime.doneSteps).toEqual([4])
    expect(writes('downtime:claimStep')[0]?.args).toEqual({
      gameId: null,
      pilotId: 'ps-bonesaw',
      stepIndex: 4,
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
    expect(writes('downtime:markStepDone')[0]?.args).toEqual({ gameId: GAME_ID, done: true })
  })

  test('in a Game: a step is claimed for this pilot on the Game (`claimStep`)', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID })
    await act(async () => {
      await play()?.downtime.markStepDone?.(2)
    })
    expect(writes('downtime:claimStep')[0]?.args).toEqual({
      gameId: GAME_ID,
      pilotId: 'pg-rook',
      stepIndex: 2,
    })
  })

  test('the Mediator’s handle is unlocked', async () => {
    await renderPlay({ pilotId: 'pg-rook', gameId: GAME_ID, mediator: true })
    expect(play()?.downtime.locked).toBe(false)
    expect(play()?.canChangeDowntime).toBe(true)
  })
})

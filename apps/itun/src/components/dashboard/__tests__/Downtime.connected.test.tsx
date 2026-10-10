import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { ReactNode } from 'react'
import { createContext, createElement, useContext, useSyncExternalStore } from 'react'
import { installConvexMocks } from '../../__tests__/convexMock'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../__tests__/fixtures'

/**
 * Downtime is the Game's, and every Dashboard follows it
 * (ADR-038 §5).
 *
 * Two clients, one Game: the Mediator (Mara, playing Dex) and a player (Ash,
 * playing Rook), each rendering their own Dashboard. They share one stand-in
 * for Convex: a `downtime` row and the seats, with every subscription
 * re-rendering when a mutation changes them, so what one client writes the
 * other sees as it would over a live subscription. The stand-in applies the
 * server's rules that matter here — begin, advance and end are the
 * Mediator's, and `markStepDone` marks only the caller.
 */

type Identity = { userId: string; name: string; mediator: boolean }

/** Which client a hook is rendering for. */
const Client = createContext<Identity | null>(null)

type Row = { stepIndex: number | null; completedBy: string[]; upkeepSpent: boolean }

const STEP_COUNT = 10

const server = {
  downtime: { stepIndex: null, completedBy: [], upkeepSpent: false } as Row,
  seats: [] as Array<Record<string, unknown>>,
  version: 0,
  listeners: new Set<() => void>(),
}

const MARA: Identity = { userId: 'u-mara', name: 'Mara', mediator: true }
const ASH: Identity = { userId: 'u-ash', name: 'Ash', mediator: false }
const MEMBERS = [MARA, ASH]

function changed(): void {
  server.version += 1
  for (const listener of server.listeners) listener()
}

function subscribe(listener: () => void): () => void {
  server.listeners.add(listener)
  return () => server.listeners.delete(listener)
}

/** What each query answers this client. */
function answer(name: string, me: Identity): unknown {
  const row = server.downtime
  switch (name) {
    case 'downtime:state':
      return {
        running: row.stepIndex !== null,
        stepIndex: row.stepIndex,
        completedBy: row.completedBy.map((userId) => ({
          userId,
          displayName: MEMBERS.find((m) => m.userId === userId)?.name ?? 'Crewmate',
        })),
        upkeepSpent: row.upkeepSpent,
      }
    case 'games:members':
      return MEMBERS.map((m) => ({
        userId: m.userId,
        displayName: m.name,
        mediator: m.mediator,
        organizer: false,
        joinedAt: 0,
      }))
    case 'account:me':
      return { _id: me.userId, displayName: me.name, avatarUrl: null, email: null }
    case 'games:get':
      return { _id: GAME_ID, name: 'Ash Flats', mediator: me.mediator }
    case 'seats:forGame':
      return server.seats
    case 'changeLog:rolls':
    case 'proposals:alerts':
    case 'proposals:pending':
      return []
    default:
      // The listing and crew status: not what this test is about.
      return undefined
  }
}

function useFakeQuery(ref: unknown, args?: unknown): unknown {
  const me = useContext(Client)
  useSyncExternalStore(subscribe, () => server.version)
  if (args === 'skip' || me === null) return undefined
  return answer(getFunctionName(ref as FunctionReference<'query'>), me)
}

/** The server's Downtime rules, as the caller. */
function mutate(name: string, me: Identity, args: Record<string, unknown>): unknown {
  const row = server.downtime
  const mediatorOnly = () => {
    if (!me.mediator) throw new Error('Only the Mediator can do that')
  }
  switch (name) {
    case 'downtime:begin':
      mediatorOnly()
      server.downtime = { stepIndex: 0, completedBy: [], upkeepSpent: false }
      break
    case 'downtime:advance':
      mediatorOnly()
      if (row.stepIndex === null) throw new Error('Downtime is not running')
      server.downtime = {
        ...row,
        stepIndex: Math.min(row.stepIndex + 1, STEP_COUNT - 1),
        completedBy: [],
      }
      break
    case 'downtime:end':
      mediatorOnly()
      server.downtime = { ...row, stepIndex: null, completedBy: [] }
      break
    case 'downtime:markStepDone': {
      const without = row.completedBy.filter((id) => id !== me.userId)
      server.downtime = { ...row, completedBy: args.done ? [...without, me.userId] : without }
      break
    }
    default:
      return undefined
  }
  changed()
  return undefined
}

function useFakeMutation(ref: unknown) {
  const me = useContext(Client)
  const name = getFunctionName(ref as FunctionReference<'mutation'>)
  const send = async (args: Record<string, unknown>) => {
    if (me === null) throw new Error('no client')
    return mutate(name, me, args)
  }
  return Object.assign(send, { withOptimisticUpdate: () => send })
}

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexReact: { useQuery: useFakeQuery, useMutation: useFakeMutation },
})

const { Dashboard } = await import('../Dashboard')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')

const GAME_ID = 'g-downtime'

const CONNECTED = {
  mode: 'connected' as const,
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

beforeAll(async () => {
  await hydrateStores()
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  const store = useEntityStore.getState()
  await store.adopt('pilot', pilotFixture({ id: 'dt-dex', name: 'Dex', gameId: GAME_ID }))
  await store.adopt('pilot', pilotFixture({ id: 'dt-rook', name: 'Rook', gameId: GAME_ID }))
  await store.adopt('mech', mechFixture({ id: 'dt-thresher', name: 'Thresher', gameId: GAME_ID }))
  await store.adopt(
    'crawler',
    crawlerFixture({ id: 'dt-hen', name: 'Mother Hen', gameId: GAME_ID })
  )
  await store.adopt('softLink', softLinkFixture('mech-to-pilot', 'dt-thresher', 'dt-rook', 'dt-l1'))
  await store.adopt('softLink', softLinkFixture('pilot-to-crawler', 'dt-rook', 'dt-hen', 'dt-l2'))
  await store.adopt('softLink', softLinkFixture('pilot-to-crawler', 'dt-dex', 'dt-hen', 'dt-l3'))
})

afterAll(async () => {
  cleanup()
  const store = useEntityStore.getState()
  for (const id of ['dt-l1', 'dt-l2', 'dt-l3']) await store.forget('softLink', id)
  await store.forget('crawler', 'dt-hen')
  await store.forget('mech', 'dt-thresher')
  await store.forget('pilot', 'dt-rook')
  await store.forget('pilot', 'dt-dex')
  convexMocks.restore()
})

beforeEach(() => {
  server.downtime = { stepIndex: null, completedBy: [], upkeepSpent: false }
  // Rook sits boarded in Thresher; Dex is on foot.
  server.seats = [
    {
      pilotId: 'dt-rook',
      mount: { kind: 'boarded', mechId: 'dt-thresher' },
      range: 'Close',
      activeEffects: [],
      resolving: null,
      updatedAt: null,
    },
  ]
  server.version = 0
})

function as(me: Identity, pilotId: string): ReactNode {
  return createElement(
    Client.Provider,
    { value: me },
    createElement(
      ConnectionContext.Provider,
      { value: CONNECTED },
      createElement(Dashboard, { pilotId, mediator: me.mediator })
    )
  )
}

/** Both clients' Dashboards, side by side in one document. */
function renderTable() {
  const mediator = render(as(MARA, 'dt-dex')).container
  const player = render(as(ASH, 'dt-rook')).container
  return { mediator, player }
}

const major = (client: HTMLElement) =>
  client.querySelector('[data-major]')?.getAttribute('data-major') ?? null

const stepCount = (client: HTMLElement) =>
  client.querySelector('.pc-dt-count')?.textContent?.replace(/\s+/g, ' ') ?? null

async function press(client: HTMLElement, name: string) {
  await act(async () => {
    fireEvent.click(within(client).getByRole('button', { name }))
  })
}

function buttonLabels(client: HTMLElement): string[] {
  return [...client.querySelectorAll('button')].map((b) => b.textContent ?? '')
}

describe('Downtime follows the Game on every client', () => {
  test('the Mediator starts, advances and ends it, and both clients follow', async () => {
    const { mediator, player } = renderTable()

    // Before: each client is wherever its seat says.
    expect(major(mediator)).toBe('pilot')
    expect(major(player)).toBe('mech')
    // Only the Mediator can start it.
    expect(buttonLabels(player)).not.toContain('Start Downtime ▶')

    await press(mediator, 'Start Downtime ▶')
    // Both move to the Crawler Major and the guide, at step 1.
    expect(major(mediator)).toBe('crawler')
    expect(major(player)).toBe('crawler')
    expect(stepCount(mediator)).toContain('Step 1 /')
    expect(stepCount(player)).toContain('Step 1 /')

    // The Crawler has the whole row (board D3): the pilot and mech ride the
    // rail as compact links, which open their full controls.
    expect(player.querySelectorAll('[data-major] > *')).toHaveLength(1)
    expect(within(player).getByText('Downtime · Step 1 of 10')).toBeTruthy()
    const pilotLink = within(player).getByRole('button', { name: /^Open Pilot: HP/ })
    await act(async () => {
      fireEvent.click(pilotLink)
    })
    expect(within(player).getByRole('dialog', { name: /^Pilot · / })).toBeTruthy()
    await act(async () => {
      fireEvent.keyDown(within(player).getByRole('dialog', { name: /^Pilot · / }), {
        key: 'Escape',
      })
    })

    // The player cannot move the table on; the Mediator can.
    expect(buttonLabels(player)).not.toContain('Next step ›')
    await press(mediator, 'Next step ›')
    expect(stepCount(mediator)).toContain('Step 2 /')
    expect(stepCount(player)).toContain('Step 2 /')

    await press(mediator, '■ End Downtime')
    // Each returns to whatever their seat says: Rook is still aboard Thresher.
    expect(major(mediator)).toBe('pilot')
    expect(major(player)).toBe('mech')
    expect(player.querySelector('.pc-dt')).toBeNull()
  })

  test("a player's I'm done shows on the other client, and clears when the step moves on", async () => {
    server.downtime = { stepIndex: 0, completedBy: [], upkeepSpent: false }
    const { mediator, player } = renderTable()

    const ready = (client: HTMLElement) => within(client).getByRole('list', { name: /^Done with/ })
    expect(ready(mediator).getAttribute('aria-label')).toBe('Done with this step: 0 of 2')

    await press(player, "I'm done")
    expect(within(ready(mediator)).getByText('✓ Ash')).toBeTruthy()
    expect(ready(mediator).getAttribute('aria-label')).toBe('Done with this step: 1 of 2')
    // The player's own button reads as pressed.
    expect(
      within(player).getByRole('button', { name: '✓ Done' }).getAttribute('aria-pressed')
    ).toBe('true')

    // Completion is per step: the Mediator's advance clears it everywhere.
    await press(mediator, 'Next step ›')
    expect(ready(player).getAttribute('aria-label')).toBe('Done with this step: 0 of 2')
    expect(within(player).getByRole('button', { name: "I'm done" })).toBeTruthy()
  })
})

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The Game page's member surfaces in their **connected** state (board M2,
 * issue 1278): the Downtime track every member sees and the Mediator runs, and
 * the player's answer queue.
 *
 * The Convex hooks are mocked through `installConvexMocks()`, which owns the
 * capture-and-restore that keeps a process-global `mock.module` from leaking
 * into every test file that runs after this one.
 */

import { getFunctionName } from 'convex/server'
import type { QueryAnswers } from '../../__tests__/convexMock'
/**
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

const mutations: { name: string; args: unknown }[] = []

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
const convexMocks = await installConvexMocks({
  convexReact: {
    useMutation: (ref: unknown) => async (args: unknown) => {
      mutations.push({ name: getFunctionName(ref as never), args })
    },
  },
})

const { DowntimeTrack } = await import('../DowntimeTrack')
const { ProposalInbox } = await import('../ProposalInbox')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

const wrap = (ui: React.ReactNode) => render(<ConnectionProvider>{ui}</ConnectionProvider>)

const state = (over: Record<string, unknown> = {}): QueryAnswers => ({
  'downtime:state': {
    running: false,
    stepIndex: null,
    completedBy: [],
    upkeepSpent: false,
    ...over,
  },
})

const CRAWLER = {
  id: 'c1',
  name: '#430 Tenacity',
  sp: 20,
  maxSP: 20,
  techLevel: 1,
  bays: 10,
  baysIntact: 10,
  scrapAtTl: 5,
}

beforeEach(() => {
  mutations.length = 0
})

describe('DowntimeTrack', () => {
  test('the guide’s ten steps, the first reading Next, and no phase controls for a player', () => {
    setQueryAnswers(state())
    wrap(<DowntimeTrack gameId={'g1' as never} mediator={false} crawler={CRAWLER} />)

    const steps = within(screen.getByRole('list', { name: 'Downtime steps' })).getAllByRole(
      'listitem'
    )
    // Workshop Manual p.227–228: ten steps, not the board's five boxes.
    expect(steps).toHaveLength(10)
    expect(steps[0]?.textContent).toContain('Next')
    expect(steps[0]?.textContent).toContain('Tally Salvage')
    expect(screen.queryByRole('button', { name: 'Begin Downtime' })).toBeNull()
  })

  test('the upkeep due is five scrap of the crawler’s tech level, and what it holds', () => {
    setQueryAnswers(state())
    wrap(<DowntimeTrack gameId={'g1' as never} mediator crawler={CRAWLER} />)
    expect(screen.getByText('Upkeep due: 5 TL1 scrap. The crawler has 5.')).toBeTruthy()
  })

  test('the Mediator begins it', async () => {
    setQueryAnswers(state())
    wrap(<DowntimeTrack gameId={'g1' as never} mediator crawler={CRAWLER} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Begin Downtime' }))
    })
    expect(mutations.map((m) => m.name)).toEqual(['downtime:begin'])
  })

  test('running: the current step reads Now, and who has finished it', () => {
    setQueryAnswers(
      state({
        running: true,
        stepIndex: 2,
        completedBy: [{ userId: 'u2', displayName: 'Beefcake' }],
      })
    )
    wrap(<DowntimeTrack gameId={'g1' as never} mediator={false} crawler={CRAWLER} />)

    const current = screen
      .getAllByRole('listitem')
      .find((li) => li.getAttribute('aria-current') === 'step')
    // stepIndex is zero-based on the wire and one-based on screen.
    expect(current?.textContent).toContain('Now')
    expect(current?.textContent).toContain('Restore your Mech & Pilot')
    expect(screen.getByText(/Finished: Beefcake/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /done with this step/ })).toBeTruthy()
  })

  test('only the Mediator pays upkeep, and only in the Upkeep & Upgrade step', () => {
    setQueryAnswers(state({ running: true, stepIndex: 1 }))
    const player = wrap(<DowntimeTrack gameId={'g1' as never} mediator={false} crawler={null} />)
    expect(screen.queryByRole('button', { name: 'Pay upkeep' })).toBeNull()
    player.unmount()

    const upkeep = wrap(<DowntimeTrack gameId={'g1' as never} mediator crawler={null} />)
    expect((screen.getByRole('button', { name: 'Pay upkeep' }) as HTMLButtonElement).disabled).toBe(
      false
    )
    upkeep.unmount()

    setQueryAnswers(state({ running: true, stepIndex: 0 }))
    wrap(<DowntimeTrack gameId={'g1' as never} mediator crawler={null} />)
    expect((screen.getByRole('button', { name: 'Pay upkeep' }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })

  test('ending before the last step asks first, and ends nothing until confirmed', async () => {
    setQueryAnswers(state({ running: true, stepIndex: 3 }))
    wrap(<DowntimeTrack gameId={'g1' as never} mediator crawler={null} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'End Downtime' }))
    })
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(mutations).toHaveLength(0)

    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'End Downtime' })
      )
    })
    expect(mutations.map((m) => m.name)).toEqual(['downtime:end'])
  })
})

describe('ProposalInbox', () => {
  test('renders nothing when there is nothing to answer', () => {
    setQueryAnswers({ 'proposals:pending': [] })
    const { container } = wrap(<ProposalInbox gameId={'g1' as never} />)
    // An empty inbox should not occupy space on a play surface.
    expect(container.innerHTML).toBe('')
  })

  test('shows what is asked and why, with Apply and Decline', () => {
    setQueryAnswers({
      'proposals:pending': [
        {
          _id: 'c1',
          entityId: 'm1',
          entityType: 'mech',
          targetName: 'Spectrum',
          field: 'currentSP',
          after: 6,
          reason: 'Rifle Squad volley',
          ts: 1,
        },
      ],
    })
    wrap(<ProposalInbox gameId={'g1' as never} />)

    expect(screen.getByText('Spectrum · SP → 6')).toBeTruthy()
    expect(screen.getByText('“Rifle Squad volley”')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply Spectrum · SP → 6' })).toBeTruthy()
    // Decline is a peer, not a dismissal.
    expect(screen.getByRole('button', { name: 'Decline Spectrum · SP → 6' })).toBeTruthy()
  })

  test('a null value renders as a dash rather than "null"', () => {
    setQueryAnswers({
      'proposals:pending': [
        {
          _id: 'c1',
          entityId: 'm1',
          entityType: 'mech',
          targetName: null,
          field: 'currentSP',
          after: null,
          reason: null,
          ts: 1,
        },
      ],
    })
    wrap(<ProposalInbox gameId={'g1' as never} />)
    expect(screen.getByText('mech · SP → —')).toBeTruthy()
  })
})

afterAll(convexMocks.restore)

/**
 * The Mediator Dashboard's wiring (board M1; mediator-dashboard.md): what it
 * reads off the live queries and which Convex mutation each control sends.
 * `MediatorDashboardView.test.tsx` covers the presentation; this covers the
 * container — the primary crawler, Downtime's reading, the tray's writes
 * (a new NPC at full HP with a numbered name, a Morale roll kept on the NPC),
 * proposals and alerts with a refusal said in the server's own words, the
 * next page of proposals, and the clock that moves "just now" on.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { afterAll, afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Toaster, toast } from 'component-lib'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { ConvexError } from 'convex/values'
import { PROPOSALS_PAGE } from 'itun-domain/games/proposals'
import type { QueryAnswers } from '../../__tests__/convexMock'
import { installConvexMocks, queryCalls, setQueryAnswers } from '../../__tests__/convexMock'
import { crawlerFixture } from '../../__tests__/fixtures'
import { TABLE_CREW, TABLE_MEMBERS, TABLE_SEATS } from './tableFixture'

type Sent = { name: string; args: Record<string, unknown> }

const sent: Sent[] = []
let refusals: Record<string, unknown> = {}

function useMutation(ref: unknown) {
  const name = getFunctionName(ref as FunctionReference<'mutation'>)
  const mutate = async (args: Record<string, unknown>) => {
    sent.push({ name, args })
    if (name in refusals) throw refusals[name]
    return null
  }
  return Object.assign(mutate, { withOptimisticUpdate: () => mutate })
}

const convexMocks = await installConvexMocks({ convexReact: { useMutation } })

const { MediatorDashboard } = await import('../MediatorDashboard')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')

afterAll(convexMocks.restore)

const CONNECTED = {
  mode: 'connected' as const,
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

const NOW = Date.parse('2026-10-09T12:00:00.000Z')

const tenacity = crawlerFixture({
  id: 'tenacity',
  name: '#430 Tenacity',
  techLevel: 'tech-2',
  scrapPool: { tl2: 7 },
})
const spare = crawlerFixture({ id: 'spare', name: 'Spare Crawler' })

function answers(over: QueryAnswers = {}): QueryAnswers {
  return {
    'games:members': TABLE_MEMBERS,
    'crew:vitals': TABLE_CREW,
    'seats:forGame': TABLE_SEATS,
    'entities:listForGame': {
      crawlers: [
        { _id: 'c-spare', appId: 'spare', body: spare },
        { _id: 'c-tenacity', appId: 'tenacity', body: tenacity },
      ],
      primaryCrawlerId: 'c-tenacity',
    },
    'downtime:state': null,
    'mediator:npcs': [
      {
        _id: 'n1',
        body: {
          name: 'Rifle Squad',
          refSchema: 'squads',
          refSlug: 'rifle-squad',
          currentHp: 7,
          maxHp: 10,
          statKind: 'hp',
        },
      },
    ],
    'proposals:sent': [],
    'proposals:alerts': [],
    'changeLog:rolls': [],
    ...over,
  }
}

async function renderDashboard(over: QueryAnswers = {}) {
  setQueryAnswers(answers(over))
  await act(async () => {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <MediatorDashboard gameId="g1" gameName="Reclamation of the Wastes" />
        <Toaster />
      </ConnectionContext.Provider>
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

async function openTab(name: string) {
  const tab = screen.getAllByRole('tab', { name })[0]
  if (!tab) throw new Error(`no ${name} tab`)
  await click(tab)
}

beforeEach(() => {
  sent.length = 0
  refusals = {}
  toast.dismiss()
})

afterEach(() => {
  toast.dismiss()
})

describe('what it reads', () => {
  test('every query is for this Game, and the crawler shown is the primary one', async () => {
    await renderDashboard()
    for (const call of queryCalls()) {
      expect((call.args as { gameId: string }).gameId).toBe('g1')
    }
    expect(screen.getByRole('heading', { name: /^#430 Tenacity/ })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: "Open #430 Tenacity's sheet" }).getAttribute('href')
    ).toBe('/sheet/crawler/tenacity')
    expect(screen.queryByText('Spare Crawler')).toBeNull()
  })

  test('with no primary named, the first crawler stands in', async () => {
    const listing = answers()['entities:listForGame'] as { crawlers: unknown[] }
    await renderDashboard({
      'entities:listForGame': { crawlers: listing.crawlers, primaryCrawlerId: null },
    })
    expect(screen.getByRole('heading', { name: /^Spare Crawler/ })).toBeTruthy()
  })

  test('with no crawler, it says the Game has none', async () => {
    await renderDashboard({ 'entities:listForGame': { crawlers: [], primaryCrawlerId: null } })
    expect(screen.getByText('This Game has no Union Crawler yet.')).toBeTruthy()
  })

  test('while everything loads, the surface waits on each part rather than guessing', async () => {
    await renderDashboard({
      'games:members': undefined,
      'crew:vitals': undefined,
      'seats:forGame': undefined,
      'entities:listForGame': undefined,
      'mediator:npcs': undefined,
      'proposals:sent': undefined,
      'proposals:alerts': undefined,
      'changeLog:rolls': undefined,
      'downtime:state': undefined,
    })
    expect(screen.getByText('The tray is on its way.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Begin Downtime' })).toBeTruthy()
  })

  test("a running Downtime reads its step, who is done, and upkeep in the crawler's tech level", async () => {
    await renderDashboard({
      'downtime:state': {
        running: true,
        stepIndex: 1,
        completedBy: ['u-rosa', 'u-teo'],
        upkeepSpent: false,
      },
    })
    expect(screen.getByText('Step 2 of 10 · Upkeep & Upgrade')).toBeTruthy()
    expect(screen.getByText(/2 of 5 done · upkeep due: 5 TL2 scrap/)).toBeTruthy()
  })
})

describe('Downtime writes', () => {
  test('Begin Downtime begins it for this Game', async () => {
    await renderDashboard()
    await click(screen.getByRole('button', { name: 'Begin Downtime' }))
    expect(sent).toEqual([{ name: 'downtime:begin', args: { gameId: 'g1' } }])
  })

  test('running: Pay upkeep, Next step, and End once confirmed', async () => {
    await renderDashboard({
      'downtime:state': { running: true, stepIndex: 1, completedBy: [], upkeepSpent: false },
    })
    await click(screen.getByRole('button', { name: 'Pay upkeep' }))
    await click(screen.getByRole('button', { name: 'Next step' }))
    await click(screen.getByRole('button', { name: 'End' }))
    await click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: /End Downtime/ })
    )
    expect(sent.map((s) => s.name)).toEqual([
      'downtime:spendUpkeep',
      'downtime:advance',
      'downtime:end',
    ])
    expect(sent.every((s) => s.args.gameId === 'g1')).toBe(true)
  })

  test('a refusal is said in the server’s own words', async () => {
    refusals = { 'downtime:begin': new ConvexError('Downtime is already running') }
    await renderDashboard()
    await click(screen.getByRole('button', { name: 'Begin Downtime' }))
    expect(await screen.findByText('Downtime is already running')).toBeTruthy()
  })
})

describe('the tray', () => {
  test('an NPC from the reference joins at full HP, numbered when the tray already has one', async () => {
    await renderDashboard()
    await click(screen.getByRole('button', { name: '+ From the reference' }))
    const picker = within(screen.getByRole('dialog'))
    await act(async () => {
      fireEvent.change(picker.getByLabelText('Draw from'), { target: { value: 'squads' } })
    })
    await click(picker.getByRole('button', { name: 'Add Rifle Squad' }))
    expect(sent).toHaveLength(1)
    expect(sent[0]?.name).toBe('mediator:addNpc')
    expect(sent[0]?.args.gameId).toBe('g1')
    expect(sent[0]?.args.body).toMatchObject({
      refSchema: 'squads',
      refSlug: 'rifle-squad',
      name: 'Rifle Squad 2',
      currentHp: 10,
      maxHp: 10,
    })
  })

  test('the gauge patches that NPC’s HP', async () => {
    await renderDashboard()
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'HP' }), { key: 'ArrowLeft' })
    })
    expect(sent).toEqual([
      { name: 'mediator:updateNpc', args: { npcId: 'n1', patch: { currentHp: 6 } } },
    ])
  })

  test('Morale rolls on the Morale table and keeps the result on the NPC', async () => {
    await renderDashboard()
    await click(screen.getByRole('button', { name: 'Roll Morale for Rifle Squad' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.name).toBe('mediator:updateNpc')
    expect(sent[0]?.args.npcId).toBe('n1')
    const patch = sent[0]?.args.patch as
      | { lastMediatorRoll: { table: string; roll: number } }
      | undefined
    const roll = patch?.lastMediatorRoll
    if (!roll) throw new Error('no Morale roll was kept')
    expect(roll.table).toBe('morale')
    expect(roll.roll).toBeGreaterThanOrEqual(1)
    expect(roll.roll).toBeLessThanOrEqual(20)
  })

  test('Remove, confirmed, removes that NPC', async () => {
    await renderDashboard()
    await click(screen.getByRole('button', { name: 'Remove Rifle Squad' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }))
    expect(sent).toEqual([{ name: 'mediator:removeNpc', args: { npcId: 'n1' } }])
  })
})

describe('proposals and alerts', () => {
  test('Propose sends the change for the picked seat', async () => {
    await renderDashboard()
    await click(screen.getByRole('radio', { name: /^Judge, / }))
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2' } })
    await click(screen.getByRole('button', { name: 'Propose' }))
    expect(sent).toEqual([
      {
        name: 'proposals:propose',
        args: { entityId: 'row-judge', entityType: 'pilot', field: 'currentHP', after: 2 },
      },
    ])
  })

  test('a refused proposal is said, and anything else gets the fallback line', async () => {
    refusals = { 'proposals:propose': new Error('socket closed') }
    await renderDashboard()
    await click(screen.getByRole('radio', { name: /^Judge, / }))
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2' } })
    await click(screen.getByRole('button', { name: 'Propose' }))
    expect(await screen.findByText('That did not reach the table. Try again.')).toBeTruthy()
  })

  test('Tell the table broadcasts the message to this Game', async () => {
    await renderDashboard()
    await openTab('Tell the table')
    fireEvent.change(screen.getByLabelText('Alert'), { target: { value: 'Contact front' } })
    await click(screen.getByRole('button', { name: 'Send' }))
    expect(sent).toEqual([
      { name: 'proposals:broadcast', args: { gameId: 'g1', message: 'Contact front' } },
    ])
  })

  test('a refused broadcast keeps the message and says why', async () => {
    refusals = { 'proposals:broadcast': new ConvexError('Only the Mediator can do that') }
    await renderDashboard()
    await openTab('Tell the table')
    fireEvent.change(screen.getByLabelText('Alert'), { target: { value: 'Contact front' } })
    await click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Only the Mediator can do that')).toBeTruthy()
    expect((screen.getByLabelText('Alert') as HTMLInputElement).value).toBe('Contact front')
  })

  test('a full page of proposals offers more, and asks for the next page', async () => {
    const page = Array.from({ length: PROPOSALS_PAGE }, (_, i) => ({
      _id: `p${i}`,
      entityId: 'bonesaw',
      entityType: 'pilot',
      targetName: 'Bonesaw',
      field: 'currentHP',
      after: i,
      state: 'pending',
      ts: NOW,
      mine: true,
      actorName: null,
    }))
    await renderDashboard({ 'proposals:sent': page })
    await openTab('Proposals')
    await click(screen.getByRole('button', { name: `Show ${PROPOSALS_PAGE} more` }))
    const asked = queryCalls().filter((c) => c.name === 'proposals:sent')
    expect((asked.at(-1)?.args as { limit: number } | undefined)?.limit).toBe(PROPOSALS_PAGE * 2)
  })
})

describe('the clock', () => {
  test('"just now" moves on without a write', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(NOW)
    try {
      await renderDashboard({
        'proposals:alerts': [{ _id: 'a1', message: 'Contact front', ts: NOW }],
      })
      await openTab('Tell the table')
      const list = () => within(screen.getByRole('list', { name: 'Sent to the table' }))
      expect(list().getByText('just now')).toBeTruthy()
      await act(async () => {
        jest.setSystemTime(NOW + 120_000)
        jest.advanceTimersByTime(30_000)
      })
      expect(list().getByText('2 min ago')).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })
})

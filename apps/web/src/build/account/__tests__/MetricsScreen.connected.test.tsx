/**
 * The admin metrics page (ADR-057): the totals and the weekly tallies for an
 * admin, and "nothing here" for everybody else, whether the Worker answered
 * them null or they are not connected at all (so nothing is even asked).
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import type { AdminMetrics } from '../../../lib/account/accountApi'

let metrics: AdminMetrics | undefined
let asked = 0

const realApi = { ...(await import('../../../lib/account/accountApi')) }
const serverMocks = await installServerMocks({
  also: {
    '../../lib/account/accountApi': () => ({
      ...realApi,
      useAdminMetrics: () => {
        asked++
        return metrics
      },
    }),
  },
})
afterAll(() => serverMocks.restore())

const { MetricsScreen } = await import('../MetricsScreen')
const { SyncContext } = await import('../../../replica/syncContext')

const TOTALS = {
  accounts: 41,
  pilots: 120,
  mechs: 97,
  crawlers: 12,
  npcs: 30,
  patterns: 8,
  games: 9,
  sharedGames: 5,
  botGuilds: 3,
  botGuildsThisWeek: 2,
}

function renderAs(status: 'live' | 'signedOut' | 'offline') {
  return render(
    <SyncContext.Provider value={{ status, canWrite: status === 'live', outdated: false }}>
      <MetricsScreen />
    </SyncContext.Provider>
  )
}

beforeEach(() => {
  metrics = undefined
  asked = 0
})

describe('the metrics page', () => {
  test('signed out or offline there is nothing here, and nothing is asked', () => {
    renderAs('signedOut')
    expect(screen.getByText('There is nothing here for you.')).toBeTruthy()
    expect(asked).toBe(0)
  })

  test('connected, it waits for the answer', () => {
    renderAs('live')
    expect(screen.getByText(/the metrics/)).toBeTruthy()
    expect(screen.queryByText('Totals')).toBeNull()
  })

  test('anyone who is not an admin is answered null: nothing here', () => {
    metrics = null
    renderAs('live')
    expect(screen.getByText('There is nothing here for you.')).toBeTruthy()
    expect(screen.queryByText('Totals')).toBeNull()
  })

  test('an admin with no tallies sees the totals and that nothing is tallied', () => {
    metrics = { totals: TOTALS, weeks: [] }
    renderAs('live')
    expect(screen.getByRole('heading', { level: 1, name: 'Metrics' })).toBeTruthy()
    expect(screen.getByText('Games with 2+')).toBeTruthy()
    expect(screen.getByText('120')).toBeTruthy()
    expect(screen.getByText(/Nothing tallied yet/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  test('the weekly table has a column per week and a named row per tally', () => {
    metrics = {
      totals: TOTALS,
      weeks: [
        {
          weekStart: Date.UTC(2026, 10, 16),
          counts: { 'downtime:game': 4, 'bot:su roll': 17, 'session:game': 2, custom: 1 },
        },
        { weekStart: Date.UTC(2026, 10, 9), counts: { 'downtime:solo': 6, 'bot:su roll': 3 } },
      ],
    } as AdminMetrics
    renderAs('live')
    const table = within(screen.getByRole('table'))
    const heads = table.getAllByRole('columnheader').map((th) => th.textContent)
    expect(heads[0]).toBe('Week of')
    expect(heads[1]).toMatch(/16/)
    expect(heads[2]).toMatch(/9/)
    const row = (name: string) =>
      within(table.getByRole('rowheader', { name }).closest('tr') as HTMLElement)
        .getAllByRole('cell')
        .map((td) => td.textContent)
    // A week that did not tally a key reads 0.
    expect(row('/su roll')).toEqual(['17', '3'])
    expect(row('Downtime at a Game')).toEqual(['4', '0'])
    expect(row('Downtime solo')).toEqual(['0', '6'])
    expect(row('Group sessions started')).toEqual(['2', '0'])
    // A key the page has no words for shows as it is kept.
    expect(row('custom')).toEqual(['1', '0'])
  })
})

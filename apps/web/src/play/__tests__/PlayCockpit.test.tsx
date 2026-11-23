/**
 * The Cockpit's frame (Play, Direction A): the Play bar, then from `lg` the
 * three columns as named regions with Slab headings and the foot, and below
 * it the same panes as tabs under the pinned row (play.md §11). Who
 * may open it is `PlayGate`'s, tested in `PlayGate.connected.test.tsx`; the
 * columns' content arrives with their own issues.
 *
 * Without a router, so the bar's "‹ Play" is a plain anchor.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import { CHAPTER_BAND_COLOR } from '../../components/atoms/chapterBandColor'
import { closeRooms, serveReads } from '../../replica/__tests__/fakeRooms'
import type { SyncStatus } from '../../replica/sync'
import { narrowViewport } from './narrowViewport'

// Module scope, before the imports below — see `serverMock.ts`. The frame
// reads the seat and the Downtime (`usePlaySituation`): an empty seat, with
// no Downtime running. The Situation itself is `PlaySituation.connected.test.tsx`'s.
const serverMocks = await installServerMocks()
const NOT_RUNNING = { running: false, stepIndex: null, completedBy: [], upkeepSpent: false }
const ANSWERS = {
  'seats.solo': null,
  'seats.forGame': [],
  'scenes.current': { conditions: [], hours: 0 },
  'downtime.state': NOT_RUNNING,
  // No area named to Area Salvage.
  'salvageAreas.here': null,
  'games.members': [],
  'games.listing': null,
  'account.me': null,
  // The channel button, the Crew, Tables and Feed panes: no
  // channel bound, no crew read yet, nothing on the Game's log.
  'channelBindings.current': null,
  'safety.stopSign': null,
  'games.get': null,
  'changeLog.rolls': [],
  'changeLog.alerts': [],
  'ops.pending': [],
  'crew.vitals': null,
}
answerReads(ANSWERS)

const { resetSync } = await import('../../replica/sync')
const { useUnits } = await import('../../replica/units')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { SyncContext } = await import('../../replica/syncContext')
const { PlayCockpit } = await import('../PlayCockpit')
const { PLAY_RULES_ASKED } = await import('../useFindKey')
const { askPlayTable } = await import('../zeroVital.model')

beforeAll(async () => {
  await hydrateStores()
  resetSync()
  await useUnits
    .getState()
    .adopt('pilot', pilotFixture({ id: 'cockpit-wren', name: 'Wren', callsign: 'Fixture' }))
})

afterAll(async () => {
  await useUnits.getState().forget('pilot', 'cockpit-wren')
  serverMocks.restore()
})

async function renderCockpit(
  target: { gameId: string | null; gameName: string | null },
  status: SyncStatus = 'live'
) {
  const state = {
    status,
    canWrite: status === 'live',
    outdated: false,
  }
  await act(async () => {
    render(
      <SyncContext.Provider value={state}>
        <PlayCockpit target={{ pilotId: 'cockpit-wren', mediator: false, ...target }} />
      </SyncContext.Provider>
    )
  })
}

describe('the Cockpit frame', () => {
  test('a solo pilot: the bar reads <pilot> with a Solo chip, no LIVE stamp, the way back to its sheet', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('heading', { level: 1 }).textContent).toBe('Fixture')
    expect(bar.getByText('Solo')).toBeTruthy()
    // A solo screen shares nothing: no LIVE stamp.
    expect(bar.queryByText(/● Online/)).toBeNull()
    expect(bar.getByRole('link', { name: 'Back to Sheet' }).getAttribute('href')).toMatch(
      /^\/pilots\/[^/]+$/
    )
    // Nothing bound: no channel button; the way to bind one is the ⋯'s row.
    expect(bar.queryByRole('button', { name: /Discord channel/ })).toBeNull()
    fireEvent.click(bar.getByRole('button', { name: 'More' }))
    expect(await screen.findByRole('menuitem', { name: /Discord channel/ })).toBeTruthy()
  })

  test('⋯ › Show a sheet puts the pilot’s sheet on the screen; × brings the pane back (play.md §18)', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const bar = within(screen.getByRole('banner'))
    await act(async () => {
      fireEvent.click(bar.getByRole('button', { name: 'More' }))
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitem', { name: /Show a sheet/ }))
    })
    const pane = within(screen.getByRole('region', { name: 'Sheet' }))
    expect(pane.getByRole('button', { name: 'Show a sheet' })).toBeTruthy()
    expect(pane.getByRole('link', { name: 'Edit in Build' }).getAttribute('href')).toMatch(
      /^\/pilots\/cockpit-wren/
    )
    await act(async () => {
      fireEvent.click(pane.getByRole('button', { name: 'Back to Actions' }))
    })
    expect(screen.queryByRole('region', { name: 'Sheet' })).toBeNull()
  })

  test('on foot the bar and the foot wear the pilot’s orange, ink on it', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    for (const band of [screen.getByRole('banner'), screen.getByRole('contentinfo')]) {
      expect(band.style.background).toBe(CHAPTER_BAND_COLOR.pilot)
      expect(band.style.color).toBe('var(--color-ink)')
      expect(band.classList.contains('su-play-band')).toBe(true)
    }
    expect(screen.getByRole('banner').dataset.ground).toBe('paper')
  })

  test('in a Game, the bar reads the Game’s name', async () => {
    await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tenacity')
    expect(screen.getByText('Connected · changes reach the table live')).toBeTruthy()
    expect(within(screen.getByRole('banner')).getByText(/● Online/)).toBeTruthy()
  })

  test('in a Game, “‹ Sheet” goes back to the pilot’s page and ⋯ › Game page opens the Game’s (ADR-066)', async () => {
    await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('link', { name: 'Back to Sheet' }).getAttribute('href')).toMatch(
      /^\/pilots\/[^/]+$/
    )
    const more = bar.getByRole('button', { name: 'More' })
    expect(more.hasAttribute('disabled')).toBe(false)
    await act(async () => {
      fireEvent.click(more)
    })
    expect(await screen.findByRole('menuitem', { name: /Game page/ })).toBeTruthy()
  })

  test('in a Game, the bar has Stop; up, the Stop Sign turns the band the stop colour', async () => {
    answerReads({
      ...ANSWERS,
      'safety.stopSign': {
        stop: { shownAt: 1, mine: false },
        mayLift: false,
      },
    })
    try {
      await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
      const stop = within(screen.getByRole('banner')).getByRole('button', {
        name: 'Show the Stop Sign',
      }) as HTMLButtonElement
      expect(stop.disabled).toBe(true)
      // The words and Resume are the pinned notice's (`TableNotices`), over every screen.
      expect(screen.getByRole('banner').style.background).toBe('rgb(176, 67, 43)')
    } finally {
      answerReads(ANSWERS)
    }
  })

  test('solo there is no table, so no Stop', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    expect(screen.queryByRole('button', { name: 'Show the Stop Sign' })).toBeNull()
  })

  test('a bound channel: the button names it, as it was when bound', async () => {
    answerReads({
      ...ANSWERS,
      'channelBindings.current': { channelId: 'c-1', channelName: 'salvage-run', boundAt: 1 },
    })
    try {
      await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
      const bar = within(screen.getByRole('banner'))
      expect(bar.getByRole('button', { name: '#salvage-run: where rolls post' }).textContent).toBe(
        '#salvage-run'
      )
    } finally {
      answerReads(ANSWERS)
    }
  })

  test('three columns, each a region: Units over the Feed, Actions, then Crew, Tables and the Rules', async () => {
    await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
    const headings = (name: string) =>
      within(screen.getByRole('region', { name }))
        .getAllByRole('heading')
        .map((h) => h.textContent)
    expect(headings('Units and Feed')).toEqual(expect.arrayContaining(['Units', 'Feed']))
    expect(headings('Actions')).toContain('Actions')
    const end = headings('Crew, Tables and Rules')
    expect(end.slice(0, 2)).toEqual(['Crew', 'Rolls'])
    // The Reference closes the column, under the Tables.
    expect(end.length).toBeGreaterThan(2)
    expect(end).not.toContain('Feed')
  })

  test('the foot says who play reaches; no tabs from `lg`', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const foot = within(screen.getByRole('contentinfo'))
    expect(foot.getByText('Solo · nothing is shared')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tabpanel')).toBeNull()
  })

  test('offline, Play is read-only and says so once, in the bar’s stamp', async () => {
    answerReads({ ...ANSWERS, 'safety.stopSign': { stop: null, mayLift: false } })
    try {
      await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' }, 'offline')
      expect(screen.queryByText(/● Online/)).toBeNull()
      const bar = within(screen.getByRole('banner'))
      expect(bar.getByRole('status').textContent).toBe('Offline · read-only')
      expect(within(screen.getByRole('contentinfo')).queryByRole('status')).toBeNull()
      // The table stays in view as last read (r6 A14): Stop is there, off until reconnect.
      const stop = bar.getByRole('button', { name: 'Show the Stop Sign' }) as HTMLButtonElement
      expect(stop.disabled).toBe(true)
    } finally {
      answerReads(ANSWERS)
    }
  })

  test('solo has no Crew section: the Tables lead the end column', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const side = within(screen.getByRole('region', { name: 'Crew, Tables and Rules' }))
    const headings = side.getAllByRole('heading').map((h) => h.textContent)
    expect(headings[0]).toBe('Rolls')
    expect(headings).not.toContain('Crew')
  })
})

describe('below `lg`: the same panes as tabs (play.md §11)', () => {
  test('a 390px phone gets the tabs, not the columns; the Situation is pinned, and in the bar’s ⋯', async () => {
    const restore = narrowViewport()
    try {
      await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
      expect(screen.queryByRole('region', { name: 'Units and Feed' })).toBeNull()
      // No foot: the tabs take the screen's foot.
      expect(screen.queryByRole('contentinfo')).toBeNull()
      const tabs = within(screen.getByRole('tablist', { name: 'Play' })).getAllByRole('tab')
      expect(tabs.map((t) => t.textContent)).toEqual(['Act', 'Crew', 'Feed', 'Rules'])
      const bar = within(screen.getByRole('banner'))
      // The band's crumb names the Game and the phase; the title says who is playing.
      expect(bar.getByText('Tenacity')).toBeTruthy()
      expect(bar.getByText(/On foot/)).toBeTruthy()
      expect(bar.getByRole('heading', { level: 1 }).textContent).toBe('Fixture')
      expect(bar.getByRole('link', { name: 'Back to Sheet' }).textContent).toBe('Back to Sheet')
      // On a phone the Situation switch is pinned (r5 A15), and its moves are ⋯ rows too.
      expect(
        screen.getByRole('group', { name: 'Situation' }).closest('.su-play-frame__pinned')
      ).not.toBeNull()
      await act(async () => {
        fireEvent.click(bar.getByRole('button', { name: 'More' }))
      })
      expect(await screen.findByRole('menuitem', { name: /On foot/ })).toBeTruthy()
      expect(screen.getByRole('menuitem', { name: /Downtime/ })).toBeTruthy()
      expect(screen.getByRole('menuitem', { name: /Table mode/ })).toBeTruthy()
    } finally {
      restore()
    }
  })
})

describe('Ctrl+K on Play (r8 A7)', () => {
  test('on a phone it opens the Rules tab, where the search is', async () => {
    const restore = narrowViewport()
    try {
      await renderCockpit({ gameId: null, gameName: null })
      await act(async () => {
        window.dispatchEvent(new Event(PLAY_RULES_ASKED))
      })
      const rules = screen.getByRole('tab', { name: 'Rules' })
      expect(rules.getAttribute('aria-selected')).toBe('true')
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'Act' }))
      })
      // A zero-vital notice asks for its roll table: below `lg` the tables head the Rules tab.
      await act(async () => {
        askPlayTable('Critical Injury')
      })
      expect(screen.getByRole('tab', { name: 'Rules' }).getAttribute('aria-selected')).toBe('true')
    } finally {
      restore()
    }
  })
})

/** Answer the Games reads, and serve the Game room's records from the table reads among them. */
function answerReads(answers: Record<string, unknown>): void {
  setQueryAnswers(answers)
  serveReads('g1', answers)
}

afterEach(closeRooms)

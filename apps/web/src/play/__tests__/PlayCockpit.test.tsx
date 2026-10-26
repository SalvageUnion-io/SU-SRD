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
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { CHAPTER_BAND_COLOR } from '../../components/atoms/chapterBandColor'
import { closeRooms, serveReads } from '../../replica/__tests__/fakeRooms'
import type { SyncStatus } from '../../replica/sync'
import { narrowViewport } from './narrowViewport'

// Module scope, before the imports below — see `convexMock.ts`. The frame
// reads the seat and the Downtime (`usePlaySituation`): an empty seat, with
// no Downtime running. The Situation itself is `PlaySituation.connected.test.tsx`'s.
const convexMocks = await installConvexMocks()
const NOT_RUNNING = { running: false, stepIndex: null, completedBy: [], upkeepSpent: false }
const ANSWERS = {
  'seats:solo': null,
  'seats:forGame': [],
  'scenes:current': { conditions: [], hours: 0 },
  'downtime:state': NOT_RUNNING,
  // No area named to Area Salvage.
  'salvageAreas:here': null,
  'games:members': [],
  'entities:listForGame': null,
  'account:me': null,
  // The channel button, the Crew, Tables and Feed panes: no
  // channel bound, no crew read yet, nothing on the Game's log.
  'channelBindings:current': null,
  'safety:stopSign': null,
  'games:get': null,
  'changeLog:rolls': [],
  'changeLog:alerts': [],
  'ops:pending': [],
  'crew:vitals': null,
}
answerReads(ANSWERS)

const { resetSync } = await import('../../replica/sync')
const { useUnits } = await import('../../replica/units')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { SyncContext } = await import('../../replica/syncContext')
const { PlayCockpit } = await import('../PlayCockpit')

beforeAll(async () => {
  await hydrateStores()
  resetSync()
  await useUnits.getState().adopt('pilot', pilotFixture({ id: 'cockpit-wren', name: 'Wren' }))
})

afterAll(async () => {
  await useUnits.getState().forget('pilot', 'cockpit-wren')
  convexMocks.restore()
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
  test('a solo pilot: the bar reads <pilot> with a Solo chip, no LIVE stamp, the way back to Play', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('heading', { level: 1 }).textContent).toBe('Wren')
    expect(bar.getByText('Solo')).toBeTruthy()
    // A solo screen shares nothing: no LIVE stamp.
    expect(bar.queryByText(/● Live/)).toBeNull()
    expect(bar.getByRole('link', { name: 'Back to Play' }).getAttribute('href')).toBe('/play/')
    // Nothing bound: the channel button is Connect.
    expect(bar.getByRole('button', { name: 'Connect a Discord channel' })).toBeTruthy()
    expect(bar.getByRole('button', { name: 'More' })).toBeTruthy()
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
    expect(within(screen.getByRole('banner')).getByText(/● Live/)).toBeTruthy()
  })

  test('in a Game, “‹ Game” and ⋯ › Game page open the Game’s page (ADR-052 §5–§6)', async () => {
    await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('link', { name: 'Back to Game' }).getAttribute('href')).toBe(
      '/play/games/g1'
    )
    const more = bar.getByRole('button', { name: 'More' })
    expect(more.hasAttribute('disabled')).toBe(false)
    await act(async () => {
      fireEvent.click(more)
    })
    expect(await screen.findByRole('menuitem', { name: /Game page/ })).toBeTruthy()
  })

  test('in a Game, the bar has Stop; up, the Stop Sign pauses the screen under the bar', async () => {
    answerReads({
      ...ANSWERS,
      'safety:stopSign': {
        stop: { shownAt: 1, mine: false },
        mayLift: false,
        mayManage: false,
        postToChannel: false,
      },
    })
    try {
      await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
      const stop = within(screen.getByRole('banner')).getByRole('button', {
        name: 'Show the Stop Sign',
      }) as HTMLButtonElement
      expect(stop.disabled).toBe(true)
      expect(screen.getByText('Stop Sign: the game is paused')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Resume play' })).toBeNull()
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
      'channelBindings:current': { channelId: 'c-1', channelName: 'salvage-run', boundAt: 1 },
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

  test('three columns, each a region headed by its Slab (the Crew is a Game’s)', async () => {
    await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
    const regions = ['Units', 'Actions', 'Crew, Tables and Feed'].map((name) =>
      screen.getByRole('region', { name })
    )
    expect(within(regions[0] as HTMLElement).getByRole('heading', { name: 'Units' })).toBeTruthy()
    expect(within(regions[1] as HTMLElement).getByRole('heading', { name: 'Actions' })).toBeTruthy()
    expect(
      within(regions[2] as HTMLElement)
        .getAllByRole('heading')
        .map((h) => h.textContent)
    ).toEqual(['Crew', 'Tables', 'Feed'])
  })

  test('the foot says who play reaches; no tabs from `lg`', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const foot = within(screen.getByRole('contentinfo'))
    expect(foot.getByText('Solo · nothing is shared')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tabpanel')).toBeNull()
  })

  test('offline, Play is read-only and says so once, in the bar’s stamp', async () => {
    await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' }, 'offline')
    expect(screen.queryByText(/● Live/)).toBeNull()
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('status').textContent).toBe('Offline · read-only')
    expect(within(screen.getByRole('contentinfo')).queryByRole('status')).toBeNull()
  })

  test('solo has no Crew section: Tables and Feed only', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const side = within(screen.getByRole('region', { name: 'Crew, Tables and Feed' }))
    expect(side.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Tables', 'Feed'])
  })
})

describe('below `lg`: the same panes as tabs (play.md §11)', () => {
  test('a 390px phone gets the tabs, not the columns; the bar on top, the switch pinned', async () => {
    const restore = narrowViewport()
    try {
      await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
      expect(screen.queryByRole('region', { name: 'Units' })).toBeNull()
      // No foot: the tabs take the screen's foot.
      expect(screen.queryByRole('contentinfo')).toBeNull()
      const tabs = within(screen.getByRole('tablist', { name: 'Play' })).getAllByRole('tab')
      expect(tabs.map((t) => t.textContent)).toEqual(['Act', 'Units', 'Tables', 'Crew'])
      const bar = within(screen.getByRole('banner'))
      expect(bar.getByRole('heading', { level: 1 }).textContent).toBe('Tenacity')
      // Back names its place on a phone too; the Situation is pinned, not in the bar.
      expect(bar.getByRole('link', { name: 'Back to Game' }).textContent).toBe('Back to Game')
      expect(bar.queryByRole('group', { name: 'Situation' })).toBeNull()
      expect(screen.getByRole('group', { name: 'Situation' })).toBeTruthy()
    } finally {
      restore()
    }
  })
})

/** Answer the Convex reads, and serve the Game room's records from the table reads among them. */
function answerReads(answers: Record<string, unknown>): void {
  setQueryAnswers(answers)
  serveReads('g1', answers)
}

afterEach(closeRooms)

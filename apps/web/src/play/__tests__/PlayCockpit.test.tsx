/**
 * The Cockpit's frame (Play, Direction A): the Play bar, the three columns as
 * named regions with Slab headings, and the foot, on the fixed canvas. Who
 * may open it is `PlayGate`'s, tested in `PlayGate.connected.test.tsx`; the
 * columns' content arrives with their own issues.
 *
 * Without a router, so the bar's "‹ Play" is a plain anchor.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import { pilotFixture } from '../../components/__tests__/fixtures'
import type { ConnectionMode } from '../../lib/connection/connectionMode'
import { phoneViewport } from './phoneViewport'

// Module scope, before the imports below — see `convexMock.ts`. The frame
// reads the seat and the Downtime (`usePlaySituation`): an empty seat, with
// no Downtime running. The Situation itself is `PlaySituation.connected.test.tsx`'s.
const convexMocks = await installConvexMocks()
const NOT_RUNNING = { running: false, stepIndex: null, completedBy: [], upkeepSpent: false }
const ANSWERS = {
  'seats:solo': null,
  'seats:forGame': [],
  'downtime:soloState': NOT_RUNNING,
  'downtime:state': NOT_RUNNING,
  'games:members': [],
  'entities:listForGame': null,
  'account:me': null,
  // The channel button, the Crew, Tables and Feed (`PlaySideColumn`): no
  // channel bound, no crew read yet, nothing on the Game's log.
  'channelBindings:current': null,
  'games:get': null,
  'changeLog:rolls': [],
  'proposals:alerts': [],
  'proposals:pending': [],
  'crew:vitals': null,
}
setQueryAnswers(ANSWERS)

const { setEntityBackendAuthState } = await import('../../stores/entityBackend')
const { useEntityStore } = await import('../../stores/entityStore')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { ConnectionContext } = await import('../../lib/connection/connectionContext')
const { PlayCockpit } = await import('../PlayCockpit')

beforeAll(async () => {
  await hydrateStores()
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'cockpit-wren', name: 'Wren' }))
})

afterAll(async () => {
  await useEntityStore.getState().forget('pilot', 'cockpit-wren')
  convexMocks.restore()
})

async function renderCockpit(
  target: { gameId: string | null; gameName: string | null },
  mode: ConnectionMode = 'connected'
) {
  const state = {
    mode,
    canWrite: mode === 'connected',
    showDisconnectedWarning: mode === 'disconnected',
    settling: mode === 'connecting',
  }
  await act(async () => {
    render(
      <ConnectionContext.Provider value={state}>
        <PlayCockpit target={{ pilotId: 'cockpit-wren', mediator: false, ...target }} />
      </ConnectionContext.Provider>
    )
  })
}

describe('the Cockpit frame', () => {
  test('a solo pilot: the bar reads Solo · <pilot>, no LIVE stamp, the way back to Play', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('heading', { level: 1 }).textContent).toBe('Solo · Wren')
    // A solo screen shares nothing: no LIVE stamp (the solo wireframes).
    expect(bar.queryByText(/● Live/)).toBeNull()
    expect(bar.getByRole('link', { name: 'Back to Play' }).getAttribute('href')).toBe('/play/')
    // Nothing bound: the channel button is Connect.
    expect(bar.getByRole('button', { name: 'Connect a Discord channel' })).toBeTruthy()
    expect(bar.getByRole('button', { name: 'More' })).toBeTruthy()
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

  test('a bound channel: the button names it, as it was when bound', async () => {
    setQueryAnswers({
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
      setQueryAnswers(ANSWERS)
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

  test('the foot says play is saved and who it reaches; on the fixed canvas', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const foot = within(screen.getByRole('contentinfo'))
    expect(foot.getByRole('status').textContent).toBe('● Saved')
    expect(foot.getByText('Solo · nothing is shared')).toBeTruthy()
    expect(document.querySelector('.su-dash-canvas')).not.toBeNull()
  })

  test('offline, Play is read-only and says so: the bar’s stamp and the foot', async () => {
    await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' }, 'disconnected')
    expect(screen.queryByText(/● Live/)).toBeNull()
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('status').textContent).toBe('Read-only · disconnected')
    expect(within(screen.getByRole('contentinfo')).getByRole('status').textContent).toBe(
      '○ Offline · read-only'
    )
  })

  test('solo has no Crew section: Tables and Feed only', async () => {
    await renderCockpit({ gameId: null, gameName: null })
    const side = within(screen.getByRole('region', { name: 'Crew, Tables and Feed' }))
    expect(side.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Tables', 'Feed'])
  })
})

describe('below the canvas’s floor: the phone form (play.md §11)', () => {
  test('a 390×844 phone gets the tabs, not the canvas; the bar on top, the switch pinned', async () => {
    const restore = phoneViewport()
    try {
      await renderCockpit({ gameId: 'g1', gameName: 'Tenacity' })
      expect(document.querySelector('.su-dash-canvas')).toBeNull()
      expect(document.querySelector('.su-dash-phone .su-play-phone')).not.toBeNull()
      const tabs = within(screen.getByRole('tablist', { name: 'Play' })).getAllByRole('tab')
      expect(tabs.map((t) => t.textContent)).toEqual(['Act', 'Units', 'Tables', 'Crew'])
      const bar = within(screen.getByRole('banner'))
      expect(bar.getByRole('heading', { level: 1 }).textContent).toBe('Tenacity')
      // Back names its place on a phone too; the Situation is pinned, not in the bar.
      expect(bar.getByRole('link', { name: 'Back to Game' }).textContent).toBe('Back to Game')
      expect(bar.queryByRole('group', { name: 'Situation' })).toBeNull()
      expect(screen.getByRole('group', { name: 'Situation' })).toBeTruthy()
      // The page never scrolls: the host fits the screen and hides overflow.
      const host = document.querySelector('.su-dash-phone') as HTMLElement
      expect(host.style.overflow).toBe('hidden')
    } finally {
      restore()
    }
  })
})

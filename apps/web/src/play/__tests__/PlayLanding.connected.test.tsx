import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The Play hub (`/play/`, ADR-052 §4): + New Game and Join at its head; Your
 * Games, each a Row opening the Game's page with your role, how many are
 * here and the Downtime state, and one door (Mediate where you mediate it,
 * else Play <your pilot>); Solo, each pilot in no Game with its mech's chip or
 * "No Mech" and Play solo; and Discord, each Game's channel or Connect
 * (`channelBindings.mine`). Signed out, sign in.
 *
 * Queries are answered by name (`convexMock.ts`): `games.listMine`, and
 * `downtime.state` and `seats.presence` (who is here) once per Game. Without a
 * router, so links are anchors.
 */

import {
  installConvexMocks,
  queryCalls,
  setQueryAnswers,
} from '../../components/__tests__/convexMock'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import type { ConnectionMode } from '../../lib/connection/connectionMode'

const convexMocks = await installConvexMocks()

const { PlayLanding } = await import('../PlayLanding')
const { ConnectionContext } = await import('../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useEntityStore } = await import('../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../stores/entityBackend')

const SUMMARY = { templateOrigin: undefined, organizer: false, tableRunner: false }
const TENACITY = {
  ...SUMMARY,
  _id: 'land-g1',
  name: 'Tenacity',
  mediator: false,
  memberCount: 3,
  pilotCount: 2,
  mechCount: 1,
  crawlerName: null,
}
const WASTES = {
  ...SUMMARY,
  _id: 'land-g2',
  name: 'Wastes',
  mediator: true,
  memberCount: 4,
  pilotCount: 3,
  mechCount: 2,
  crawlerName: 'Rover',
}
const IN_DOWNTIME = { running: true, stepIndex: 2, completedBy: [], upkeepSpent: false }

/** No channel bound anywhere, and nobody's seat beating: what most tests need answered. */
const QUIET = {
  'channelBindings:mine': { personal: null, games: [] },
  'seats:presence': [],
}

beforeAll(async () => {
  await hydrateStores()
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  const store = useEntityStore.getState()
  await store.adopt('pilot', pilotFixture({ id: 'land-rook', name: 'Rook', gameId: 'land-g1' }))
  await store.adopt('pilot', pilotFixture({ id: 'land-wren', name: 'Wren', gameId: null }))
  await store.adopt('pilot', pilotFixture({ id: 'land-kes', name: 'Kestrel', gameId: null }))
  await store.adopt('mech', mechFixture({ id: 'land-mech', name: 'Scrapper', gameId: null }))
  await store.adopt('softLink', {
    id: 'land-link',
    type: 'mech-to-pilot',
    from: { type: 'mech', id: 'land-mech' },
    to: { type: 'pilot', id: 'land-wren' },
    createdAt: FIXTURE_NOW,
  })
})

afterAll(async () => {
  const store = useEntityStore.getState()
  await store.forget('softLink', 'land-link')
  await store.forget('mech', 'land-mech')
  await store.forget('pilot', 'land-rook')
  await store.forget('pilot', 'land-wren')
  await store.forget('pilot', 'land-kes')
  convexMocks.restore()
})

async function renderAs(mode: ConnectionMode) {
  const state = {
    mode,
    canWrite: mode === 'connected',
    showDisconnectedWarning: mode === 'disconnected',
    settling: mode === 'connecting',
  }
  await act(async () => {
    render(
      <ConnectionContext.Provider value={state}>
        <PlayLanding />
      </ConnectionContext.Provider>
    )
  })
}

const section = (name: string) => within(screen.getByRole('region', { name }))
const card = (name: string) => {
  const item = screen.getByRole('heading', { name: `${name} (Game)` }).closest('li')
  if (!item) throw new Error(`no Game card for ${name}`)
  return within(item)
}

describe('the Play landing', () => {
  test('signed out, asks you to sign in and asks Convex nothing', async () => {
    setQueryAnswers({})
    await renderAs('solo')
    expect(screen.getByRole('heading', { name: 'Sign in to play' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in with Discord' }).getAttribute('href')).toBe(
      '/sign-in'
    )
    expect(queryCalls()).toHaveLength(0)
  })

  test('Your Games: each a Row opening its page, your role, and one door: Play <pilot> or Mediate', async () => {
    setQueryAnswers({
      'games:listMine': [TENACITY, WASTES],
      'downtime:state': IN_DOWNTIME,
      ...QUIET,
    })
    await renderAs('connected')
    const tenacity = card('Tenacity')
    // The whole Row opens the Game's page in Play.
    expect(tenacity.getByRole('link', { name: 'Tenacity' }).getAttribute('href')).toBe(
      '/play/games/land-g1'
    )
    const play = tenacity.getByRole('link', { name: 'Play Rook in Tenacity' })
    expect(play.getAttribute('href')).toBe('/play/land-rook')
    expect(play.textContent).toBe('Play Rook')
    expect(tenacity.getByText('Player')).toBeTruthy()
    expect(tenacity.queryByRole('link', { name: /^Mediate/ })).toBeNull()
    // Presence, not a member count; Downtime as a chip with its step.
    expect(tenacity.queryByText('Members')).toBeNull()
    expect(tenacity.getByText('Downtime')).toBeTruthy()
    expect(tenacity.getByText('Step 3')).toBeTruthy()

    const wastes = card('Wastes')
    expect(wastes.getByText('Mediator')).toBeTruthy()
    const mediate = wastes.getByRole('link', { name: 'Mediate Wastes' })
    expect(mediate.getAttribute('href')).toBe('/play/game/land-g2')
    expect(mediate.textContent).toBe('Mediate')
    // One door per Game.
    expect(wastes.queryByRole('link', { name: /^Play / })).toBeNull()
    // `downtime.state` for each Game.
    const asked = queryCalls()
      .filter((c) => c.name === 'downtime:state')
      .map((c) => (c.args as { gameId: string }).gameId)
    expect([...new Set(asked)].sort()).toEqual(['land-g1', 'land-g2'])
  })

  test('a Game between Downtimes shows no Downtime chip; one with none of your pilots has no door', async () => {
    setQueryAnswers({
      'games:listMine': [{ ...TENACITY, _id: 'land-g9', name: 'Elsewhere' }],
      'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
      ...QUIET,
    })
    await renderAs('connected')
    const elsewhere = card('Elsewhere')
    expect(elsewhere.queryByText('Downtime')).toBeNull()
    expect(elsewhere.queryByText('Scene')).toBeNull()
    // Its page is one tap away, and the only link on the Row.
    expect(elsewhere.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/play/games/land-g9',
    ])
  })

  test('Solo: each shelf pilot with its Mech’s chip or "No Mech", and Play solo', async () => {
    setQueryAnswers({ 'games:listMine': [], 'downtime:state': IN_DOWNTIME, ...QUIET })
    await renderAs('connected')
    const solo = section('Solo')
    expect(solo.getByRole('link', { name: 'Play Wren solo' }).getAttribute('href')).toBe(
      '/play/land-wren'
    )
    const row = (name: string) => {
      const item = solo.getByRole('link', { name: `Play ${name} solo` }).closest('li')
      if (!item) throw new Error(`no solo row for ${name}`)
      return within(item)
    }
    expect(row('Wren').getByText('Scrapper')).toBeTruthy()
    expect(row('Wren').queryByText('Mech')).toBeNull()
    expect(row('Kestrel').getByText('No Mech')).toBeTruthy()
    // A Game's pilot is not offered solo.
    expect(solo.queryByRole('link', { name: 'Play Rook solo' })).toBeNull()
    // The empty state points to New Game and Join, not to Build.
    expect(
      section('Your Games').getByText(
        'You’re in no Games yet. Start one with + New Game, or join one with its invite link.'
      )
    ).toBeTruthy()
  })

  test('the head offers + New Game and Join; Join opens the invite screen from a link or its token', async () => {
    setQueryAnswers({ 'games:listMine': [], 'templates:list': [], ...QUIET })
    const assigned: string[] = []
    const assign = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
      assigned.push(String(to))
    })
    try {
      await renderAs('connected')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '+ New Game' }))
      })
      expect(screen.getByRole('dialog', { name: 'New Game' })).toBeTruthy()
      await act(async () => {
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      })

      const field = screen.getByLabelText('Invite link')
      const join = screen.getByRole('button', { name: 'Join' })
      expect(join.hasAttribute('disabled')).toBe(true)

      fireEvent.change(field, { target: { value: 'not a link' } })
      await act(async () => {
        fireEvent.click(join)
      })
      expect(screen.getByText('That is not an invite link.')).toBeTruthy()
      expect(assigned).toEqual([])

      fireEvent.change(field, {
        target: { value: 'https://salvageunion.io/build/invite/AB12CD34EF56' },
      })
      expect(screen.queryByText('That is not an invite link.')).toBeNull()
      await act(async () => {
        fireEvent.click(join)
      })
      expect(assigned).toEqual(['/invite/AB12CD34EF56'])
    } finally {
      assign.mockRestore()
    }
  })

  test('Discord: each Game’s channel with Change, dashed "No channel yet" with Connect', async () => {
    setQueryAnswers({
      'games:listMine': [],
      'downtime:state': IN_DOWNTIME,
      'seats:presence': [],
      'channelBindings:mine': {
        personal: null,
        games: [
          {
            gameId: 'land-g1',
            gameName: 'Rust Belt Run',
            mayBind: true,
            binding: { channelId: 'c-1', channelName: 'salvage-run', boundAt: FIXTURE_NOW },
          },
          { gameId: 'land-g2', gameName: 'Frostline', mayBind: false, binding: null },
          {
            gameId: 'land-g3',
            gameName: 'Old Haul',
            mayBind: true,
            binding: { channelId: 'c-3', channelName: null, boundAt: FIXTURE_NOW },
          },
        ],
      },
    })
    await renderAs('connected')
    const discord = section('Discord')
    const row = (name: string) => {
      const item = discord.getByRole('heading', { name }).closest('li')
      if (!item) throw new Error(`no channel row for ${name}`)
      return item
    }

    // A bound channel by its name, then the Game's.
    const bound = row('#salvage-run')
    expect(within(bound).getByText('Rust Belt Run')).toBeTruthy()
    expect(
      within(bound).getByRole('button', { name: 'Change the channel for Rust Belt Run' })
    ).toBeTruthy()
    expect(bound.querySelector('[data-unbound]')).toBeNull()
    // A binding that kept no name: the Game's, and the generic label.
    expect(within(row('Old Haul')).getByText('# Channel bound')).toBeTruthy()

    const unbound = row('Frostline')
    expect(within(unbound).getByText('No channel yet')).toBeTruthy()
    expect(unbound.querySelector('.su-play-discord-row')?.hasAttribute('data-unbound')).toBe(true)
    // My own channel, for solo play, lists last.
    expect(within(row('Solo')).getByRole('button', { name: /Connect the channel/ })).toBeTruthy()

    // Connect explains /su bind: a channel is bound in Discord, not here.
    await act(async () => {
      within(unbound)
        .getByRole('button', { name: /Connect the channel/ })
        .click()
    })
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(/No Discord channel is bound to Frostline yet/)).toBeTruthy()
    expect(dialog.getByText('/su bind')).toBeTruthy()
    expect(dialog.getByText(/Only the Game’s Mediator or Organiser/)).toBeTruthy()
  })

  test('Your Games: how many are here now, from the seats’ heartbeat', async () => {
    const now = Date.now()
    setQueryAnswers({
      'games:listMine': [TENACITY],
      'downtime:state': IN_DOWNTIME,
      'channelBindings:mine': { personal: null, games: [] },
      // Two beat a moment ago; one has not beaten for an hour.
      'seats:presence': [now - 1_000, now - 5_000, now - 3_600_000],
    })
    await renderAs('connected')
    const tenacity = card('Tenacity')
    expect(tenacity.getByText('2 here')).toBeTruthy()
  })

  test('offline, the shelf still lists, and Your Games wait for the connection', async () => {
    setQueryAnswers({})
    await renderAs('disconnected')
    expect(section('Solo').getByRole('link', { name: 'Play Wren solo' })).toBeTruthy()
    expect(
      section('Your Games').getByText('Your Games list once the connection returns.')
    ).toBeTruthy()
    // Starting or joining a Game waits for the connection too.
    expect(screen.queryByRole('button', { name: '+ New Game' })).toBeNull()
    expect(screen.queryByLabelText('Invite link')).toBeNull()
    expect(queryCalls()).toHaveLength(0)
  })
})

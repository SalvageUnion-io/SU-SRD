import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, render, screen, within } from '@testing-library/react'

/**
 * The Play landing (`/play/`), as the play-entry wireframe draws it: Your
 * Games with how many are here, a Downtime chip while in Downtime, your
 * pilots and their doors (Mediate where you mediate, Play for each of your
 * pilots in the Game); Solo, each shelf pilot with its mech's chip or "No
 * Mech" and Play solo; and Discord, each Game's channel or Connect
 * (`channelBindings.mine`). Signed out, sign in.
 *
 * Queries are answered by name (`convexMock.ts`): `games.listMine`, and
 * `downtime.state` and `seats.presence` (who is here) once per Game. Without a
 * router, so links are anchors.
 */

import type { ConnectionMode } from '../../../lib/connection/connectionMode'
import { installConvexMocks, queryCalls, setQueryAnswers } from '../../__tests__/convexMock'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../__tests__/fixtures'

const convexMocks = await installConvexMocks()

const { PlayLanding } = await import('../PlayLanding')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')

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
  const item = screen.getByRole('heading', { name }).closest('li')
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

  test('Your Games: a Play door for each of your pilots, Mediate where you mediate', async () => {
    setQueryAnswers({
      'games:listMine': [TENACITY, WASTES],
      'downtime:state': IN_DOWNTIME,
      ...QUIET,
    })
    await renderAs('connected')
    const tenacity = card('Tenacity')
    const play = tenacity.getByRole('link', { name: 'Play Rook in Tenacity' })
    expect(play.getAttribute('href')).toBe('/play/land-rook')
    // One pilot in the Game: its chip, and one door that reads Play.
    expect(play.textContent).toBe('Play')
    expect(tenacity.getByText('Rook')).toBeTruthy()
    expect(tenacity.queryByRole('link', { name: /^Mediate/ })).toBeNull()
    // Presence, not a member count; Downtime as a chip.
    expect(tenacity.queryByText('Members')).toBeNull()
    expect(tenacity.getByText('Downtime')).toBeTruthy()

    const wastes = card('Wastes')
    expect(wastes.getByText('Mediator')).toBeTruthy()
    const mediate = wastes.getByRole('link', { name: 'Mediate Wastes' })
    expect(mediate.getAttribute('href')).toBe('/play/game/land-g2')
    expect(mediate.textContent).toBe('Mediate')
    // `downtime.state` for each Game.
    const asked = queryCalls()
      .filter((c) => c.name === 'downtime:state')
      .map((c) => (c.args as { gameId: string }).gameId)
    expect([...new Set(asked)].sort()).toEqual(['land-g1', 'land-g2'])
  })

  test('a Game between Downtimes shows no Downtime chip; one with none of your pilots says so', async () => {
    setQueryAnswers({
      'games:listMine': [{ ...TENACITY, _id: 'land-g9', name: 'Elsewhere' }],
      'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
      ...QUIET,
    })
    await renderAs('connected')
    const elsewhere = card('Elsewhere')
    expect(elsewhere.queryByText('Downtime')).toBeNull()
    expect(elsewhere.queryByText('Scene')).toBeNull()
    expect(elsewhere.getByText('None of your Pilots is in this Game.')).toBeTruthy()
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
    expect(section('Your Games').getByText(/You're in no Games yet/)).toBeTruthy()
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
    expect(document.querySelector('.su-play-crew-dot[data-present]')).not.toBeNull()
  })

  test('offline, the shelf still lists, and Your Games wait for the connection', async () => {
    setQueryAnswers({})
    await renderAs('disconnected')
    expect(section('Solo').getByRole('link', { name: 'Play Wren solo' })).toBeTruthy()
    expect(
      section('Your Games').getByText('Your Games list once the connection returns.')
    ).toBeTruthy()
    expect(queryCalls()).toHaveLength(0)
  })
})

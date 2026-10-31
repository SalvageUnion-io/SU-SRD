import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The Play hub (`/play/`, ADR-052 §4): + New Game and Join with a link on its
 * band; Your Games, each a contentful Compact opening the Game's page with
 * your role, how many are here, the Downtime state and its channel as chips,
 * its crew as Minis (each pilot and its mech one Mini), and its doors (Mediate
 * where you mediate it, then Play <pilot> for each pilot of yours there); Play solo, each pilot in no
 * Game with its mech or "No Mech". Nothing that builds.
 * Signed out, sign in.
 *
 * Queries are answered by name (`serverMock.ts`): `games.listMine` and
 * `channelBindings.mine`, then `downtime.state`,
 * `entities.listForGame` and `crew.vitals` once per Game. Without a router,
 * so links are anchors.
 */

import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import {
  installServerMocks,
  queryCalls,
  setQueryAnswers,
} from '../../components/__tests__/serverMock'
import { closeRooms, serveReads } from '../../replica/__tests__/fakeRooms'
import type { SyncStatus } from '../../replica/sync'
import { crewPilot } from './crewRows'

// Who each Game's room says is here (`useGamePresence`): nobody, unless a test says.
const presence: { here: ReadonlySet<string> | null } = { here: null }
const serverMocks = await installServerMocks({
  also: { '../../play/useGamePresence': () => ({ useGamePresence: () => presence.here }) },
})

const { PlayLanding } = await import('../PlayLanding')
const { SyncContext } = await import('../../replica/syncContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../replica/units')
const { resetSync } = await import('../../replica/sync')

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

/** No channel bound anywhere, and no crew: what most tests need answered. */
const QUIET = {
  'channelBindings.mine': { personal: null, games: [] },
  'entities.listForGame': {
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    primaryCrawlerId: null,
  },
  'crew.vitals': { viewerId: 'u-me', pilots: [], mechs: [] },
}

beforeAll(async () => {
  await hydrateStores()
  resetSync()
  const store = useUnits.getState()
  await store.adopt('pilot', pilotFixture({ id: 'land-rook', name: 'Rook', gameId: 'land-g1' }))
  // The Mediator of Wastes plays a pilot there too.
  await store.adopt('pilot', pilotFixture({ id: 'land-vane', name: 'Vane', gameId: 'land-g2' }))
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
  const store = useUnits.getState()
  await store.forget('softLink', 'land-link')
  await store.forget('mech', 'land-mech')
  await store.forget('pilot', 'land-rook')
  await store.forget('pilot', 'land-wren')
  await store.forget('pilot', 'land-kes')
  serverMocks.restore()
})

async function renderAs(status: SyncStatus) {
  const state = {
    status,
    canWrite: status === 'live',
    outdated: false,
  }
  await act(async () => {
    render(
      <SyncContext.Provider value={state}>
        <PlayLanding />
      </SyncContext.Provider>
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
  test('signed out, asks you to sign in and asks the server nothing', async () => {
    answerReads({})
    await renderAs('signedOut')
    expect(screen.getByRole('heading', { name: 'Sign in to play' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeTruthy()
    expect(queryCalls()).toHaveLength(0)
  })

  test('Your Games: each a Compact opening its page, your role, and its doors: Mediate, then Play <pilot>', async () => {
    answerReads({
      'games.listMine': [TENACITY, WASTES],
      'downtime.state': IN_DOWNTIME,
      ...QUIET,
    })
    await renderAs('live')
    const tenacity = card('Tenacity')
    // The whole Compact opens the Game's page in Play.
    expect(tenacity.getByRole('link', { name: 'Tenacity' }).getAttribute('href')).toBe(
      '/play/games/land-g1'
    )
    const play = tenacity.getByRole('link', { name: 'Play Rook in Tenacity' })
    expect(play.getAttribute('href')).toBe('/play/pilots/land-rook')
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
    expect(mediate.getAttribute('href')).toBe('/play/games/land-g2/mediate')
    expect(mediate.textContent).toBe('Mediate')
    // A Mediator who also plays reaches their pilot too.
    expect(wastes.getByRole('link', { name: 'Play Vane in Wastes' }).getAttribute('href')).toBe(
      '/play/pilots/land-vane'
    )

    // R56: a Game's name is kept whole: on a phone its doors are the body's
    // first row rather than a cut name (the fit itself: chipFill.test.ts).
    const heading = wastes.getByRole('heading', { name: 'Wastes (Game)' })
    expect(heading.closest('[data-fill-whole]')).not.toBeNull()
    expect(heading.className).toContain('su-entity-compact__title--whole')
  })

  test('a live group session: a chip says so, and your pilot’s door joins it', async () => {
    answerReads({
      'games.listMine': [TENACITY],
      'downtime.state': IN_DOWNTIME,
      'session.state': { live: true, startedAt: 1 },
      ...QUIET,
    })
    await renderAs('live')
    const tenacity = card('Tenacity')
    expect(tenacity.getByText('Session live')).toBeTruthy()
    const join = tenacity.getByRole('link', { name: 'Join the session in Tenacity as Rook' })
    expect(join.getAttribute('href')).toBe('/play/pilots/land-rook')
    expect(join.textContent).toBe('Join as Rook')
  })

  test('a Game between Downtimes shows no Downtime chip; one with none of your pilots has no door', async () => {
    answerReads({
      'games.listMine': [{ ...TENACITY, _id: 'land-g9', name: 'Elsewhere' }],
      'downtime.state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
      ...QUIET,
    })
    await renderAs('live')
    const elsewhere = card('Elsewhere')
    expect(elsewhere.queryByText('Downtime')).toBeNull()
    expect(elsewhere.queryByText('Scene')).toBeNull()
    // Its page is one tap away, and the only link on the Compact.
    expect(elsewhere.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/play/games/land-g9',
    ])
  })

  test('Solo: each shelf pilot with its Mech’s chip or "No Mech", and Play solo', async () => {
    answerReads({ 'games.listMine': [], 'downtime.state': IN_DOWNTIME, ...QUIET })
    await renderAs('live')
    const solo = section('Play solo')
    expect(solo.getByRole('link', { name: 'Play Wren solo' }).getAttribute('href')).toBe(
      '/play/pilots/land-wren'
    )
    const row = (name: string) => {
      const item = solo.getByRole('link', { name: `Play ${name} solo` }).closest('li')
      if (!item) throw new Error(`no solo row for ${name}`)
      return within(item)
    }
    // The pair rule: a pilot not aboard is the pilot, with a MECH chip naming its mech.
    expect(row('Wren').getByText('Scrapper')).toBeTruthy()
    expect(row('Wren').getByText('Mech')).toBeTruthy()
    expect(row('Wren').getByText('HP')).toBeTruthy()
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
    answerReads({ 'games.listMine': [], 'templates.list': [], ...QUIET })
    const assigned: string[] = []
    const assign = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
      assigned.push(String(to))
    })
    try {
      await renderAs('live')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '+ New Game' }))
      })
      expect(screen.getByRole('dialog', { name: 'New Game' })).toBeTruthy()
      await act(async () => {
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Join with a link' }))
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
      expect(assigned).toEqual(['/play/invite/AB12CD34EF56'])
    } finally {
      assign.mockRestore()
    }
  })

  test('a Game’s channel is a chip on its card; there is no Discord section', async () => {
    answerReads({
      'games.listMine': [TENACITY, WASTES],
      'downtime.state': IN_DOWNTIME,
      ...QUIET,
      'channelBindings.mine': {
        personal: null,
        games: [
          {
            gameId: 'land-g1',
            gameName: 'Tenacity',
            mayBind: true,
            binding: { channelId: 'c-1', channelName: 'salvage-run', boundAt: FIXTURE_NOW },
          },
          { gameId: 'land-g2', gameName: 'Wastes', mayBind: false, binding: null },
        ],
      },
    })
    await renderAs('live')
    expect(card('Tenacity').getByText('#salvage-run')).toBeTruthy()
    expect(card('Wastes').queryByText(/^#/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Discord' })).toBeNull()
  })

  test('the crew are Minis with their chips: a boarded pilot is its mech, else the pilot', async () => {
    answerReads({
      'games.listMine': [TENACITY],
      'downtime.state': IN_DOWNTIME,
      ...QUIET,
      'entities.listForGame': {
        pilots: [],
        mechs: [],
        crawlers: [{ _id: 'c1', appId: 'a-c1', body: { id: 'a-c1', name: 'Big Sal' } }],
        softLinks: [],
        primaryCrawlerId: 'c1',
      },
      'crew.vitals': {
        viewerId: 'u-me',
        pilots: [
          {
            _id: 'p1',
            linkId: 'a-p1',
            appId: 'a-p1',
            ownerId: 'u-me',
            name: 'Rook',
            currentHP: 4,
            maxHP: 10,
            currentAP: null,
            maxAP: 5,
            boarded: true,
            mechId: 'a-m1',
          },
          {
            _id: 'p2',
            linkId: 'a-p2',
            appId: 'a-p2',
            ownerId: 'u-2',
            name: 'Vesper',
            currentHP: null,
            maxHP: 8,
            currentAP: null,
            maxAP: 4,
            boarded: false,
            mechId: 'a-m2',
          },
        ],
        mechs: [
          {
            _id: 'm1',
            linkId: 'a-m1',
            appId: 'a-m1',
            ownerId: 'u-me',
            name: 'Spectrum',
            currentSP: 6,
            maxSP: 9,
            currentEP: null,
            maxEP: 5,
            currentHeat: 2,
            maxHeat: 9,
          },
          {
            _id: 'm2',
            linkId: 'a-m2',
            appId: 'a-m2',
            ownerId: 'u-2',
            name: 'Thresher',
            currentSP: null,
            maxSP: 12,
            currentEP: null,
            maxEP: 6,
            currentHeat: null,
            maxHeat: 10,
          },
        ],
      },
    })
    await renderAs('live')
    const tenacity = screen.getByRole('heading', { name: 'Tenacity (Game)' }).closest('li')
    const minis = [...(tenacity?.querySelectorAll('[data-entity-linked] > *') ?? [])].map(
      (mini) => mini.textContent ?? ''
    )
    // The crawler first; Rook is aboard, so the Mini is Spectrum with a PILOT
    // chip and its stats; Vesper is on foot, so the Mini is Vesper with a MECH
    // chip. Never both halves of a pair.
    expect(minis).toHaveLength(3)
    expect(minis[0]).toContain('Big Sal')
    expect(minis[1]).toContain('Spectrum')
    expect(minis[1]).toContain('Rook')
    expect(minis[1]).toContain('SP')
    expect(minis[2]).toContain('Vesper')
    expect(minis[2]).toContain('Thresher')
    expect(minis[2]).toContain('HP')
    // Each opens its sheet in Build.
    const hrefs = [...(tenacity?.querySelectorAll('[data-entity-linked] a') ?? [])].map((a) =>
      a.getAttribute('href')
    )
    expect(hrefs).toContain('/mechs/a-m1')
    expect(hrefs).toContain('/pilots/a-p2')
  })

  test('Your Games: how many are here now, from the Game’s room', async () => {
    answerReads({
      'games.listMine': [TENACITY],
      'downtime.state': IN_DOWNTIME,
      ...QUIET,
      'crew.vitals': {
        viewerId: 'u-me',
        pilots: [
          crewPilot('p1', 'Mags', 'u-mags'),
          crewPilot('p2', 'Rook', 'u-rook'),
          crewPilot('p3', 'Wren', 'u-wren'),
        ],
        mechs: [],
      },
    })
    presence.here = new Set(['u-mags', 'u-rook', 'u-mediator'])
    try {
      await renderAs('live')
      expect(card('Tenacity').getByText('2 here')).toBeTruthy()
    } finally {
      presence.here = null
    }
  })

  test('offline, the shelf still lists, and Your Games wait for the connection', async () => {
    answerReads({})
    await renderAs('offline')
    expect(section('Play solo').getByRole('link', { name: 'Play Wren solo' })).toBeTruthy()
    expect(
      section('Your Games').getByText('Your Games list once the connection returns.')
    ).toBeTruthy()
    // Starting or joining a Game waits for the connection too.
    expect(screen.queryByRole('button', { name: '+ New Game' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Join with a link' })).toBeNull()
    expect(queryCalls()).toHaveLength(0)
  })
})

/** Answer the Games reads, and serve the Game room's records from the table reads among them. */
function answerReads(answers: Record<string, unknown>): void {
  setQueryAnswers(answers)
  serveReads('land-g1', answers)
}

afterEach(closeRooms)

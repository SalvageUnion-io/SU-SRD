import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The Games hub (`/games/`, ADR-066): + New Game and Join with a link on its
 * band; Your Games, each a contentful Compact opening the Game's page with
 * your role, how many are here, the Downtime state and its channel as chips,
 * its crew as Minis (each pilot and its mech one Mini), and its doors (Mediate
 * where you mediate it, then Play <pilot> for each pilot of yours there). No solo list: a pilot in
 * no Game plays from its own page. Nothing that builds.
 * Signed out, sign in.
 *
 * Queries are answered by name (`serverMock.ts`): `games.listMine` and
 * `channelBindings.mine`, then `downtime.state`,
 * `games.listing` and `crew.vitals` once per Game. Without a router,
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
  'games.listing': {
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
  // Rook goes by a callsign: a door says it, a list says it first.
  await store.adopt(
    'pilot',
    pilotFixture({ id: 'land-rook', name: 'Rook', callsign: 'CASTLE', gameId: 'land-g1' })
  )
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
  test('signed out, it is Play’s front door: the pitch with its sign-in, the Starter Set crew as one Ledger, and nothing asked of the server', async () => {
    answerReads({})
    await renderAs('signedOut')
    expect(screen.getByText('Run your crew at the table, on every screen at once.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeTruthy()
    // What happens at the table, then the crew: one framed list, a line a build.
    expect(screen.getByRole('heading', { name: 'At the table' })).toBeTruthy()
    const crew = within(screen.getByRole('table', { name: 'Pilots & their Mechs' }))
    // A line a Pilot, their Mech on it.
    expect(crew.getAllByRole('row').length).toBeGreaterThan(6)
    const sheets = crew.getAllByRole('link').map((link) => link.getAttribute('href') ?? '')
    expect(sheets.filter((href) => href.startsWith('/starter/pilot/')).length).toBe(6)
    expect(queryCalls()).toHaveLength(0)
  })

  test('Your Games: each a Compact opening its page, your role, and its doors: Mediate, then the seat’s', async () => {
    answerReads({
      'games.listMine': [TENACITY, WASTES],
      'downtime.state': IN_DOWNTIME,
      ...QUIET,
    })
    await renderAs('live')
    const tenacity = card('Tenacity')
    // The whole Compact opens the Game's page in Play.
    expect(tenacity.getByRole('link', { name: 'Tenacity' }).getAttribute('href')).toBe(
      '/games/land-g1'
    )
    // The seat's door has the door's one name (glossary §9, r3 H3).
    const play = tenacity.getByRole('link', { name: 'Open table as CASTLE in Tenacity' })
    expect(play.getAttribute('href')).toBe('/pilots/land-rook/play')
    expect(play.textContent).toBe('Open table')
    expect(tenacity.getByText('Player')).toBeTruthy()
    expect(tenacity.queryByRole('link', { name: /^Mediate/ })).toBeNull()
    // Presence, not a member count; Downtime as a chip with its step.
    expect(tenacity.queryByText('Members')).toBeNull()
    expect(tenacity.getByText('Downtime')).toBeTruthy()
    expect(tenacity.getByText('Step 3')).toBeTruthy()

    const wastes = card('Wastes')
    expect(wastes.getByText('Mediator')).toBeTruthy()
    const mediate = wastes.getByRole('link', { name: 'Mediate Wastes' })
    expect(mediate.getAttribute('href')).toBe('/games/land-g2/mediate')
    expect(mediate.textContent).toBe('Mediate')
    // A Mediator who also plays reaches their pilot too.
    expect(
      wastes.getByRole('link', { name: 'Open table as Vane in Wastes' }).getAttribute('href')
    ).toBe('/pilots/land-vane/play')

    // R56: a Game's name is kept whole: on a phone its doors are the body's
    // first row rather than a cut name (the fit itself: chipFill.test.ts).
    const heading = wastes.getByRole('heading', { name: 'Wastes (Game)' })
    expect(heading.closest('[data-fill-whole]')).not.toBeNull()
    expect(heading.className).toContain('su-entity-compact__title--whole')
  })

  // MD-03: "Join with a link" and "Mediator's Kit" in Play's sub-nav went to
  // ids no element had, signed in or out.
  test('every in-page link of Play’s sub-nav has its target, signed out and signed in', async () => {
    const { areaAnchors } = await import('../../components/unionBar/areaNav.model')
    const anchors = areaAnchors('play')
    expect(anchors).toEqual(['join', 'mediators-kit'])
    answerReads({})
    await renderAs('signedOut')
    for (const id of anchors) expect(document.getElementById(id)).not.toBeNull()
    cleanup()
    answerReads({ 'games.listMine': [], 'downtime.state': IN_DOWNTIME, ...QUIET })
    await renderAs('live')
    for (const id of anchors) expect(document.getElementById(id)).not.toBeNull()
  })

  test('arriving on #join opens Join a Game', async () => {
    window.location.hash = '#join'
    try {
      answerReads({ 'games.listMine': [], 'downtime.state': IN_DOWNTIME, ...QUIET })
      await renderAs('live')
      expect(screen.getByRole('dialog', { name: 'Join a Game' })).toBeTruthy()
    } finally {
      window.location.hash = ''
    }
  })

  // MD-03 again: a router link sets the hash with no `hashchange`, and a
  // second press changes nothing, so the dialog never opened from the sub-nav.
  test('pressing the sub-nav’s Join with a link opens Join a Game, with no hash change heard', async () => {
    answerReads({ 'games.listMine': [], 'downtime.state': IN_DOWNTIME, ...QUIET })
    await renderAs('live')
    expect(screen.queryByRole('dialog', { name: 'Join a Game' })).toBeNull()
    const nav = document.createElement('a')
    nav.href = '/games/#join'
    nav.addEventListener('click', (event) => event.preventDefault())
    document.body.append(nav)
    try {
      await act(async () => {
        fireEvent.click(nav)
      })
      expect(screen.getByRole('dialog', { name: 'Join a Game' })).toBeTruthy()
    } finally {
      nav.remove()
    }
  })

  // LG-01: the replica holds every crewmate's pilot too (for Play's Crew
  // pane); a Game's doors are only for the pilots assigned to you.
  test('a crewmate’s pilot in the Game is no door of yours', async () => {
    const { serve, gameScope, drop } = await import('../../replica/replica')
    act(() =>
      serve(
        gameScope('land-g1'),
        [],
        [
          {
            table: 'pilot',
            row: pilotFixture({ id: 'land-nell', name: 'Nell Vance', gameId: 'land-g1' }),
            version: 1,
            owner: 'u-crewmate',
          },
        ]
      )
    )
    answerReads({ 'games.listMine': [TENACITY], 'downtime.state': IN_DOWNTIME, ...QUIET })
    await renderAs('live')
    const tenacity = card('Tenacity')
    expect(tenacity.getByRole('link', { name: 'Open table as CASTLE in Tenacity' })).toBeTruthy()
    expect(tenacity.queryByRole('link', { name: /Nell Vance/ })).toBeNull()
    act(() => drop('pilot', 'land-nell'))
  })

  test('a live group session: a chip says so, and your pilot’s door reads Join session', async () => {
    answerReads({
      'games.listMine': [TENACITY],
      'downtime.state': IN_DOWNTIME,
      'session.state': { live: true, startedAt: 1 },
      ...QUIET,
    })
    await renderAs('live')
    const tenacity = card('Tenacity')
    expect(tenacity.getByText('Session live')).toBeTruthy()
    // Live, the same door reads Join session, and still opens the seat (r3 H3).
    const play = tenacity.getByRole('link', { name: 'Join session as CASTLE in Tenacity' })
    expect(play.getAttribute('href')).toBe('/pilots/land-rook/play')
    expect(play.textContent).toBe('Join session')
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
      '/games/land-g9',
    ])
  })

  test('in no Game: Your Pilots still has a Play door a pilot, and the empty state says Play works solo', async () => {
    answerReads({ 'games.listMine': [], 'downtime.state': IN_DOWNTIME, ...QUIET })
    await renderAs('live')
    expect(
      section('Your Games').getByText(
        'You’re in no Games yet. Start one with + New Game, or join one with its invite link. Play works solo too: your Pilots are below.'
      )
    ).toBeTruthy()
    const pilots = section('Your Pilots')
    // Every pilot of yours, in a Game or not, each door naming who it plays.
    const wren = pilots.getByRole('link', { name: 'Open table as Wren' })
    expect(wren.getAttribute('href')).toBe('/pilots/land-wren/play')
    expect(wren.textContent).toBe('Open table')
    expect(pilots.getByRole('link', { name: 'Open table as Kestrel' })).toBeTruthy()
    // Callsign first, then the name; the door takes the callsign.
    const rook = pilots.getByRole('link', { name: 'CASTLE · Rook' }).closest('tr') as HTMLElement
    expect(
      within(rook).getByRole('link', { name: 'Open table as CASTLE · Rook' }).textContent
    ).toBe('Open table')
    // The mech a pilot flies rides its line.
    const row = pilots.getByRole('link', { name: 'Wren' }).closest('tr') as HTMLElement
    expect(within(row).getByRole('link', { name: 'Scrapper' })).toBeTruthy()
  })

  test('Your Pilots, bare: it says Play works solo and offers the way to build one', async () => {
    const store = useUnits.getState()
    const held = store.list('pilot')
    await act(async () => {
      for (const pilot of held) await store.forget('pilot', pilot.id)
    })
    try {
      answerReads({ 'games.listMine': [], 'downtime.state': IN_DOWNTIME, ...QUIET })
      await renderAs('live')
      const pilots = section('Your Pilots')
      expect(
        pilots.getByText(
          'No Pilots yet. Play works solo: build a Pilot, or copy one from the Starter Set, and play it from here with no Game.'
        )
      ).toBeTruthy()
      expect(pilots.getByRole('link', { name: '+ New Pilot' }).getAttribute('href')).toBe(
        '/pilots/new'
      )
    } finally {
      await act(async () => {
        for (const pilot of held) await store.adopt('pilot', pilot)
      })
    }
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
      expect(assigned).toEqual(['/games/invite/AB12CD34EF56'])
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
      'games.listing': {
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
    // The crawler first; Rook is aboard, so the Mini is the mech's (its stats)
    // still named Rook, with a MECH chip for Spectrum; Vesper is on foot, so the
    // Mini is Vesper's with a MECH chip. Never both halves of a pair.
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
    // A pair opens its pilot's sheet, aboard or on foot.
    expect(hrefs).toContain('/pilots/a-p1')
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

  test('offline, Your Games wait for the connection', async () => {
    answerReads({})
    await renderAs('offline')
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

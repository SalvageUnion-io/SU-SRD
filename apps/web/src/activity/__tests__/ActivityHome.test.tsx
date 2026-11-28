import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { act, render, screen, within } from '@testing-library/react'

/**
 * The Activity's home and a Game in it (`../ActivityHome.tsx`): your Games as
 * the hub's own Game lines with their doors, your pilots with no "+ New
 * Pilot", and "Manage on the web" on the site; a Game you are not in says so.
 * Without a router, so links are anchors.
 */

import { pilotFixture } from '../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import { closeRooms, serveReads } from '../../replica/__tests__/fakeRooms'
import type { SyncStatus } from '../../replica/sync'

const binds: unknown[] = []
const serverMocks = await installServerMocks({
  router: true,
  call: (name, args) => {
    if (name !== 'channelBindings.bindHere') return undefined
    binds.push(args)
    return { ok: true }
  },
  also: { '../../play/useGamePresence': () => ({ useGamePresence: () => null }) },
})

const { ActivityHome } = await import('../ActivityHome')
const { SyncContext } = await import('../../replica/syncContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../replica/units')
const { resetSync } = await import('../../replica/sync')
const { SITE_URL } = await import('../../lib/constants')
const { activityStore } = await import('../activityStore')

const GAME = {
  templateOrigin: undefined,
  organizer: false,
  tableRunner: false,
  _id: 'act-g1',
  name: 'Tenacity',
  mediator: false,
  memberCount: 3,
  pilotCount: 1,
  mechCount: 0,
  crawlerName: null,
}

const QUIET = {
  'channelBindings.mine': { personal: null, games: [] },
  'games.listing': { pilots: [], mechs: [], crawlers: [], softLinks: [], primaryCrawlerId: null },
  'crew.vitals': { viewerId: 'u-me', pilots: [], mechs: [] },
}

function answerReads(answers: Record<string, unknown>): void {
  setQueryAnswers(answers)
  serveReads('act-g1', answers)
}

beforeAll(async () => {
  await hydrateStores()
  resetSync()
  await useUnits
    .getState()
    .adopt('pilot', pilotFixture({ id: 'act-rook', name: 'Rook', gameId: 'act-g1' }))
})

afterEach(() => {
  closeRooms()
  act(() => activityStore.stop())
})

afterAll(async () => {
  await useUnits.getState().forget('pilot', 'act-rook')
  serverMocks.restore()
})

async function renderHome(status: SyncStatus, only?: string) {
  await act(async () => {
    render(
      <SyncContext.Provider value={{ status, canWrite: status === 'live', outdated: false }}>
        <ActivityHome {...(only === undefined ? {} : { only })} />
      </SyncContext.Provider>
    )
  })
}

describe('the Activity home', () => {
  test('waits for the session, never offers a sign-in', async () => {
    answerReads({})
    await renderHome('syncing')
    expect(screen.queryByRole('heading', { name: 'Your Games' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign in with Discord' })).toBeNull()
  })

  test('your Games with their doors, your pilots, nothing that makes one, management on the web', async () => {
    answerReads({ 'games.listMine': [GAME], 'downtime.state': null, ...QUIET })
    await renderHome('live')
    expect(screen.getByRole('heading', { name: 'Your Games' })).toBeTruthy()
    const game = screen.getByRole('heading', { name: 'Tenacity (Game)' }).closest('li')
    if (game === null) throw new Error('no Game line')
    expect(
      within(game)
        .getByRole('link', { name: /^Open table as/ })
        .getAttribute('href')
    ).toBe('/pilots/act-rook/play')
    expect(screen.queryByRole('link', { name: '+ New Pilot' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Manage on the web' }).getAttribute('href')).toBe(
      `${SITE_URL}/games/`
    )
  })

  test('a Game: its line alone, managed on its own page on the web', async () => {
    answerReads({ 'games.listMine': [GAME], 'downtime.state': null, ...QUIET })
    await renderHome('live', 'act-g1')
    expect(screen.getByRole('heading', { name: 'This Game' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tenacity (Game)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Manage on the web' }).getAttribute('href')).toBe(
      `${SITE_URL}/games/act-g1`
    )
  })

  test('a Game you are not in says so', async () => {
    answerReads({ 'games.listMine': [GAME], 'downtime.state': null, ...QUIET })
    await renderHome('live', 'act-other')
    expect(screen.getByText('You are not in this Game.')).toBeTruthy()
  })

  test('no Games: where to make one', async () => {
    answerReads({ 'games.listMine': [], ...QUIET })
    await renderHome('live')
    expect(
      screen.getByText('You are in no Game yet. Make one, or join with an invite, on the web.')
    ).toBeTruthy()
  })

  describe('launched in a channel', () => {
    const me = { id: '1', name: 'Rae', avatarUrl: 'a' }
    function launchedIn(channelId: string) {
      act(() =>
        activityStore.start({
          me,
          people: [me],
          layout: 'focused',
          channelId,
          openOutside: () => {},
        })
      )
    }

    test('the Game bound there opens at once', async () => {
      launchedIn('100')
      answerReads({
        'channelBindings.launch': {
          game: { gameId: 'act-g1', gameName: 'Tenacity' },
          bindable: [],
        },
        'games.listMine': [GAME],
        'downtime.state': null,
        ...QUIET,
      })
      const before = serverMocks.navigations.length
      await renderHome('live')
      expect(serverMocks.navigations.slice(before)).toEqual([
        { to: '/games/$gameId', params: { gameId: 'act-g1' } },
      ])
      expect(screen.queryByRole('heading', { name: 'Here' })).toBeNull()
    })

    test('none bound: a Mediator runs one of theirs here with one tap', async () => {
      launchedIn('200')
      answerReads({
        'channelBindings.launch': {
          game: null,
          bindable: [{ gameId: 'act-g1', gameName: 'Tenacity' }],
        },
        'games.listMine': [GAME],
        'downtime.state': null,
        ...QUIET,
      })
      await renderHome('live')
      expect(screen.getByRole('heading', { name: 'Here' })).toBeTruthy()
      const before = serverMocks.navigations.length
      await act(async () => {
        screen.getByRole('button', { name: 'Run Tenacity here' }).click()
      })
      expect(binds.at(-1)).toEqual({ channelId: '200', gameId: 'act-g1' })
      expect(serverMocks.navigations.slice(before)).toEqual([
        { to: '/games/$gameId', params: { gameId: 'act-g1' } },
      ])
    })

    test('none bound and none to run: ask the Mediator', async () => {
      launchedIn('300')
      answerReads({
        'channelBindings.launch': { game: null, bindable: [] },
        'games.listMine': [],
        ...QUIET,
      })
      await renderHome('live')
      expect(
        screen.getByText(
          'No Game is played here yet. Ask your Mediator to run one here, or play solo.'
        )
      ).toBeTruthy()
    })
  })
})

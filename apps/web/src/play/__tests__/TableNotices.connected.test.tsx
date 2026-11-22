import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * `TableNotices` — what a member's Games tell them on every screen of the app
 * (play.md §19): the pinned Stop Sign, proposal, alert and session notices,
 * and a toast for every other member's act. The Games reads are answered by
 * name (`serverMock.ts`); the Game's room serves the rest (`fakeRooms.ts`).
 */

import type { QueryAnswers } from '../../components/__tests__/serverMock'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import { answerActs, closeRooms, openRooms, serveReads } from '../../replica/__tests__/fakeRooms'

const mutations: { name: string; args: unknown }[] = []
const toasts: { text: string; id: unknown }[] = []

const serverMocks = await installServerMocks({
  call: (name, args) => {
    mutations.push({ name, args })
  },
})

const { TableNotices } = await import('../TableNotices')
const { SyncContext } = await import('../../replica/syncContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const components = await import('../../components/index')

beforeAll(hydrateStores)

beforeEach(() => {
  mutations.length = 0
  toasts.length = 0
  openRooms('g1')
  answerActs(({ name, args }) => {
    mutations.push({ name, args })
  })
})

afterEach(() => {
  closeRooms()
  document.title = ''
})

afterAll(() => {
  serverMocks.restore()
  mock.restore()
})

const GAME = { _id: 'g1', name: 'Tenacity', mediator: false, organizer: false, tableRunner: false }

function answers(over: QueryAnswers = {}): QueryAnswers {
  return {
    'account.me': { _id: 'u1', displayName: 'Ash' },
    'games.listMine': [GAME],
    'safety.stopSign': { stop: null, mayLift: false },
    'session.state': { live: false, startedAt: null },
    'ops.pending': [],
    'changeLog.events': [],
    'scenes.current': { conditions: [], hours: 0 },
    ...over,
  }
}

function serveAll(all: QueryAnswers): void {
  setQueryAnswers(all)
  serveReads('g1', all)
}

async function renderNotices(over: QueryAnswers = {}, pathname = '/pilots/p1'): Promise<void> {
  serveAll(answers(over))
  const connected = { status: 'live' as const, canWrite: true, outdated: false }
  await act(async () => {
    render(
      <SyncContext.Provider value={connected}>
        <TableNotices pathname={pathname} />
      </SyncContext.Provider>
    )
  })
}

const notice = (kind: string) => document.querySelector(`[data-table-notice="${kind}"]`)

describe('the pinned notices', () => {
  test('with nothing to say, it takes no room', async () => {
    await renderNotices()
    expect(screen.getByRole('region', { name: 'Your Games' }).childElementCount).toBe(0)
  })

  test('the Stop Sign pins on a sheet too, names the tab, and whoever may lift it resumes', async () => {
    document.title = 'Bonesaw · Training Bay'
    await renderNotices({ 'safety.stopSign': { stop: { shownAt: 1, mine: true }, mayLift: true } })
    expect(screen.getByText('Stop Sign · Tenacity: the table is asked to pause')).toBeTruthy()
    expect(document.title).toBe('Paused · Bonesaw · Training Bay')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resume play' }))
    })
    expect(mutations).toEqual([{ name: 'safety.liftStop', args: {} }])
  })

  test('someone else’s Stop Sign offers no Resume', async () => {
    await renderNotices({
      'safety.stopSign': { stop: { shownAt: 1, mine: false }, mayLift: false },
    })
    expect(notice('stop')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Resume play' })).toBeNull()
  })

  test('a proposal is answered in the banner: Accept and Decline', async () => {
    const proposal = {
      _id: 'p-1',
      entityId: 'bonesaw',
      entityType: 'pilot',
      targetName: 'Static',
      field: 'currentAP',
      after: 2,
      reason: 'Drained by the hack',
      ts: 5,
    }
    await renderNotices({ 'ops.pending': [proposal] })
    expect(notice('proposal')?.textContent).toContain(
      'Mediator proposes Static AP → 2 · “Drained by the hack”'
    )
    // With the sheet's value from the room, the notice says from and to (r2 C7).
    await act(async () => {
      serveAll(answers({ 'ops.pending': [{ ...proposal, _id: 'p-0', current: 5 }] }))
    })
    expect(notice('proposal')?.textContent).toContain('Mediator proposes Static AP 5 → 2')
    await act(async () => {
      serveAll(answers({ 'ops.pending': [proposal] }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Accept: Static AP → 2' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Decline: Static AP → 2' }))
    })
    expect(mutations).toEqual([
      { name: 'ops.accept', args: { opId: 'p-1' } },
      { name: 'ops.decline', args: { opId: 'p-1' } },
    ])
  })

  test('the Mediator’s alert pins until dismissed', async () => {
    const alert = {
      _id: 'a-1',
      ts: Date.now() - 1000,
      kind: 'alert',
      text: 'Mediator · Raiders close in. Static is up next.',
      actorId: 'gm',
    }
    await renderNotices({ 'changeLog.events': [alert] })
    expect(notice('alert')?.textContent).toContain('Raiders close in. Static is up next.')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss/ }))
    })
    expect(notice('alert')).toBeNull()
  })

  test('a hand over pins "You now mediate" for the new Mediator until dismissed (r2 B3)', async () => {
    const made = {
      _id: 'r-1',
      ts: Date.now() - 1000,
      kind: 'role',
      text: 'Ash now mediates this Game',
      actorId: 'org',
      about: 'u1',
    }
    await renderNotices({
      'games.listMine': [{ ...GAME, mediator: true, tableRunner: true }],
      'changeLog.events': [made],
    })
    expect(notice('role')?.textContent).toContain('You now mediate · Tenacity')
    expect(notice('role')?.textContent).toContain('Notes its last Mediator wrote stay theirs.')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss/ }))
    })
    expect(notice('role')).toBeNull()
  })

  // LG2-11: the Mediator's door read "Open table" here and "Mediate" on their Game's row.
  test('a live session’s door for the Mediator is Mediate, as everywhere', async () => {
    await renderNotices({
      'games.listMine': [{ ...GAME, mediator: true, tableRunner: true }],
      'session.state': { live: true, startedAt: 7 },
    })
    const door = screen.getByRole('link', { name: 'Mediate' }) as HTMLAnchorElement
    expect(door.getAttribute('href')).toBe('/games/g1/mediate')
    expect(screen.queryByRole('link', { name: 'Open table' })).toBeNull()
  })

  test('a live session offers its door everywhere but on a Play screen, and says when it ends', async () => {
    // On one of the Game's own pages: "Session ended" is said there alone (r2 C5).
    await renderNotices({ 'session.state': { live: true, startedAt: 7 } }, '/games/g1/prep')
    expect(notice('session')?.textContent).toContain('Session live · Tenacity')
    const door = screen.getByRole('link', { name: 'Join session' }) as HTMLAnchorElement
    expect(door.getAttribute('href')).toBe('/games/g1')
    await act(async () => {
      serveAll(
        answers({
          'session.state': { live: false, startedAt: null },
          'changeLog.events': [
            {
              _id: 'e-end',
              ts: Date.now(),
              kind: 'session',
              text: 'Ash ended the group session',
              actorId: 'gm',
              session: 'end',
            },
          ],
        })
      )
    })
    expect(notice('session')).toBeNull()
    expect(notice('session-ended')?.textContent).toContain('Session ended · Tenacity')
  })

  test('Session ended is not said to whoever ended it, nor on another Game’s pages (r2 C5)', async () => {
    const ended = (actorId: string) => ({
      'changeLog.events': [
        {
          _id: 'e-end',
          ts: Date.now(),
          kind: 'session',
          text: 'Ash ended the group session',
          actorId,
          session: 'end',
        },
      ],
    })
    await renderNotices(ended('u1'), '/games/g1')
    expect(notice('session-ended')).toBeNull()
    cleanup()
    await renderNotices(ended('gm'), '/games/g2')
    expect(notice('session-ended')).toBeNull()
    cleanup()
    await renderNotices(ended('gm'), '/build/encounters/e1')
    expect(notice('session-ended')).toBeNull()
  })

  test('Your turn pins on every screen while the Mediator has my pilot up (r2 E1)', async () => {
    const { useUnits } = await import('../../replica/units')
    const { pilotFixture } = await import('../../components/__tests__/fixtures')
    const { drop } = await import('../../replica/replica')
    await act(async () => {
      await useUnits
        .getState()
        .adopt('pilot', pilotFixture({ id: 'tn-up', gameId: 'g1', callsign: 'Pickle' }))
    })
    await renderNotices({ 'scenes.current': { conditions: [], hours: 0, upNow: 'tn-up' } })
    expect(notice('turn')?.textContent).toContain('Your turn · Pickle')
    // Somebody else's turn pins nothing here.
    await act(async () => {
      serveAll(answers({ 'scenes.current': { conditions: [], hours: 0, upNow: 'other' } }))
    })
    expect(notice('turn')).toBeNull()
    act(() => drop('pilot', 'tn-up'))
  })

  // LG-02: the replica holds every crewmate's pilot too; the door is for the
  // viewer's own pilot, never the one pilot of somebody else's it finds.
  test('the session’s door opens the viewer’s own pilot, never a crewmate’s', async () => {
    const { serve, gameScope, drop } = await import('../../replica/replica')
    const { pilotFixture } = await import('../../components/__tests__/fixtures')
    const theirs = {
      table: 'pilot' as const,
      row: pilotFixture({ id: 'tn-theirs', gameId: 'g1' }),
      version: 1,
      owner: 'u-crewmate',
    }
    act(() => serve(gameScope('g1'), [], [theirs]))
    await renderNotices({ 'session.state': { live: true, startedAt: 7 } })
    const door = () => screen.getByRole('link', { name: 'Join session' }).getAttribute('href')
    // Nobody's pilot but a crewmate's: the Game's page, where one is assigned.
    expect(door()).toBe('/games/g1')
    // Mine, as this browser holds a unit of its own account.
    const { useUnits } = await import('../../replica/units')
    await act(async () => {
      await useUnits.getState().adopt('pilot', pilotFixture({ id: 'tn-mine', gameId: 'g1' }))
    })
    expect(door()).toBe('/pilots/tn-mine/play')
    act(() => {
      drop('pilot', 'tn-theirs')
      drop('pilot', 'tn-mine')
    })
  })

  test('a Game the viewer was removed from says so, until dismissed (r2 B4)', async () => {
    serveAll(answers())
    const connected = { status: 'live' as const, canWrite: true, outdated: false }
    const tree = () => (
      <SyncContext.Provider value={connected}>
        <TableNotices pathname="/pilots/p1" />
      </SyncContext.Provider>
    )
    const view = render(tree())
    expect(notice('removed')).toBeNull()
    // The Games read answers again without the Game: its Organiser removed them.
    await act(async () => {
      serveAll(answers({ 'games.listMine': [] }))
      view.rerender(tree())
    })
    expect(notice('removed')?.textContent).toContain('You are no longer in Tenacity')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss: You are no longer in/ }))
    })
    expect(notice('removed')).toBeNull()
  })

  test('several notices share one strip: the newest, how many more, and Dismiss all (r6 A1)', async () => {
    const now = Date.now()
    const alert = {
      _id: 'a-stack',
      ts: now - 3000,
      kind: 'alert',
      text: 'Mediator · Dust on the ridge',
      actorId: 'gm',
    }
    const made = {
      _id: 'r-stack',
      ts: now - 2000,
      kind: 'role',
      text: 'Ash now mediates this Game',
      actorId: 'org',
      about: 'u1',
    }
    await renderNotices(
      {
        'games.listMine': [{ ...GAME, mediator: true, tableRunner: true }],
        'session.state': { live: true, startedAt: now - 5000 },
        'changeLog.events': [made, alert],
      },
      '/games/g1/prep'
    )
    const strips = () => [...document.querySelectorAll('[data-table-notice]')]
    // One strip, the newest; the Mediator's alert waits behind the count too.
    expect(strips().map((el) => el.getAttribute('data-table-notice'))).toEqual(['role'])
    const more = screen.getByRole('button', { name: 'Show 2 more notices' })
    expect(more.textContent).toBe('2 more')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    await act(async () => {
      fireEvent.click(more)
    })
    expect(strips().map((el) => el.getAttribute('data-table-notice'))).toEqual([
      'role',
      'alert',
      'session',
    ])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss all' }))
    })
    expect(strips()).toEqual([])
    expect(screen.getByRole('region', { name: 'Your Games' }).childElementCount).toBe(0)
  })

  test('a proposal leads the strip, and dismissing the rest leaves it waiting (r6 A1)', async () => {
    const proposal = {
      _id: 'p-1',
      entityId: 'bonesaw',
      entityType: 'pilot',
      targetName: 'Static',
      field: 'currentAP',
      after: 2,
      reason: null,
      ts: 5,
    }
    const alert = {
      _id: 'a-2',
      ts: Date.now() - 1000,
      kind: 'alert',
      text: 'Mediator · Pickle, you are up.',
      actorId: 'gm',
    }
    await renderNotices({ 'ops.pending': [proposal], 'changeLog.events': [alert] })
    const strips = () =>
      [...document.querySelectorAll('[data-table-notice]')].map((el) =>
        el.getAttribute('data-table-notice')
      )
    expect(strips()).toEqual(['proposal'])
    expect(screen.getByRole('button', { name: 'Accept: Static AP → 2' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show 1 more notices' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Dismiss: From the Mediator/ }))
    })
    expect(strips()).toEqual(['proposal'])
    expect(screen.queryByRole('button', { name: /^Dismiss/ })).toBeNull()
  })

  test('the player who is up ends their turn from the strip, whatever leads it (r4 B1, r6 A13)', async () => {
    const { useUnits } = await import('../../replica/units')
    const { pilotFixture } = await import('../../components/__tests__/fixtures')
    const { drop } = await import('../../replica/replica')
    await act(async () => {
      await useUnits
        .getState()
        .adopt('pilot', pilotFixture({ id: 'tn-both', gameId: 'g1', callsign: 'Razor' }))
    })
    const proposal = {
      _id: 'p-both',
      entityId: 'tn-both',
      entityType: 'pilot',
      targetName: 'Razor',
      field: 'currentHP',
      after: 4,
      reason: null,
      ts: 5,
    }
    await renderNotices({
      'ops.pending': [proposal],
      'scenes.current': { conditions: [], hours: 0, upNow: 'tn-both' },
    })
    const strips = [...document.querySelectorAll('[data-table-notice]')]
    // The proposal leads; its strip carries End my turn, one control, never two.
    expect(strips.map((el) => el.getAttribute('data-table-notice'))).toEqual(['proposal'])
    expect(strips[0]?.id).toBe('su-your-turn')
    expect(screen.getAllByRole('button', { name: 'End my turn' })).toHaveLength(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'End my turn' }))
    })
    expect(mutations).toEqual([{ name: 'scenes.endTurn', args: {} }])
    act(() => drop('pilot', 'tn-both'))
  })

  test('every other seat reads who is up on the Game’s pages (r6 A2)', async () => {
    const { serve, gameScope, drop } = await import('../../replica/replica')
    const { pilotFixture } = await import('../../components/__tests__/fixtures')
    const theirs = {
      table: 'pilot' as const,
      row: pilotFixture({ id: 'tn-razor', gameId: 'g1', callsign: 'Razor', name: 'Razor' }),
      version: 1,
      owner: 'u-crewmate',
    }
    act(() => serve(gameScope('g1'), [], [theirs]))
    await renderNotices(
      { 'scenes.current': { conditions: [], hours: 0, upNow: 'tn-razor' } },
      '/games/g1'
    )
    expect(notice('turn')?.textContent).toContain('Razor is up')
    expect(screen.queryByRole('button', { name: 'End my turn' })).toBeNull()
    act(() => drop('pilot', 'tn-razor'))
  })

  test('off the Game’s pages Your turn opens its table; a skip link leads to it, and ending it moves focus on (r5 A4, A17)', async () => {
    const { useUnits } = await import('../../replica/units')
    const { pilotFixture } = await import('../../components/__tests__/fixtures')
    const { drop } = await import('../../replica/replica')
    await act(async () => {
      await useUnits
        .getState()
        .adopt('pilot', pilotFixture({ id: 'tn-door', gameId: 'g1', callsign: 'Razor' }))
    })
    const content = document.createElement('div')
    content.id = 'main-content'
    content.tabIndex = -1
    document.body.append(content)
    await renderNotices(
      { 'scenes.current': { conditions: [], hours: 0, upNow: 'tn-door' } },
      '/games'
    )
    const door = screen.getByRole('link', { name: 'Open table' })
    expect(door.getAttribute('href')).toContain('tn-door')
    const region = screen.getByRole('region', { name: 'Your Games' })
    const skip = region.querySelector('a')
    expect(skip?.textContent).toBe('Skip to your turn')
    await act(async () => {
      fireEvent.click(skip as Element)
    })
    expect(document.activeElement?.textContent).toBe('End my turn')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'End my turn' }))
    })
    expect(document.activeElement).toBe(content)
    content.remove()
    act(() => drop('pilot', 'tn-door'))
  })

  test('"You now mediate" carries the door to the Mediate screen (r3 A4)', async () => {
    const made = {
      _id: 'r-2',
      ts: Date.now() - 1000,
      kind: 'role',
      text: 'Ash now mediates this Game',
      actorId: 'org',
      about: 'u1',
    }
    await renderNotices({
      'games.listMine': [{ ...GAME, mediator: true, tableRunner: true }],
      'changeLog.events': [made],
    })
    const door = within(notice('role') as HTMLElement).getByRole('link', { name: 'Mediate' })
    expect(door.getAttribute('href')).toBe('/games/g1/mediate')
  })

  test('an alert is not pinned over another Game’s pages (r3 H1)', async () => {
    const alert = {
      _id: 'a-3',
      ts: Date.now() - 1000,
      kind: 'alert',
      text: 'Mediator · Raiders close in',
      actorId: 'gm',
    }
    const other = { ...GAME, _id: 'g2', name: 'Other' }
    openRooms('g2')
    serveReads('g2', answers())
    await renderNotices(
      { 'games.listMine': [GAME, other], 'changeLog.events': [alert] },
      '/games/g2'
    )
    expect(notice('alert')).toBeNull()
    cleanup()
    await renderNotices(
      { 'games.listMine': [GAME, other], 'changeLog.events': [alert] },
      '/games/g1'
    )
    expect(notice('alert')).not.toBeNull()
  })

  test('on a Play screen the session needs no door', async () => {
    await renderNotices({ 'session.state': { live: true, startedAt: 7 } }, '/pilots/p1/play')
    expect(notice('session')).toBeNull()
  })
})

describe('the table’s news (r6 A3)', () => {
  test('someone else’s act is never a toast; what matters to the table is one line in the strip', async () => {
    const spy = mock((text: unknown, options?: { id?: unknown }) => {
      toasts.push({ text: String(text), id: options?.id })
      return 0
    })
    const real = components.toast
    const old = { _id: 'e-0', ts: 1, kind: 'vitals', text: 'Nell · HP 9 → 8', actorId: 'u2' }
    mock.module('../../components/index', () => ({ ...components, toast: spy }))
    try {
      const { TableNotices: Fresh } = await import(`../TableNotices?toast=${Date.now()}`)
      serveAll(answers({ 'changeLog.events': [old] }))
      const connected = { status: 'live' as const, canWrite: true, outdated: false }
      await act(async () => {
        render(
          <SyncContext.Provider value={connected}>
            <Fresh pathname="/games/g1" />
          </SyncContext.Provider>
        )
      })
      const theirs = { _id: 'e-1', ts: 2, kind: 'vitals', text: 'Nell · HP 8 → 5', actorId: 'u2' }
      const down = {
        _id: 'e-3',
        ts: 4,
        kind: 'vitals',
        text: 'Thresher (Razor) · SP 3 → 0',
        actorId: 'gm',
      }
      const mine = {
        _id: 'e-2',
        ts: 3,
        kind: 'board',
        text: 'Bonesaw boards Mazona',
        actorId: 'u1',
      }
      await act(async () => {
        serveAll(answers({ 'changeLog.events': [down, mine, theirs, old] }))
      })
      expect(toasts).toEqual([])
      expect(notice('event')?.textContent).toContain('Thresher (Razor) is Down')
      // Off the Game's pages it is the Feed's alone.
      cleanup()
      await act(async () => {
        render(
          <SyncContext.Provider value={connected}>
            <Fresh pathname="/build/" />
          </SyncContext.Provider>
        )
      })
      expect(notice('event')).toBeNull()
    } finally {
      mock.module('../../components/index', () => ({ ...components, toast: real }))
    }
  })
})

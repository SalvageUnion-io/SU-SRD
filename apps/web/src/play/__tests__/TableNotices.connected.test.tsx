import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

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
    expect(screen.getByText('Stop Sign · Tenacity: the game is paused')).toBeTruthy()
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

  test('a live session offers its door everywhere but on a Play screen, and says when it ends', async () => {
    await renderNotices({ 'session.state': { live: true, startedAt: 7 } })
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

  test('on a Play screen the session needs no door', async () => {
    await renderNotices({ 'session.state': { live: true, startedAt: 7 } }, '/pilots/p1/play')
    expect(notice('session')).toBeNull()
  })
})

describe('toasts', () => {
  test('another member’s act toasts once it happens; history and my own never do', async () => {
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
            <Fresh pathname="/" />
          </SyncContext.Provider>
        )
      })
      expect(toasts).toEqual([])
      const theirs = { _id: 'e-1', ts: 2, kind: 'vitals', text: 'Nell · HP 8 → 5', actorId: 'u2' }
      const mine = {
        _id: 'e-2',
        ts: 3,
        kind: 'board',
        text: 'Bonesaw boards Mazona',
        actorId: 'u1',
      }
      await act(async () => {
        serveAll(answers({ 'changeLog.events': [mine, theirs, old] }))
      })
      expect(toasts).toEqual([{ text: 'Nell · HP 8 → 5', id: 'table-event-e-1' }])
    } finally {
      mock.module('../../components/index', () => ({ ...components, toast: real }))
    }
  })
})

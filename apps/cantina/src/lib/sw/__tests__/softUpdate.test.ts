/**
 * The soft update's decisions: nothing changes until a new build is live; then
 * a navigation to another page becomes one full load, while same-page updates
 * and back/forward stay in-app. The router is a stand-in that records its one
 * blocker, so each decision is asserted by calling it directly.
 */
import { describe, expect, it } from 'bun:test'
import type { BlockerFn, HistoryLocation, RouterHistory } from '@tanstack/react-router'
import type { SoftUpdateRouter } from '../softUpdate'
import { createBuildSignal, installSoftUpdate } from '../softUpdate'

function at(href: string): HistoryLocation {
  const url = new URL(href, 'https://intheunionnow.com')
  return {
    href: `${url.pathname}${url.search}${url.hash}`,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    state: { __TSR_index: 0 },
  }
}

type NavigationBlocker = Parameters<RouterHistory['block']>[0]

function setup() {
  const blockers: NavigationBlocker[] = []
  let unblocked = 0
  const realPreload: SoftUpdateRouter['preloadRoute'] = async () => []
  const router = {
    history: {
      block: (blocker: NavigationBlocker) => {
        blockers.push(blocker)
        return () => {
          unblocked += 1
        }
      },
    },
    preloadRoute: realPreload,
  } as unknown as SoftUpdateRouter
  const loads: string[] = []
  const signal = createBuildSignal()
  const teardown = installSoftUpdate(router, signal, (href) => void loads.push(href))
  const navigate = (
    from: string,
    to: string,
    action: Parameters<BlockerFn>[0]['action'] = 'PUSH'
  ) => {
    const blocker = blockers[0]
    if (blocker === undefined) throw new Error('no blocker installed')
    return blocker.blockerFn({ currentLocation: at(from), nextLocation: at(to), action })
  }
  return {
    router,
    realPreload,
    blockers,
    loads,
    signal,
    teardown,
    navigate,
    get unblocked() {
      return unblocked
    },
  }
}

describe('installSoftUpdate', () => {
  it('changes nothing until a new build is live', () => {
    const s = setup()
    expect(s.blockers).toHaveLength(0)
    expect(s.router.preloadRoute).toBe(s.realPreload)
  })

  it('turns a page change into one full load of that page', () => {
    const s = setup()
    s.signal.markLive()
    expect(s.navigate('/', '/sheet/pilot/abc?tab=gear')).toBe(true)
    expect(s.loads).toEqual(['/sheet/pilot/abc?tab=gear'])
  })

  it('loads once, however many times the player clicks while it is under way', () => {
    const s = setup()
    s.signal.markLive()
    s.navigate('/', '/sheet/pilot/abc')
    expect(s.navigate('/', '/sheet/mech/def')).toBe(true)
    expect(s.loads).toEqual(['/sheet/pilot/abc'])
  })

  it('leaves same-page updates and back/forward in-app', () => {
    const s = setup()
    s.signal.markLive()
    expect(s.navigate('/roster?show=all', '/roster?show=game', 'REPLACE')).toBe(false)
    expect(s.navigate('/roster', '/sheet/pilot/abc', 'BACK')).toBe(false)
    expect(s.loads).toEqual([])
  })

  it('stops intent preloading, which would ask for chunks the server no longer has', async () => {
    const s = setup()
    s.signal.markLive()
    expect(s.router.preloadRoute).not.toBe(s.realPreload)
    expect(await s.router.preloadRoute({ to: '/' })).toBeUndefined()
  })

  it('never asks the browser to confirm leaving', () => {
    const s = setup()
    s.signal.markLive()
    expect(s.blockers[0]?.enableBeforeUnload).toBe(false)
  })

  it('acts at once when the build was already live', () => {
    const signal = createBuildSignal()
    signal.markLive()
    let blocked = 0
    const router = {
      history: {
        block: () => {
          blocked += 1
          return () => undefined
        },
      },
      preloadRoute: async () => undefined,
    } as unknown as SoftUpdateRouter
    installSoftUpdate(router, signal, () => undefined)
    expect(blocked).toBe(1)
  })

  it('tears down its blocker', () => {
    const s = setup()
    s.signal.markLive()
    s.teardown()
    expect(s.unblocked).toBe(1)
  })
})

/**
 * The two doors the SRD's Union bar opens into the app (`/sign-in`,
 * `/sign-out?to=…`): each acts once the session is known, and once only.
 */

import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import type { SyncState } from '../../../replica/syncContext'

let signedOut = 0
const serverMocks = await installServerMocks({
  router: 'probed',
  authReact: {
    signOut: async () => {
      signedOut++
    },
  },
})
afterAll(() => serverMocks.restore())

const { SignInHandoff, SignOutHandoff } = await import('../AccountHandoff')
const { SyncContext } = await import('../../../replica/syncContext')

const sync = (status: SyncState['status']): SyncState => ({
  status,
  canWrite: status === 'live',
  outdated: false,
})

let replaced: string[] = []
let replaceSpy: ReturnType<typeof spyOn> | null = null

beforeEach(() => {
  signedOut = 0
  replaced = []
  window.location.href = 'http://localhost/npcs/raider/'
  serverMocks.navigations.length = 0
  serverMocks.signIns.length = 0
  replaceSpy = spyOn(window.location, 'replace').mockImplementation((to: string | URL) => {
    replaced.push(String(to))
  })
})
afterEach(() => {
  replaceSpy?.mockRestore()
  window.location.href = 'http://localhost/'
})

describe('/sign-in', () => {
  test('waits while the session loads, then starts Discord’s round trip once', async () => {
    const view = render(
      <SyncContext.Provider value={sync('syncing')}>
        <SignInHandoff />
      </SyncContext.Provider>
    )
    expect(screen.getByText('Signing in with Discord…')).toBeTruthy()
    expect(serverMocks.signIns).toEqual([])

    await act(async () => {
      view.rerender(
        <SyncContext.Provider value={sync('signedOut')}>
          <SignInHandoff />
        </SyncContext.Provider>
      )
    })
    expect(serverMocks.signIns).toHaveLength(1)

    // A later status change does not start it again.
    await act(async () => {
      view.rerender(
        <SyncContext.Provider value={sync('live')}>
          <SignInHandoff />
        </SyncContext.Provider>
      )
    })
    expect(serverMocks.signIns).toHaveLength(1)
    expect(serverMocks.navigations).toEqual([])
  })

  test('a player already signed in goes straight to the Training Bay', async () => {
    await act(async () => {
      render(
        <SyncContext.Provider value={sync('live')}>
          <SignInHandoff />
        </SyncContext.Provider>
      )
    })
    expect(serverMocks.signIns).toEqual([])
    expect(serverMocks.navigations).toEqual([{ to: '/', replace: true }])
  })
})

describe('/sign-out', () => {
  test('does not sign out before the session has loaded', async () => {
    await act(async () => {
      render(
        <SyncContext.Provider value={sync('syncing')}>
          <SignOutHandoff to="/chassis/mule/" />
        </SyncContext.Provider>
      )
    })
    expect(screen.getByText('Signing out…')).toBeTruthy()
    expect(signedOut).toBe(0)
    expect(replaced).toEqual([])
  })

  test('ends the session, then returns to the page the menu was opened on', async () => {
    await act(async () => {
      render(
        <SyncContext.Provider value={sync('live')}>
          <SignOutHandoff to="/chassis/mule/" />
        </SyncContext.Provider>
      )
    })
    expect(signedOut).toBe(1)
    expect(replaced).toEqual(['http://localhost/chassis/mule/'])
  })

  test('an address on somebody else’s site is not followed: home instead', async () => {
    await act(async () => {
      render(
        <SyncContext.Provider value={sync('live')}>
          <SignOutHandoff to="https://elsewhere.example/steal" />
        </SyncContext.Provider>
      )
    })
    expect(replaced).toEqual(['http://localhost/'])
  })
})

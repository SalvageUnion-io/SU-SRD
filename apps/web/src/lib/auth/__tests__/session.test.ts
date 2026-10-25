/**
 * The client half of the Worker's session: the handshake `useWorkerAuth`
 * settles from `/auth/token`, the token cache, and the device's stored
 * session. The module keeps one session per page, so the tests run in order
 * against it, each one starting from where the last left the page.
 */

import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { localStore } from '../../safeLocalStorage'
import { AUTH_PATHS } from '../paths'
import { signIn, signOut, testSignIn, useWorkerAuth } from '../session'
import { SESSION_KEY } from '../storedSession'

const tokenExpiring = (exp: number) => `h.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.s`

type Answer = Response | Error
let answers: Answer[] = []
const calls: { url: string; init?: RequestInit }[] = []
let fetchSpy: ReturnType<typeof spyOn>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeAll(() => {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    calls.push({ url: String(input), init })
    const next = answers.shift()
    if (next === undefined) throw new Error(`unexpected fetch of ${String(input)}`)
    if (next instanceof Error) throw next
    return next
  }) as typeof fetch)
})

afterAll(() => {
  fetchSpy.mockRestore()
  localStore()?.removeItem(SESSION_KEY)
})

const later = Math.floor(Date.now() / 1000) + 600

describe('useWorkerAuth', () => {
  test('stays loading while the Worker is unreachable, and asks again once online', async () => {
    localStore()?.setItem(SESSION_KEY, 'stale')
    answers = [new TypeError('offline')]
    const { result } = renderHook(() => useWorkerAuth())
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(result.current).toMatchObject({ isLoading: true, isAuthenticated: false })
    expect(localStore()?.getItem(SESSION_KEY)).toBe('stale')

    answers = [new Response(null, { status: 401 })]
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(calls[1]?.url).toBe(AUTH_PATHS.token)
    expect(localStore()?.getItem(SESSION_KEY)).toBeNull()
  })

  test('the test seam signs in, and the token is served from cache until near expiry', async () => {
    const token = tokenExpiring(later)
    answers = [new Response(null, { status: 204 }), json({ token, account: 'user1' })]
    const { result } = renderHook(() => useWorkerAuth())
    await act(() => testSignIn('a@example.com', 'password1', 'signUp'))
    const seam = calls.at(-2)
    expect(seam?.url).toBe(AUTH_PATHS.testSignIn)
    expect(JSON.parse(String(seam?.init?.body))).toEqual({
      email: 'a@example.com',
      password: 'password1',
      flow: 'signUp',
    })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(localStore()?.getItem(SESSION_KEY)).toBe('user1')

    const before = calls.length
    expect(await result.current.fetchAccessToken({ forceRefreshToken: false })).toBe(token)
    expect(calls).toHaveLength(before)
  })

  test('a forced refresh asks again; a failed answer leaves the session as it was', async () => {
    const { result } = renderHook(() => useWorkerAuth())
    const fresh = tokenExpiring(later + 60)
    answers = [json({ token: fresh, account: 'user1' })]
    expect(await result.current.fetchAccessToken({ forceRefreshToken: true })).toBe(fresh)

    answers = [new Response('down', { status: 502 }), new TypeError('offline')]
    expect(await result.current.fetchAccessToken({ forceRefreshToken: true })).toBeNull()
    expect(await result.current.fetchAccessToken({ forceRefreshToken: true })).toBeNull()
    expect(result.current.isAuthenticated).toBe(true)
  })

  test('a token without a readable expiry is never served from cache', async () => {
    const { result } = renderHook(() => useWorkerAuth())
    answers = [json({ token: 'not-a-jwt', account: 'user1' })]
    await result.current.fetchAccessToken({ forceRefreshToken: true })
    answers = [json({ token: 'not.%%%.jwt', account: 'user1' })]
    expect(await result.current.fetchAccessToken({ forceRefreshToken: false })).toBe('not.%%%.jwt')
    answers = [json({ token: 'again', account: 'user1' })]
    expect(await result.current.fetchAccessToken({ forceRefreshToken: false })).toBe('again')
  })
})

describe('signOut', () => {
  test('throws when the Worker refuses, and signs out when it answers', async () => {
    const { result } = renderHook(() => useWorkerAuth())
    answers = [new Response(null, { status: 500 })]
    await expect(signOut()).rejects.toThrow('sign-out answered 500')
    expect(result.current.isAuthenticated).toBe(true)

    answers = [new Response(null, { status: 204 })]
    await act(() => signOut())
    expect(calls.at(-1)).toMatchObject({ url: AUTH_PATHS.signOut, init: { method: 'POST' } })
    expect(result.current).toMatchObject({ isLoading: false, isAuthenticated: false })
    expect(localStore()?.getItem(SESSION_KEY)).toBeNull()
  })
})

describe('testSignIn', () => {
  test("throws with the Worker's reason", async () => {
    answers = [new Response('no test seam here', { status: 404 })]
    await expect(testSignIn('a@example.com', 'password1', 'signIn')).rejects.toThrow(
      'test sign-in answered 404: no test seam here'
    )
  })
})

describe('signIn', () => {
  test('leaves for the Worker with the app route to come back to', () => {
    const assign = spyOn(window.location, 'assign').mockImplementation(() => undefined)
    try {
      signIn('/invite/abc')
      signIn()
      const [invite, front] = assign.mock.calls.map(([url]) => new URL(String(url), 'https://x'))
      expect(invite?.pathname).toBe(AUTH_PATHS.signIn)
      expect(invite?.searchParams.get('to')).toMatch(/\/invite\/abc$/)
      expect(front?.searchParams.get('to')).toMatch(/\/$/)
    } finally {
      assign.mockRestore()
    }
  })
})

describe('the stored session', () => {
  test('reads as signed out, and writes nothing, where storage is blocked', async () => {
    const { storedSessionAccount, writeStoredSession } = await import('../storedSession')
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(storedSessionAccount(blocked)).toBeNull()
    expect(storedSessionAccount(null)).toBeNull()
    expect(() => writeStoredSession(blocked, 'user1')).not.toThrow()
  })
})

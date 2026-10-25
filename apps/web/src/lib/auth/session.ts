/**
 * The app's session, as the site Worker keeps it (`src/worker/auth/`): an
 * HttpOnly cookie this code never sees, and a ten-minute token from
 * `/auth/token` that the Convex client sends (`ConvexProviderWithAuth`,
 * `AppConvexProvider`).
 *
 * The first answer settles the handshake. Offline it never comes: the state
 * stays loading, which `ConnectionProvider` reads with the device's stored
 * session as "signed in, unreachable", and it is asked again when the
 * browser is back online.
 */

import { ConvexError } from 'convex/values'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { appPath } from '../appBase'
import { localStore } from '../safeLocalStorage'
import type { TokenAnswer } from './paths'
import { AUTH_PATHS } from './paths'
import { writeStoredSession } from './storedSession'

type AuthState = { isLoading: boolean; isAuthenticated: boolean }

let state: AuthState = { isLoading: true, isAuthenticated: false }
let cached: { token: string; expiresAt: number } | null = null
let started = false
const listeners = new Set<() => void>()

function settle(answer: TokenAnswer | null): void {
  const before = cached?.token ?? null
  cached = answer && { token: answer.token, expiresAt: expiryOf(answer.token) }
  writeStoredSession(localStore(), answer?.account ?? null)
  const next = { isLoading: false, isAuthenticated: answer !== null }
  const same = next.isLoading === state.isLoading && next.isAuthenticated === state.isAuthenticated
  if (same && before === (cached?.token ?? null)) return
  if (!same) state = next
  for (const listener of listeners) listener()
}

function expiryOf(token: string): number {
  try {
    const payload = token.split('.')[1] ?? ''
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number
    }
    return typeof exp === 'number' ? exp * 1000 : 0
  } catch {
    return 0
  }
}

/** Asks the Worker; `undefined` when it could not be reached, so nothing is settled. */
async function ask(): Promise<string | null | undefined> {
  let res: Response
  try {
    res = await fetch(AUTH_PATHS.token, { credentials: 'same-origin', cache: 'no-store' })
  } catch {
    return undefined
  }
  if (res.status === 401) {
    settle(null)
    return null
  }
  if (!res.ok) return undefined
  const answer = (await res.json()) as TokenAnswer
  settle(answer)
  return answer.token
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  void ask()
  window.addEventListener('online', () => {
    if (state.isLoading) void ask()
  })
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The `useAuth` `ConvexProviderWithAuth` takes. */
export function useWorkerAuth() {
  const { isLoading, isAuthenticated } = useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  )
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      // A minute's margin, so a token never expires on its way to Convex.
      if (!forceRefreshToken && cached && cached.expiresAt - 60_000 > Date.now())
        return cached.token
      return (await ask()) ?? null
    },
    []
  )
  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken]
  )
}

/**
 * The session's current token, `null` until one is answered or once signed
 * out; a new one each time Convex has it refreshed. For a room's socket
 * (`useGamePresence`), which the Worker checks with Convex.
 */
export function useSessionToken(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => cached?.token ?? null,
    () => null
  )
}

/**
 * Off to Discord, and back to `route` in the app (the app's front door if
 * unset). An invite passes its own route, so signing in from it comes back to
 * it and joins.
 */
export function signIn(route = '/'): void {
  window.location.assign(`${AUTH_PATHS.signIn}?to=${encodeURIComponent(appPath(route))}`)
}

/** Ends the session; throws when the Worker could not. */
export async function signOut(): Promise<void> {
  const res = await fetch(AUTH_PATHS.signOut, { method: 'POST', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`sign-out answered ${res.status}`)
  settle(null)
}

/**
 * Deletes the account through the Worker, which ends every session with it.
 * A refusal throws Convex's own error, so `useServerAction` says its words.
 */
export async function deleteAccount(): Promise<void> {
  const res = await fetch(AUTH_PATHS.deleteAccount, { method: 'POST', credentials: 'same-origin' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      errorMessage?: string
      errorData?: unknown
    }
    if (body.errorData !== undefined && body.errorData !== null)
      throw new ConvexError(body.errorData as string)
    throw new Error(`account deletion answered ${res.status}: ${body.errorMessage ?? ''}`)
  }
  settle(null)
}

/** The test seam's client half (`TestAuthBridge`); the Worker refuses it without `TEST_AUTH`. */
export async function testSignIn(
  email: string,
  password: string,
  flow: 'signUp' | 'signIn'
): Promise<void> {
  const res = await fetch(AUTH_PATHS.testSignIn, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, flow }),
  })
  if (!res.ok) throw new Error(`test sign-in answered ${res.status}: ${await res.text()}`)
  await ask()
}

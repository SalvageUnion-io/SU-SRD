/**
 * The app's session, as the site Worker keeps it (`src/worker/auth/`): an
 * HttpOnly cookie this code never sees, and who it signs in, from
 * `/auth/session`.
 *
 * The first answer settles the handshake. Offline it never comes: the state
 * stays loading, which `ConnectionProvider` reads with the device's stored
 * session as "signed in, unreachable", and it is asked again when the
 * browser is back online.
 */

import { useSyncExternalStore } from 'react'
import { RoomDeclined } from '../../replica/roomSocket'
import { appPath } from '../appBase'
import { localStore } from '../safeLocalStorage'
import type { SessionAnswer } from './paths'
import { AUTH_PATHS } from './paths'
import { writeStoredSession } from './storedSession'

type AuthState = { isLoading: boolean; isAuthenticated: boolean }

let state: AuthState = { isLoading: true, isAuthenticated: false }
let cached: SessionAnswer | null = null
let started = false
const listeners = new Set<() => void>()

function settle(answer: SessionAnswer | null): void {
  const before = cached?.person ?? null
  cached = answer
  writeStoredSession(localStore(), answer?.account ?? null)
  const next = { isLoading: false, isAuthenticated: answer !== null }
  const same = next.isLoading === state.isLoading && next.isAuthenticated === state.isAuthenticated
  if (same && before === (cached?.person ?? null)) return
  if (!same) state = next
  for (const listener of listeners) listener()
}

/** Asks the Worker; `undefined` when it could not be reached, so nothing is settled. */
async function ask(): Promise<void> {
  let res: Response
  try {
    res = await fetch(AUTH_PATHS.session, { credentials: 'same-origin', cache: 'no-store' })
  } catch {
    return
  }
  if (!res.ok) {
    // Read to the end: a body left unread keeps the request open in the
    // browser, and the page never goes network-idle.
    await res.text().catch(() => '')
    if (res.status === 401) settle(null)
    return
  }
  settle((await res.json()) as SessionAnswer)
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

/** Whether the session is settled yet, and signed in. */
export function useSession(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  )
}

/**
 * Who the rooms name the signed-in player as (their Discord id), `null`
 * until the session is answered or once signed out. Under the rooms it is
 * the id a member, a seat or a unit's owner is compared with.
 */
export function useMyPerson(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => cached?.person ?? null,
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
 * A refusal throws its words, so `useServerAction` says them.
 */
export async function deleteAccount(): Promise<void> {
  const res = await fetch(AUTH_PATHS.deleteAccount, { method: 'POST', credentials: 'same-origin' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { errorMessage?: string }
    if (res.status === 409 && body.errorMessage) throw new RoomDeclined(body.errorMessage)
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

/**
 * Name-keyed test double for the Worker's Games calls (`replica/roomCalls`).
 *
 * Reads are answered by call name (`'games.get'`), not by position. A queue
 * drained one entry per call, in render order, makes every fixture an
 * implicit assertion about hook ordering: adding a read to a component, or
 * reordering two adjacent `useGamesQuery` lines (GameRoster.tsx and
 * GameHub.tsx both have back-to-back calls), silently shifts every later
 * answer onto the wrong hook, and the test passes while asserting nothing it
 * claims to.
 *
 * An unregistered name **throws** rather than returning `undefined`, so a
 * component that starts asking a new question fails loudly instead of
 * quietly rendering its loading state forever.
 *
 * `mock.module` is process-global (see `.claude/rules/testing-patterns.md`),
 * so a capture-mock-restore triple done wrong breaks *other* files rather than
 * your own. `installServerMocks()` owns that discipline once.
 */

import { mock } from 'bun:test'
import type { ReactNode } from 'react'
import { createElement } from 'react'

/** `'games.get'` → the value that read should return this test. */
export type QueryAnswers = Record<string, unknown>

type QueryCall = { name: string; args: unknown }

let answers: QueryAnswers = {}
let calls: QueryCall[] = []

/**
 * Register this test's answers, keyed by call name (`'games.get'`). Replaces
 * the whole map — no state carries over between tests or between files
 * sharing the process.
 */
export function setQueryAnswers(next: QueryAnswers): void {
  answers = next
  calls = []
}

/** Every read the render made, in order, with the args it passed. */
export function queryCalls(): readonly QueryCall[] {
  return calls
}

/** The `useGamesQuery` replacement. A skipped read is `undefined` and needs no answer. */
function mockUseQuery(name: string, args?: unknown): unknown {
  if (args === 'skip') return undefined
  calls.push({ name, args })
  if (!(name in answers)) {
    const known = Object.keys(answers).join(', ') || '(none registered)'
    throw new Error(
      `server mock: no answer registered for "${name}". Registered: ${known}. ` +
        "Add it to this test's setQueryAnswers({ ... }) call."
    )
  }
  return answers[name]
}

/** A Games write or `roomCall` as a file answers it: its name and arguments. */
type CallAnswer = (name: string, args: unknown) => unknown

/**
 * The Games hooks on this double: a read from `setQueryAnswers` (or the file's
 * `query`), a write and a `roomCall` through the file's `call`, a write with
 * its screen's scope under its own arguments. `useViewerId` is `account.me`'s
 * id where the file answers it, else the session's person.
 */
function roomCallsMock(
  real: Record<string, unknown>,
  query: (name: string, args: unknown) => unknown,
  call: CallAnswer
): Record<string, unknown> {
  return {
    ...real,
    roomCall: async (name: string, args: unknown) => call(name, args),
    useGamesQuery: (name: string, args: unknown) => query(name, args),
    useGamesCall:
      (name: string, scope: object = {}) =>
      async (args: object) =>
        call(name, { ...scope, ...args }),
    useViewerId: () => {
      const person = (real.useViewerId as () => string | null)()
      try {
        const me = query('account.me', {}) as { _id?: string } | null | undefined
        return me?._id ?? null
      } catch {
        // A file that answers no `account.me` reads the session's person.
        return person
      }
    },
  }
}

/** Extra modules to mock, keyed by specifier. */
type ExtraMocks = Record<string, () => unknown>

export type InstallOptions = {
  /** Every Games write and `roomCall`, by name; answers nothing by default. */
  call?: CallAnswer
  /** Every Games read, in place of `setQueryAnswers`'s (`mockUseQuery`). */
  query?: (name: string, args: unknown) => unknown
  /**
   * The app's session (`lib/auth/session`) is always stubbed: signed in, with
   * a recording `signIn` (the real one leaves the page). An object replaces
   * those of its functions it names (`useSession` for who is signed in).
   */
  authReact?: Record<string, unknown>
  /**
   * Stub `@tanstack/react-router` with a plain `<a>` `Link` and a recording
   * `useNavigate`. Read what it recorded off the handle's `navigations`.
   */
  router?: boolean
  /**
   * Anything else this file needs mocked. **Specifiers resolve relative to
   * THIS file**, not the caller — `'../../replica/units'`, not
   * `'../../../replica/units'`.
   */
  also?: ExtraMocks
}

export type ServerMockHandle = {
  /** Put every module back. Call it from `afterAll`, always. */
  restore: () => void
  /** Every `useNavigate()(opts)` the render made. Only fills with `router: true`. */
  navigations: unknown[]
  /** Every `signIn(route?)` call, as its argument list. */
  signIns: unknown[][]
}

/**
 * Install the connected-surface module mocks and hand back the undo.
 *
 * **Call this at module scope, before the `await import()` of the component
 * under test.** `mock.module` only affects imports that resolve after it runs,
 * so moving this into `beforeAll` silently exercises the real Worker calls.
 *
 * The two rules this exists to enforce, both of which broke unrelated suites
 * when a file got them wrong:
 *
 *  1. **Capture before mocking.** A module namespace object is a *live view*.
 *     Holding the namespace itself captures nothing — by `afterAll` it already
 *     reads as the mock — so every real module is spread into a plain object
 *     here, and all of them are captured before the first `mock.module` call.
 *  2. **Restore in `afterAll`.** `mock.module` writes the process-wide module
 *     registry, so a mock left installed poisons every test file that runs
 *     after this one in the same process.
 */
export async function installServerMocks(options: InstallOptions = {}): Promise<ServerMockHandle> {
  const navigations: unknown[] = []
  const signIns: unknown[][] = []

  // --- capture, before anything is mocked (rule 1) ---
  const realRoomCalls = { ...(await import('../../replica/roomCalls')) }
  const realSession = { ...(await import('../../lib/auth/session')) }
  const realRouter = options.router ? { ...(await import('@tanstack/react-router')) } : null
  const realExtras = new Map<string, Record<string, unknown>>()
  for (const specifier of Object.keys(options.also ?? {})) {
    realExtras.set(specifier, { ...(await import(specifier)) })
  }

  // --- install ---
  mock.module('../../replica/roomCalls', () =>
    roomCallsMock(realRoomCalls, options.query ?? mockUseQuery, options.call ?? (() => undefined))
  )

  mock.module('../../lib/auth/session', () => ({
    ...realSession,
    useSession: () => ({ isAuthenticated: true, isLoading: false }),
    signIn: (...args: unknown[]) => {
      signIns.push(args)
    },
    signOut: async () => undefined,
    ...options.authReact,
  }))

  if (realRouter !== null) {
    mock.module('@tanstack/react-router', () => ({
      Link: ({ children, to }: { children: ReactNode; to: string }) =>
        createElement('a', { href: to }, children),
      useNavigate: () => async (opts: unknown) => {
        navigations.push(opts)
      },
      useRouter: () => undefined,
    }))
  }

  for (const [specifier, factory] of Object.entries(options.also ?? {})) {
    mock.module(specifier, factory)
  }

  return {
    navigations,
    signIns,
    restore() {
      mock.module('../../replica/roomCalls', () => realRoomCalls)
      mock.module('../../lib/auth/session', () => realSession)
      if (realRouter !== null) mock.module('@tanstack/react-router', () => realRouter)
      for (const [specifier, real] of realExtras) mock.module(specifier, () => real)
    },
  }
}

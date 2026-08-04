/**
 * Name-keyed Convex `useQuery` test double.
 *
 * The connected-surface tests used to answer `useQuery` **positionally** — a
 * queue drained one entry per call, in render order. That made every fixture
 * an implicit assertion about hook ordering: adding a query to a component,
 * or reordering two adjacent `useQuery` lines (GameRoster.tsx and
 * InvitePanel.tsx both have back-to-back calls), silently shifted every later
 * answer onto the wrong hook. The test kept passing while asserting nothing
 * it claimed to.
 *
 * The old comment justified this with "the generated `api` is a Proxy that
 * throws when inspected, so position is the only stable key". That is wrong:
 * `getFunctionName(api.games.get)` returns the stable string `'games:get'`,
 * which is exactly the key we want. Answers are registered by that name here.
 *
 * An unregistered name **throws** rather than returning `undefined`, so a
 * component that starts asking a new question fails loudly instead of
 * quietly rendering its loading state forever.
 *
 * `mock.module` is process-global (see `.claude/rules/testing-patterns.md`).
 * Nine connected-surface files each hand-rolled the same capture-mock-restore
 * triple, which is exactly the code where getting it wrong breaks *other*
 * files rather than your own. `installConvexMocks()` at the bottom of this
 * file owns that discipline once; `convexReactMock()` stays available on its
 * own for anything that needs to drive `mock.module` itself.
 */

import { mock } from 'bun:test'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { ReactNode } from 'react'
import { createElement } from 'react'

/** `'games:get'` → the value that query should return this test. */
export type QueryAnswers = Record<string, unknown>

type QueryCall = { name: string; args: unknown }

let answers: QueryAnswers = {}
let calls: QueryCall[] = []

/**
 * Register this test's answers, keyed by `getFunctionName` output
 * (`'<module>:<export>'`, e.g. `'games:get'`). Replaces the whole map — no
 * state carries over between tests or between files sharing the process.
 */
export function setQueryAnswers(next: QueryAnswers): void {
  answers = next
  calls = []
}

/** Every query the render made, in order, with the args it passed. */
export function queryCalls(): readonly QueryCall[] {
  return calls
}

/**
 * The `useQuery` replacement. Honours Convex's `'skip'` sentinel (a skipped
 * query returns `undefined` in production and must not need an answer).
 */
export function mockUseQuery(ref: unknown, args?: unknown): unknown {
  if (args === 'skip') return undefined

  const name = getFunctionName(ref as FunctionReference<'query'>)
  calls.push({ name, args })

  if (!(name in answers)) {
    const known = Object.keys(answers).join(', ') || '(none registered)'
    throw new Error(
      `convex useQuery mock: no answer registered for "${name}". Registered: ${known}. ` +
        "Add it to this test's setQueryAnswers({ ... }) call."
    )
  }
  return answers[name]
}

/**
 * The full `convex/react` module body these tests replace. Every export the
 * transitive importers reach is present, not just the hooks under test —
 * `@convex-dev/auth/react` fails at import on a missing `ConvexProviderWithAuth`.
 *
 * Pass `overrides` for the per-file bits (a mutation spy, an unauthenticated
 * `useConvexAuth`, …).
 */
export function convexReactMock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    useQuery: mockUseQuery,
    useMutation: () => async () => undefined,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    ConvexReactClient: class {},
    ConvexProvider: ({ children }: { children: unknown }) => children,
    ConvexProviderWithAuth: ({ children }: { children: unknown }) => children,
    useConvex: () => ({}),
    useAction: () => async () => undefined,
    ...overrides,
  }
}

/** Extra modules to mock alongside Convex, keyed by specifier. */
export type ExtraMocks = Record<string, () => unknown>

export type InstallOptions = {
  /**
   * Per-file additions to the `convex/react` body — a mutation recorder, an
   * unauthenticated `useConvexAuth`, … Passed straight to `convexReactMock`.
   */
  convexReact?: Record<string, unknown>
  /**
   * Stub `@convex-dev/auth/react` too. Needed by anything that mounts
   * `SignInControl`, whose real provider wants a live Convex client.
   */
  authReact?: boolean
  /**
   * Stub `@tanstack/react-router` with a plain `<a>` `Link` and a recording
   * `useNavigate`. Read what it recorded off the handle's `navigations`.
   */
  router?: boolean
  /**
   * Anything else this file needs mocked. **Specifiers resolve relative to
   * THIS file**, not the caller — `'../../stores/entityStore'`, not
   * `'../../../stores/entityStore'`.
   */
  also?: ExtraMocks
}

export type ConvexMockHandle = {
  /** Put every module back. Call it from `afterAll`, always. */
  restore: () => void
  /** Every `useNavigate()(opts)` the render made. Only fills with `router: true`. */
  navigations: unknown[]
}

/**
 * Install the connected-surface module mocks and hand back the undo.
 *
 * **Call this at module scope, before the `await import()` of the component
 * under test.** `mock.module` only affects imports that resolve after it runs,
 * so moving this into `beforeAll` silently exercises the real Convex client.
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
export async function installConvexMocks(options: InstallOptions = {}): Promise<ConvexMockHandle> {
  const navigations: unknown[] = []

  // --- capture, before anything is mocked (rule 1) ---
  const realConvexClient = { ...(await import('../../lib/connection/convexClient')) }
  const realConvexReact = { ...(await import('convex/react')) }
  const realAuthReact = options.authReact ? { ...(await import('@convex-dev/auth/react')) } : null
  const realRouter = options.router ? { ...(await import('@tanstack/react-router')) } : null
  const realExtras = new Map<string, Record<string, unknown>>()
  for (const specifier of Object.keys(options.also ?? {})) {
    realExtras.set(specifier, { ...(await import(specifier)) })
  }

  // --- install ---
  mock.module('../../lib/connection/convexClient', () => ({
    isConvexConfigured: true,
    convexClient: {},
  }))
  mock.module('convex/react', () => convexReactMock(options.convexReact ?? {}))

  if (realAuthReact !== null) {
    mock.module('@convex-dev/auth/react', () => ({
      useAuthActions: () => ({ signIn: async () => undefined, signOut: async () => undefined }),
      ConvexAuthProvider: ({ children }: { children: ReactNode }) => children,
    }))
  }

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
    restore() {
      mock.module('../../lib/connection/convexClient', () => realConvexClient)
      mock.module('convex/react', () => realConvexReact)
      if (realAuthReact !== null) mock.module('@convex-dev/auth/react', () => realAuthReact)
      if (realRouter !== null) mock.module('@tanstack/react-router', () => realRouter)
      for (const [specifier, real] of realExtras) mock.module(specifier, () => real)
    },
  }
}

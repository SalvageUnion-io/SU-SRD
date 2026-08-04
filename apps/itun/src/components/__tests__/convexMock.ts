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
 * `mock.module` is process-global (see `.claude/rules/testing-patterns.md`),
 * so this module deliberately does NOT call it — each test file keeps its own
 * capture-and-restore pair and passes `convexReactMock()` as the factory body.
 */

import { getFunctionName } from 'convex/server'
import type { FunctionReference } from 'convex/server'

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

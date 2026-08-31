---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
---

# Testing Patterns

Testing patterns using Bun's test runner and Testing Library for component tests.

## Package Tests

- Use Bun's built-in test runner
- Test files: `*.test.ts` or `*.test.tsx`
- Test directories: `__tests__/` or co-located with source

## App Tests

- Use Bun test runner with Testing Library
- Use `@testing-library/react` for component tests
- Use `@testing-library/user-event` for interactions
- Use `@testing-library/jest-dom` for DOM assertions
- Setup files: `testing-library.ts`, `happydom.ts`

## Test Structure

- Use `describe` blocks to group related tests
- Use `test` or `it` for individual test cases
- Follow Arrange-Act-Assert pattern
- Use descriptive test names

## Component Testing

- Test user interactions, not implementation details
- Use `render()` from Testing Library
- Query by accessible roles/labels when possible
- Use `waitFor` for async updates

## Mocking

- ITUN data-layer tests run against `fake-indexeddb` (preloaded via `bunfig.toml`)
- Use `mock()` from `bun:test` for module/function mocking
- Mock external dependencies appropriately

### `mock.module` is process-global — restore what you replace

`mock.module` rewrites the entry in the module registry for the whole test
process, **not** for the file that called it. Every test file that runs after
yours gets your replacement. This is not theoretical: mocking the entity store
in one component test broke 219 tests across the suite, and the failures
surfaced in files that had never heard of the mocked module.

Capture the real exports first, and put them back in `afterAll`:

```typescript
// The spread is load-bearing. A module namespace is a LIVE view, and mocking
// rewrites it in place — hold the namespace itself and by `afterAll` it
// already reads as the mock, so you restore the mock over the mock.
const realStore = { ...(await import('../../stores/entityStore')) }

mock.module('../../stores/entityStore', () => ({ useEntityStore: fake }))

afterAll(() => {
  mock.module('../../stores/entityStore', () => realStore)
})
```

Two corollaries:

- **Partial mocks break importers you did not think about.** Replacing
  `convex/react` with only the hooks under test made `@convex-dev/auth/react`
  fail at import on a missing `ConvexProviderWithAuth`. Mock every export the
  transitive importers reach, not just the ones your component calls.
- **Beware module-scope environment reads.** `config.ts` reads `process.env`
  once at import, so setting an env var to drive a test hands that value to
  every later file too. Mock the config module instead of setting the variable.

### Never re-declare `afterEach(cleanup)` — the preload already runs it

Testing Library's own auto-cleanup proved order-dependent here: a file passed
alone and failed in the full suite, because when several tests render the same
accessible name one leaked render turns every later query into "found multiple
elements". That is why `test/testing-library.ts` registers an **`act()`-wrapped
`afterEach(cleanup)`** (which also clears `sessionStorage`/`localStorage`), and
why every workspace running component tests preloads it — `apps/itun`,
`apps/srd` and `packages/component-lib` all list it in their `bunfig.toml`.

So do **not** write `afterEach(cleanup)` in a test file. A bare re-declaration
is strictly worse than the hook that already runs: it is not wrapped in
`act()`, so it unmounts without flushing pending React updates, reintroducing
the "not wrapped in act(...)" warnings the preload exists to avoid. It also
buys nothing — the preload's hook runs for that file regardless.

`packages/component-lib/src/test-hygiene.test.ts` enforces this.

Two things that _are_ still your job:

- If unmounting is load-bearing for a file (same accessible name across tests),
  say so in a comment that points at the preload, rather than adding a hook.
- If a test needs to unmount **mid-test** (e.g. asserting on a remount), call
  `cleanup()` inline at that point. That is a different thing from an
  `afterEach` hook and is fine.

### Never call `SalvageUnionReference.preload()` in a test file

The same preload layer loads the whole reference dataset:
`test/reference-preload.ts` runs `preload('all')` and is wired into all four
workspaces that touch reference data (`apps/itun`, `apps/srd`,
`packages/component-lib`, `packages/salvageunion-reference`).

A per-file `beforeAll(() => SalvageUnionReference.preload([...]))` is at best a
no-op and at worst hides an ordering bug: `ModelFactory`'s loaded-schema set is
module-global and never reset, and Bun runs a workspace's test files in one
process, so a narrow schema list can appear correct purely because a sibling
file already loaded everything.

The exception is a test that deliberately calls `resetAllForTesting()` and
re-preloads to assert on load behaviour — see
`apps/srd/src/lib/__tests__/schemaPreloadDeps.test.tsx`.

### Do not sleep on a real debounce

Never `await new Promise((r) => setTimeout(r, 200))` to outwait a debounce. A
fixed margin over a real timer is a latent flake on a shared CI runner and pure
dead wall-clock everywhere else. Use one of:

- `jest.useFakeTimers()` + `jest.advanceTimersByTime(DEBOUNCE_MS)` inside
  `act()` when the component's own timer must be driven — see
  `RollTable.test.tsx`, `SearchIsland.test.tsx`, `useSearchCombobox.test.tsx`.
- `setSystemTime()` when the code under test reads `Date.now()` rather than a
  timer — see the retry-backoff tests in
  `apps/itun/src/lib/snapshot/__tests__/client.test.ts`. (This used to cite the
  `RateLimiter` window tests; that limiter counted per instance, was replaced by
  Cloudflare's edge-enforced binding, and went with the Netlify functions.)
- `await screen.findByText(...)` / `waitFor(...)` — polls, so it returns as
  soon as the assertion holds.

**Fake timers and `waitFor` do not mix.** RTL's `waitFor` polls on a real
interval, so a test that leaves timers faked and then calls `waitFor` hangs the
whole suite. Scope `useFakeTimers()` to the helper that needs it (see
`GlobalSearch.test.tsx`), not the whole file, when both appear in one file.

A **bounded poll** — a loop that re-checks a predicate and exits as soon as it
holds — is not this anti-pattern. `settle()` in `Roster.test.tsx` and
`DashboardChooser.test.tsx` polls `fake-indexeddb` work to completion inside
`act()`; it has no fixed margin to get wrong and returns early. Leave those.

### Fixtures carry one frozen timestamp

Entity fixtures come from `apps/itun/src/components/__tests__/fixtures.ts`
(`pilotFixture` / `mechFixture` / `crawlerFixture`), all stamped with the
exported `FIXTURE_NOW`. Never write `new Date().toISOString()` into a fixture:
it makes two entities built microseconds apart differ, makes shape assertions
unstable, and hides real "did this write bump `updatedAt`?" bugs behind a value
that was never pinned. When a test genuinely needs a _distinct_ timestamp, pass
one explicitly via overrides.

This had forked by directory, not at random: `dashboard/__tests__` used the
shared factories while `sheet/__tests__` re-derived the same shapes by hand
against a live clock. Both populations now use the same factories, and
`test-hygiene.test.ts` keeps it that way.

## Examples

**Package test:**

```typescript
test('model finds item by id', () => {
  const item = SalvageUnionReference.Chassis.find((x) => x.id === 'test-id')
  expect(item).toBeDefined()
})
```

**Component test:**

```typescript
test('renders pilot name', () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <PilotComponent id="test-id" />
    </QueryClientProvider>
  )
  expect(screen.getByText('Pilot Name')).toBeInTheDocument()
})
```

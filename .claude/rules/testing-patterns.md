---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
---

# Testing Patterns

## Component Testing

- Test user interactions, not implementation details
- Query by accessible roles/labels when possible
- Use `waitFor` for async updates
- React's "not wrapped in act(...)" and "a style property during rerender" warnings fail the test (`test/testing-library.ts`): settle async work inside `await act(async () => …)`, and in ITUN load the real stores first with `hydrateStores` (`src/components/__tests__/hydrateStores.ts`)

## Mocking

- ITUN data-layer tests run against `fake-indexeddb` (preloaded via `bunfig.toml`)
- Use `mock()` from `bun:test` for module/function mocking

### `mock.module` is process-global — restore what you replace

`mock.module` rewrites the entry in the module registry for the whole test
process, **not** for the file that called it. Every test file that runs after
yours gets your replacement.

Capture the real exports first, and put them back in `afterAll`:

```typescript
// Spread it: the namespace is a live view the mock rewrites in place.
const realStore = { ...(await import('../../stores/entityStore')) }

mock.module('../../stores/entityStore', () => ({ useEntityStore: fake }))

afterAll(() => {
  mock.module('../../stores/entityStore', () => realStore)
})
```

Two corollaries:

- **Partial mocks break importers you did not think about.** Mock every export
  the transitive importers reach (`@convex-dev/auth/react` needs
  `convex/react`'s `ConvexProviderWithAuth`), not just the ones you call.
- **Beware module-scope environment reads.** `config.ts` reads `process.env`
  once at import, so setting an env var to drive a test hands that value to
  every later file too. Mock the config module instead of setting the variable.

### Never re-declare `afterEach(cleanup)` — the preload already runs it

`test/testing-library.ts`, which every workspace running component tests
preloads, registers an `act()`-wrapped `afterEach(cleanup)` (it also clears
`sessionStorage`/`localStorage`). A bare re-declaration unmounts without
flushing pending React updates; `tools/biome/noBareCleanupHook.grit` fails it.
To unmount **mid-test** (e.g. asserting on a remount), call `cleanup()` inline.

### Never call `SalvageUnionReference.preload()` in a test file

`test/reference-preload.ts` already loads every schema, and the loaded-schema
set is module-global, so a narrow per-file list can pass only because a sibling
file loaded everything; `tools/biome/noTestReferencePreload.grit`
fails it. The exceptions re-preload after `resetAllForTesting()` to assert on
load behaviour, and biome.jsonc excludes each by path with its reason.

### Do not sleep on a real debounce

Never `await new Promise((r) => setTimeout(r, 200))` to outwait a debounce: it
is a latent flake on CI and dead wall-clock everywhere. Use one of:

- `jest.useFakeTimers()` + `jest.advanceTimersByTime(DEBOUNCE_MS)` inside
  `act()` when the component's own timer must be driven — see
  `RollTable.test.tsx`, `SearchIsland.test.tsx`, `useSearchCombobox.test.tsx`.
- `setSystemTime()` when the code under test reads `Date.now()` rather than a
  timer — see the stale-write tests in `apps/itun/test/convex/appId.test.ts`.
- `await screen.findByText(...)` / `waitFor(...)`, which poll.

**Fake timers and `waitFor` do not mix.** RTL's `waitFor` polls on a real
interval, so a test that leaves timers faked and then calls `waitFor` hangs the
whole suite. Scope `useFakeTimers()` to the helper that needs it (see
`GlobalSearch.test.tsx`), not the whole file, when both appear in one file.

### Fixtures carry one frozen timestamp

Entity fixtures come from `apps/itun/src/components/__tests__/fixtures.ts`
(the Convex suites' via `apps/itun/test/convex/fixtures.ts`), stamped with
`FIXTURE_NOW`; pass a distinct timestamp through overrides when needed. Never
write `new Date().toISOString()` into a fixture:
`tools/biome/noLiveClockFixture.grit` fails it.

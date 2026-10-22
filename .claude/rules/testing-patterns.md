---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
---

# Testing Patterns

Layout, cleanup hooks, reference preloads and fixture clocks are gated
(`check test-layout`, the GritQL rules); their messages say the fix.

- Test interactions; query by role or label. React's "not wrapped in act(...)"
  warning fails the test: settle async work in `await act(async () => …)`, and in
  the app load the real stores with `hydrateStores`
  (`src/components/__tests__/hydrateStores.ts`).
- The app's stores are in memory: reset with `resetStores()`, seed with `adopt`
  (`src/stores/__tests__/`). Fixtures come from
  `apps/web/src/components/__tests__/fixtures.ts`.

## `mock.module` is process-global: restore what you replace

It rewrites the module registry for every later file, not just yours. Capture
the real exports first and put them back:

```typescript
// Spread it: the namespace is a live view the mock rewrites in place.
const realStore = { ...(await import('../../stores/entityStore')) }
mock.module('../../stores/entityStore', () => ({ useEntityStore: fake }))
afterAll(() => {
  mock.module('../../stores/entityStore', () => realStore)
})
```

- A partial mock breaks transitive importers: mock every export they reach
  (`@convex-dev/auth/react` needs `convex/react`'s `ConvexProviderWithAuth`).
- A module that reads `process.env` at import (`config.ts`) leaks a test's env
  var to every later file: mock the module, not the variable.

## Time

- Never sleep past a debounce: `jest.useFakeTimers()` +
  `jest.advanceTimersByTime(…)` inside `act()`, `setSystemTime()` for code that
  reads `Date.now()`, or `findBy…` / `waitFor`, which poll.
- `waitFor` hangs under fake timers: scope `useFakeTimers()` to the helper that
  needs it.

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

### Call `cleanup()` explicitly in component tests

Testing Library's auto-cleanup has proven order-dependent here — a file passed
alone and failed in the full suite. When several tests in a file render the
same accessible name, one leaked render turns every later query into "found
multiple elements". Add `afterEach(cleanup)` rather than depending on it.

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

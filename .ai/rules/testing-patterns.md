# Testing Patterns

> **Applies to:** `**/*.test.ts`, `**/*.test.tsx`, `**/__tests__/**/*`

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

- Mock Supabase client for API tests
- Use `vi.mock()` for module mocking (Vitest/Bun)
- Mock external dependencies appropriately

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

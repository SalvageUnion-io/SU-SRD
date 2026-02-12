---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Error Handling

Error handling patterns using PermissionError class, ErrorBoundary component, TanStack Query error states, and logger utility.

## Error Types

### PermissionError

Custom error class for permission violations:

- Defined in `src/lib/permissions.ts`
- Throw when user doesn't have access to a resource
- Example: `throw new PermissionError('This resource is private and you do not have access')`

### Standard Errors

Use native Error class for other errors:

- Network errors from Supabase
- Validation errors from Zod
- Business logic errors

## Error Display Components

### ErrorBoundary

- Located in `src/components/ErrorBoundary.tsx`
- Catches React rendering errors
- Calls `reportError()` to log errors
- Displays user-friendly error UI with details

### LiveSheetErrorState

- Use when TanStack Query returns `isError` state
- Display in place of loading/content states
- Show error message from query error

### DashboardError

- Use for route-level errors
- Display full-page error UI
- Include navigation back to safe routes

## TanStack Query Error Handling

### Query Hooks

```typescript
const { data, error, isError, isLoading } = useQuery({
  queryKey: ['pilots', id],
  queryFn: () => fetchPilot(id),
})

if (isError) {
  return <LiveSheetErrorState error={error} />
}
```

### Mutation Hooks

```typescript
const mutation = useMutation({
  mutationFn: updatePilot,
  onError: (error) => {
    logger.error('Failed to update pilot:', error)
  },
})
```

## Logging

Use logger utility from `src/lib/logger.ts`:

- `logger.error()` - Always logs (even in production)
- `logger.warn()` - Development only
- `logger.debug()` - Development only

## Permission Checks

### Synchronous (Client-Side)

```typescript
import { isOwner, isGameMediator } from '../lib/permissions'

const canEdit = isOwner(entity.user_id, currentUserId)
const isMediator = isGameMediator(gameMembers, currentUserId)
```

### Async (Server-Side or API)

```typescript
import { assertCanViewGame, PermissionError } from '../lib/permissions'

try {
  await assertCanViewGame(game)
} catch (error) {
  if (error instanceof PermissionError) {
    // Handle permission error
  }
}
```

## Patterns

### In API Clients

- Throw errors for upstream code to handle
- Don't catch and suppress errors unless necessary
- Include context in error messages

### In Components

- Handle TanStack Query errors with `isError` state
- Display user-friendly error messages
- Log errors with `logger.error()` for debugging

### In Error Boundaries

- Catch React rendering errors
- Report errors with `reportError()`
- Display fallback UI that doesn't depend on broken components

# TanStack Router

> **Applies to:** `apps/suref-web/src/routes/**/*.tsx`, `apps/suref-web/src/router.tsx`

TanStack Router patterns for file-based routing in the web app.

## File-Based Routing

- Routes are file-based in `src/routes/` with default exports for route components
- Route tree is auto-generated to `routeTree.gen.ts` (don't edit)
- Use `createRoute()` or `createFileRoute()` from `@tanstack/react-router`

## Route Definition

- Define `beforeLoad` for data prefetching
- Use `loader` for route-level data fetching
- Use `component` for the route component

## Navigation

- Use `useNavigate()` hook for programmatic navigation
- Use `Link` component from `@tanstack/react-router` for links

## Query Parameters

Use `useSearch()` for query params (with `strict: false` for optional params):

```typescript
const search = useSearch({ strict: false })
const pattern = (search as { pattern?: string }).pattern
```

## Data Fetching Strategy

- Prefer `beforeLoad` for server-side data fetching
- Use TanStack Query in components for client-side data
- Pass prefetched data via route context

## Route Context

Access route context via `useRouteContext()`:

```typescript
const { pilotId } = useRouteContext({ from: '/pilots/$id' })
```

- Root route provides `serverUser` in context
- Use context for shared data across route tree

## Import Conventions

Prefer relative imports for all imports:

```typescript
// Correct
import('../../../components/PilotWizard')

// Avoid
import('@/components/PilotWizard')
```

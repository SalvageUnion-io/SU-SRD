# 002: TanStack Query for Server State

**Status:** Accepted

**Context:**
The application needs to manage server state for:
- User authentication
- CRUD operations on pilots, mechs, crawlers, games
- Real-time data synchronization (Supabase subscriptions)
- Optimistic updates for better UX
- Cache management for related entities (e.g., pilot with abilities, equipment)

Previous consideration was given to SWR, but TanStack Query (formerly React Query) was chosen for its superior TypeScript support and mutation handling.

**Decision:**
Use TanStack Query v5 for all server state management with:
- Custom hooks in `src/hooks/` organized by domain (pilot, mech, crawler, game)
- Query key factories for consistent cache keys
- Hydrated hooks for entities with related data (`useHydratedPilot`, `useHydratedMech`)
- Optimistic updates for mutations
- Support for both API-backed and cache-only (local) entities

**Consequences:**

**Positive:**
- Excellent TypeScript inference and type safety
- Powerful caching and invalidation strategies
- Built-in loading and error states
- Optimistic updates improve perceived performance
- Easy to test with query client mocking
- Supports Supabase realtime subscriptions

**Negative:**
- Learning curve for developers unfamiliar with TanStack Query
- Additional bundle size (mitigated by code splitting)
- Need to be careful with query key structure to avoid cache invalidation issues

**References:**
- `src/hooks/` directory structure
- `src/lib/queryClient.ts`
- `.cursor/rules/tanstack-query-hooks.mdc`

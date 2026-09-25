---
paths:
  - 'apps/itun/src/routes/**'
---

# TanStack Router (ITUN)

- File-based routes in `apps/itun/src/routes/`; `src/routeTree.gen.ts` is
  generated — never hand-edit it.
- A route module exports **`Route = createFileRoute('/path')({ … })`** and
  names its component as a local function (`component: NewPilotRoute`). No
  route uses a default export; don't start.
- `validateSearch` parses search params into a typed shape, read with
  `Route.useSearch()` — not `useSearch({ strict: false })` plus a cast.
- `beforeLoad` for guards and redirects (`throw redirect({ … })`), `loader`
  for load-time preparation such as `SalvageUnionReference.preload([...])` or
  snapshot retrieval. Neither reads player entities: those come from the
  stores in the component (see `itun-data-access.md`).
- Crash handling is global. Reporting happens once, in the `createRoot` hooks
  `main.tsx` installs (`reactRootErrorHandlers` in `src/lib/observability.ts`),
  which React calls for every error any boundary catches. The error components
  (`RouteErrorComponent` as the router's `defaultErrorComponent`, and
  `RootErrorComponent`, in `src/components/shared/RouteErrors.tsx`) only
  render. A per-route `errorComponent` must likewise only render — never call
  `captureException` from one, or every crash is reported twice.

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
- Crash handling is global: the router's `defaultErrorComponent` (`main.tsx`,
  `src/components/shared/RouteErrors.tsx`) already reports. Do not add a
  per-route `errorComponent` that reports again.

---
paths:
  - 'apps/cantina/src/routes/**'
---

# TanStack Router (The Cantina)

- **Directory routes only**: one path segment per directory
  (`p/$kind/$appId.tsx`, `starter/index.tsx`), never flat dot names
  (`p.$kind.$appId.tsx`). A trailing `_` un-nests a segment from a same-named
  parent and stays on the directory (`games_/$gameId.tsx` → id
  `/games_/$gameId`, URL `/games/$gameId`).
- A route module exports **`Route = createFileRoute('/path')({ … })`** and
  names its component as a local function (`component: NewPilotRoute`). No
  route uses a default export; don't start.
- **`Route` is the ONLY export.** `autoCodeSplitting` (`vite.config.ts`) can
  only move a component into its own chunk when nothing else in the file is
  exported; a page body "exported for testing" keeps its whole component graph
  in the entry chunk every route downloads. Put a testable body in
  `src/components/` (`src/components/sheet/PublicSheetView.tsx`) and import it
  from both. `routes/__tests__/routeExports.test.ts` enforces it.
- `validateSearch` parses search params into a typed shape, read with
  `Route.useSearch()` — not `useSearch({ strict: false })` plus a cast.
- `beforeLoad` for guards and redirects (`throw redirect({ … })`), `loader`
  for load-time preparation such as store hydration. Not
  for `SalvageUnionReference.preload([...])`: every route renders inside
  `GameDataReady`, whose `preload('all')` is already the gate, so a per-route
  list is pure repetition. Neither reads player entities: those come from the
  stores in the component (see `cantina-data-access.md`).
- Crash handling is global. Reporting happens once, in the `createRoot` hooks
  `main.tsx` installs (`reactRootErrorHandlers` in `src/lib/observability.ts`),
  which React calls for every error any boundary catches. The error components
  (`RouteErrorComponent` as the router's `defaultErrorComponent`, and
  `RootErrorComponent`, in `src/components/shared/RouteErrors.tsx`) only
  render. A per-route `errorComponent` must likewise only render — never call
  `captureException` from one, or every crash is reported twice.

---
paths:
  - 'apps/web/src/routes/**'
---

# TanStack Router (the client app)

- **Directory routes only**, one segment per directory (`p/$kind/$appId.tsx`),
  never dot names. A trailing `_` un-nests a segment (`a_/$id.tsx` → URL
  `/a/$id`).
- **`Route = createFileRoute('/path')({ … })` is the only export**, its
  component a local function: anything else exported keeps the page's graph in
  the entry chunk. A body worth testing lives in its area
  (`src/build/sheet/PublicSheetView.tsx`) and is imported from both.
- `validateSearch` + `Route.useSearch()`, never `useSearch({ strict: false })`
  plus a cast.
- `beforeLoad` for guards and redirects, `loader` for load-time preparation
  such as store hydration; never a per-route `SalvageUnionReference.preload`
  (`GameDataReady` already preloads all) and never player entities (those come
  from the stores in the component).
- Crash reporting happens once, in `main.tsx`'s `createRoot` hooks; an
  `errorComponent` only renders, never calls `captureException`.

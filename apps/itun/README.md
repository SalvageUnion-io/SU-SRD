# In The Union Now (ITUN)

Local-first character builder and game manager for [Salvage Union](https://leyline.press/).
React 19 + TanStack Router, Tailwind v4, Zustand write-through stores over
IndexedDB (`idb`). No auth, no backend for user data — everything lives in the
browser. Shared UI comes from `component-lib`; game data from
`salvageunion-reference`.

## Development

```bash
# from the repo root
bun install && bun run build:package   # first-time setup
bun run dev:itun                       # vite dev server
bun --filter itun test     # tests (bun test runner)
```

## Snapshot publishing in dev

Sharing publishes read-only snapshots to **R2** through the Worker at
`src/worker/index.ts`, which owns `/api/snapshots` and `/api/snapshots/:id`
(ADR-004 as amended by ADR-033). `vite dev` serves the SPA only and never runs
that Worker, so `vite.config.ts` proxies those paths to a local `wrangler dev`:

```bash
# terminal 1 — the Worker, with local R2, on port 8787
cd apps/itun && bunx wrangler dev

# terminal 2 — the app
bun run dev:itun
```

Without it, publish requests fail with a connection error and the UI's
feature-detection treats publishing as unavailable; the rest of the app is
unaffected.

> This section previously told you to run `bunx netlify functions:serve` against
> `netlify/functions/snapshot-publish.ts` and `snapshot-retrieve.ts` on port
> 9999. Those files, and every other trace of Netlify, were deleted in ADR-033
> P7 — so local snapshot publishing had been broken ever since, silently: no
> test covers the dev proxy and no CI job runs it.

## Data durability

- **IndexedDB schema**: database `itun-v1`, version pinned in
  `src/lib/db/index.ts` (`DB_VERSION`). Object-store creation lives in the
  `upgrade` callback; record rewrites live in `src/lib/db/migrations/` —
  one file per version (see that directory's README).
- **Salvage-path reads**: records that fail strict Zod validation are
  re-parsed with unknown keys stripped (console warning) and only skipped as
  a last resort — one drifted record never bricks a store.
- **Multi-tab**: writes broadcast store invalidations over a
  `BroadcastChannel` (localStorage fallback) so concurrent tabs re-read
  instead of clobbering each other.
- **Backups**: export (Download all) is the only backup path for local-first
  data. `src/lib/backupNudge.ts` tracks un-exported writes and exposes a
  toast-ready nudge subscription.

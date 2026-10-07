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

## Sharing, and old snapshot links, in dev

Sharing is the live public sheet (`/p/:kind/:appId`, ADR-032): a Convex column
and query, so it works under `bun run dev:itun` against a Convex deployment.
Frozen snapshots are retired (ADR-036). An old `/s/:id` link asks the Worker at
`src/worker/index.ts` which entity it names (`GET /api/snapshots/:id`) and
redirects to that entity's public sheet if it has one. `vite dev` never runs
that Worker, so `vite.config.ts` proxies the path to a local `wrangler dev`:

```bash
# terminal 1 — the Worker, with local R2, on port 8787
cd apps/itun && bunx wrangler dev

# terminal 2 — the app
bun run dev:itun
```

Without it, every `/s/:id` shows the retired page; the rest of the app is
unaffected.

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
  data.

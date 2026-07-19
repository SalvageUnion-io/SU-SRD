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

Sharing publishes read-only snapshots to Netlify Blobs via two Netlify
Functions (`netlify/functions/snapshot-publish.ts`, `snapshot-retrieve.ts`)
routed under `/api/snapshots` (see `netlify.toml` and ADR-004). Plain
`vite dev` has no Netlify redirect layer, so `vite.config.ts` proxies
`/api/snapshots` to a locally-running functions server:

```bash
# terminal 1 — functions on port 9999
bunx netlify functions:serve

# terminal 2 — the app
bun run dev:itun
```

Without the functions server, publish requests fail with a connection error
and publishing is treated as unavailable; the rest of the app is unaffected.
(Alternatively `netlify dev` serves app + functions together on port 8888.)

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

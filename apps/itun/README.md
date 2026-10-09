# In The Union Now (ITUN)

Character builder and game manager for [Salvage Union](https://leyline.press/).
React 19 + TanStack Router, Zustand write-through stores over an IndexedDB
cache (`idb`), and Convex as the server of record for accounts and Games
(ADR-030). Shared UI comes from `component-lib`; game data from
`salvageunion-reference`.

## Development

```bash
# from the repo root
bun install && bun run build:package   # first-time setup
bun run dev:itun                       # vite on a local Convex backend
bun --filter itun test     # tests (bun test runner)
```

## Local backend

`bun run dev:itun` runs `convex dev --start vite` on a **local** Convex
deployment, on this machine: there is no cloud dev deployment. It pushes
`convex/` on every save and writes `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL` and
`VITE_CONVEX_SITE_URL` into `apps/itun/.env.local`. Sign-in is the e2e test
seam, not Discord: the `dev` script sets `VITE_TEST_AUTH=true`, and the
deployment needs `ITUN_TEST_AUTH`. Production has neither.

One-time setup, from `apps/itun`:

```bash
# Pick a local deployment. Not signed in to Convex: run `bun run dev:itun` and
# choose "Start without an account (run Convex locally)". Signed in, or with a
# .env.local that names a cloud deployment:
bunx convex dev --configure existing --team alex-jarvis --project suref-itun \
  --dev-deployment local --once

# Then, with `bun run dev:itun` running, in a second terminal:
bunx @convex-dev/auth --web-server-url http://localhost:5173   # SITE_URL + JWT keys
bunx convex env set ITUN_TEST_AUTH true
```

To sign in, run `await __itunTestSignIn('<any email>', '<8+ char password>')`
in the browser console on `http://localhost:5173`. Each call signs up a new
password account (a repeated email is refused); the session survives reloads.
`bun run e2e:itun` starts `dev:itun` itself (or reuses a running one), so its
signed-in specs always run locally, and fail until this setup is done.

## Sharing in dev

Sharing is the live public sheet (`/p/:kind/:appId`, ADR-032): a Convex column
and query, so it works under `bun run dev:itun` against the local backend. An
old snapshot link (`/s/:id`) shows a static retired page (ADR-036).

## Data durability

- **IndexedDB schema**: database `itun-v1`, version pinned in
  `src/lib/db/index.ts` (`DB_VERSION`). The database is a cache of Convex, so
  an upgrade rewrites nothing: it drops every store and creates the current
  set empty, and `ShelfSync` refills it on the next signed-in load.
- **Salvage-path reads**: records that fail strict Zod validation are
  re-parsed with unknown keys stripped (console warning) and only skipped as
  a last resort — one drifted record never bricks a store.
- **Multi-tab**: there is no tab-to-tab channel. Each tab's own Convex
  subscription (`ShelfSync`) adopts another tab's creates and edits and
  forgets its deletes, under the prune rules in `src/lib/db/pruneRules.ts`.
- **Backups**: export (Download all) writes the signed-in player's pilots,
  mechs, crawlers and soft links to one JSON file.

# In The Union Now (ITUN)

Character builder & game manager for [Salvage Union](https://leyline-press.itch.io/salvage-union). React + Supabase SPA for players and mediators running a SU campaign.

## Quick start

```bash
# from repo root
bun install
bun run build:package   # build salvageunion-reference (required once)
bun run dev:itun        # start ITUN dev server
```

Environment: copy `.env.example` to `.env` and populate the Supabase URL + anon key.

## Scripts

Run from the repo root:

| Script                               | What it does                                            |
| ------------------------------------ | ------------------------------------------------------- |
| `bun run dev:itun`                   | Dev server                                              |
| `bun run build:itun`                 | Production build                                        |
| `bun --filter in-the-union-now test` | Run ITUN tests                                          |
| `bun run typecheck`                  | Typecheck all packages                                  |
| `bun run check:all`                  | Full CI suite (lint, format, typecheck, test, validate) |

## Tech stack

React 19 + Vite, TanStack Router (file-based), TanStack Query, Zustand, ShadCN + Tailwind v4, Supabase, Zod validation.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — stack-specific conventions for this app
- [`plan-docs/`](plan-docs/) — design docs for in-progress features
- [`/docs/architecture/data-flow.md`](../../docs/architecture/data-flow.md) — how reference + player data hydrate
- [`/docs/architecture/display-system.md`](../../docs/architecture/display-system.md) — entity rendering stack
- [`/docs/README.md`](../../docs/README.md) — docs navigation hub

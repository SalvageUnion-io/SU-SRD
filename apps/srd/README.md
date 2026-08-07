# SURef Web

Static SRD reference site for [Salvage Union](https://leyline-press.itch.io/salvage-union). Built by an in-house static-site generator (`ssg/`) over Vite, with React 19 islands. No auth, no backend. **Not Astro** — see [`ssg/DESIGN.md`](ssg/DESIGN.md).

## Quick start

```bash
# from repo root
bun install
bun run build:package   # build salvageunion-reference (required once)
bun run dev             # start reference site dev server
```

## Scripts

Run from the repo root:

| Script                  | What it does                                      |
| ----------------------- | ------------------------------------------------- |
| `bun run dev`           | Dev server (`bun ssg/dev.ts`, Vite in middleware) |
| `bun run build`         | Full production build (package + site)            |
| `bun --filter srd test` | Run srd tests                                     |
| `bun run typecheck`     | Typecheck all packages (TypeScript 7)             |

And from `apps/srd/` itself:

| Script                  | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `bun ssg/build.ts`      | Build the static site into `dist/`                            |
| `bun run gate`          | **Output gate** — build, then diff `dist` against the snapshot |
| `bun run snapshot:update` | Re-bless the snapshot after an intentional output change     |

## Tech stack

In-house SSG at [`ssg/`](ssg/) (static output) + React 19 islands, Vite 8 for the
client bundle, Tailwind v4, in-memory search via `salvageunion-reference`'s
`search()`. Deployed to Netlify.

Two things worth knowing before you touch it:

- **`ssg/snapshot.ts` is the output gate.** `bun run gate` builds and diffs the
  result against `ssg/output-snapshot.json` — the emitted file set, per-page head
  metadata and JSON-LD, a digest of every page's `<main>` text, all 899 JSON
  endpoints and `llms.txt`. It runs in CI. When output changes on purpose, run
  `bun run snapshot:update` and commit the snapshot: one line per page, so the
  diff is the reviewable record of what changed.
- **No `.css` import may be reachable from an SSR module.** The SSR pass runs under
  Bun with no Vite in the loop. All css comes from `src/runtime/styles.entry.ts`, a
  client-bundle entry.

## Routes

- `/` — landing + search
- `/schema/[schemaId]` — schema index (e.g. chassis, classes, equipment)
- `/schema/[schemaId]/item/[itemId]` — individual entity pages
- `/schema/[schemaId]/item/[itemId]/pattern/[patternId]` — chassis patterns
- `/schema/{schemaId}.json`, `/schema/{schemaId}.schema.json`,
  `/schema/{schemaId}/item/{itemId}.json` — JSON API for third-party consumers
  (endpoint modules, not routes: `src/endpoints/`)
- `/about`, `/api`, `/changelog`, `/search`, `/discord`, `/bot/privacy`,
  `/bot/terms`, `/404`

Every one of them is declared in [`ssg/routes.ts`](ssg/routes.ts) — routing is
explicit, not file-based. A page not listed there is not built.

## Documentation

- [`ssg/DESIGN.md`](ssg/DESIGN.md) — **the SSG contract.** Read this first
- [`CLAUDE.md`](CLAUDE.md) — stack-specific conventions
- [`/docs/architecture/seo-accessibility.md`](../../docs/architecture/seo-accessibility.md) — SEO + a11y patterns
- [`/docs/architecture/display-system.md`](../../docs/architecture/display-system.md) — entity rendering
- [`/docs/README.md`](../../docs/README.md) — docs navigation hub

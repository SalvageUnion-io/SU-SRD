# SURef Web

Static SRD reference site for [Salvage Union](https://leyline-press.itch.io/salvage-union). Astro 5 + React 19 islands. No auth, no backend.

## Quick start

```bash
# from repo root
bun install
bun run build:package   # build salvageunion-reference (required once)
bun run dev             # start reference site dev server
```

## Scripts

Run from the repo root:

| Script                        | What it does                           |
| ----------------------------- | -------------------------------------- |
| `bun run dev`                 | Dev server (Astro)                     |
| `bun run build`               | Full production build (package + site) |
| `bun --filter suref-web test` | Run suref-web tests                    |
| `bun run typecheck`           | Typecheck all packages                 |

## Tech stack

Astro 5 (static output) + React 19 islands, Tailwind v4, Pagefind for search indexing. Deployed to Netlify.

## Routes

- `/` — landing + search
- `/schema/[schemaId]` — schema index (e.g. chassis, classes, equipment)
- `/schema/[schemaId]/item/[itemId]` — individual entity pages
- `/schema/v1/*.json` — JSON API for third-party consumers
- `/about`, `/404`

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — stack-specific conventions
- [`/docs/architecture/seo-accessibility.md`](../../docs/architecture/seo-accessibility.md) — SEO + a11y patterns
- [`/docs/architecture/display-system.md`](../../docs/architecture/display-system.md) — entity rendering
- [`/docs/README.md`](../../docs/README.md) — docs navigation hub

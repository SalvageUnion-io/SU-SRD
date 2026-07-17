# SURef Web (Static Reference Site)

Static SRD reference site for Salvage Union game data. Architecture rationale:
[ADR-012](../../docs/adrs/ADR-012-srd-astro-static.md) (Astro static + React
islands). Read-only — choices render ephemerally/non-editably
([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)).

## Stack

- **Framework:** Astro 5 with React 19 islands architecture
- **Output:** Static site (no SSR, no auth, no backend)
- **UI:** Tailwind v4 with theme from `component-lib` package
- **Components:** Shared components from `component-lib`, React islands for interactivity
- **Game data:** `salvageunion-reference` workspace package
- **Deployment:** Netlify (static)

## Architecture

### Astro + React Islands

- Astro pages in `src/pages/` handle routing and layout
- React components hydrate as islands using `client:load` or `client:visible`
- Islands live in `src/components/islands/`
- Keep islands small - only hydrate what needs interactivity

### Routes (File-Based via Astro)

- `/` - Landing page
- `/schema/[schemaId]` - Schema list view
- `/schema/[schemaId]/item/[itemId]` - Individual item view
- `/about` - About page
- `/404` - Not found

## Key Directories

- `src/pages/` - Astro file-based routes
- `src/components/islands/` - React island components
- `src/components/` - Astro and layout components
- `src/layouts/` - Astro layout templates

## Conventions

- **No auth, no backend, no user data** - pure static reference
- Search: In-memory via `salvageunion-reference` package `search()` function
- Cmd+K/Ctrl+K shortcut to focus search
- Imports from `component-lib` for shared UI components
- Dev command: `bun run dev`

## Changelog (generated)

The `/changelog` page (`src/pages/changelog.astro`) is rendered **at build time**. Its
frontmatter reads two markdown files with `node:fs` and merges them via the shared
`parseChangelog` / `mergeChangelogs` helpers from `suref-react`, then renders `ChangelogView`:

- `apps/suref-web/CHANGELOG.md` — changes to this site and its companion tools (area badge **Site**)
- `packages/salvageunion-reference/CHANGELOG.md` — changes to the game-data package (area badge **Data**)

Both files are **maintained by release-please** from conventional-commit PR titles (see
[ADR-024](../../docs/adrs/ADR-024-derived-release-changelogs.md)). Entries are
merged newest-first by date across both sources.

**Do NOT hand-edit `CHANGELOG.md`.** The only allowed manual touch is optionally polishing the
entries in an **open release PR** before merging it. Otherwise the changelog is derived entirely
from PR titles:

- Write a clear conventional PR title (`feat:` / `fix:` …) — it becomes the changelog entry.
- No per-commit or per-PR array bookkeeping is needed anymore; the release PR accumulates entries.

Historical entries (everything predating automation, marked in the file header) are backfilled in
the legacy `## <date> — <title>` heading shape, which `parseChangelog` also understands.

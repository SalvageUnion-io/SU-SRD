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

## Changelog Maintenance

The `/changelog` page (data in `src/lib/changelog.ts`) lists major changes to the site. When you make a major change, prepend a new entry at the top of the `CHANGELOG` array.

**One entry per PR (or per release).** Changelog entries are PR-scoped, not commit-scoped. Do not add a new entry for every intra-PR change — when iterating on a branch, edit the existing entry to reflect the final shape of the PR. The entry should describe the PR's final state, not its history. If a PR has no existing entry yet, add one. If it already has one, update it in place.

**What counts as major (add an entry):**

- New top-level page or navigation item
- New schema added to the Denizens / Pilot / Mech / Crawler / Reference catalog
- A new feature surfaced to users (search behaviour, filters, randomizer mode, API endpoints, etc.)
- A visible UX overhaul (mobile navigation, layout, typography system, etc.)
- A user-visible bug fix that changed behaviour they would have noticed (mobile overflow, broken links, missing entities)

**What does NOT count (do not add):**

- Internal refactors with no user-facing change
- Test additions
- Dependency bumps unless they change behaviour
- Minor copy edits or title tweaks (including easter egg renames — e.g. greembeem)
- Changes in other apps (`in-the-union-now`, `discord-bot`) or in shared packages that aren't surfaced through the srd UI

Keep entries to 1-2 sentences, with `date` in `YYYY-MM-DD` form.

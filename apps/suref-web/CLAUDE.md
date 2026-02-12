# SURef Web (Static Reference Site)

Static SRD reference site for Salvage Union game data.

## Stack

- **Framework:** Astro 5 with React 19 islands architecture
- **Output:** Static site (no SSR, no auth, no Supabase)
- **UI:** Tailwind v4 with theme from `suref-react` package
- **Components:** Shared components from `suref-react`, React islands for interactivity
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
- `/randsum` - Random table roller
- `/404` - Not found

## Key Directories

- `src/pages/` - Astro file-based routes
- `src/components/islands/` - React island components
- `src/components/` - Astro and layout components
- `src/layouts/` - Astro layout templates

## Conventions

- **No auth, no Supabase, no user data** - pure static reference
- Search: In-memory via `salvageunion-reference` package `search()` function
- Cmd+K/Ctrl+K shortcut to focus search
- Imports from `suref-react` for shared UI components
- Dev command: `bun run dev`

# In The Union Now (ITUN)

Character builder & game manager for Salvage Union.

## Stack

- **Framework:** React 19 + Vite
- **Routing:** TanStack Router (file-based in `src/routes/`)
- **Server state:** TanStack Query
- **Client state:** Zustand stores (not React Context)
- **UI:** ShadCN + Tailwind v4 + Radix primitives
- **Validation:** Zod schemas in `src/lib/validation.ts`
- **Backend:** Supabase (auth, DB, RLS)
- **Game data:** `salvageunion-reference` workspace package

## Supabase

- **Project ID:** `dshtuchbleipwqacyokz`
- **Region:** us-east-2
- **Auth:** Email/password via Zustand `authStore` (no OAuth)

### Database Tables

All tables have RLS enabled:

- `pilots` - Player characters
- `mechs` - Mech builds
- `crawlers` - Crawler vehicles
- `entity_refs` - References to game data items
- `player_choices` - Player selections for customizable options
- `cargo` - Inventory items

### Enums

- `parent_type`: pilot, mech, crawler
- `item_condition`: intact, damaged, destroyed

### Type Generation

After DB schema changes, use Supabase MCP `generate_typescript_types` tool and update `src/types/database-generated.types.ts`.

## Key Directories

- `src/routes/` - TanStack Router file-based routes (default exports OK)
- `src/components/ui/` - ShadCN component primitives
- `src/components/` - Feature components
- `src/hooks/` - TanStack Query hooks with key factories
- `src/lib/api/` - Supabase API functions
- `src/lib/stores/` - Zustand stores
- `src/lib/validation.ts` - Zod schemas

## Conventions

- Custom Tailwind theme in `src/index.css` with `@theme` block (SU brand colors)
- Use `cn()` utility for conditional class merging
- ShadCN over any other UI library
- Zustand + TanStack Query for state (never React Context)
- Dev command: `bun run dev:itun`

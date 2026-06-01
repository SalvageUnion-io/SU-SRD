# Phase 1 — Foundation & Thematic Setup — Architecture

## App Shell

ITUN mirrors suref-web's canonical design language: monospace typography (Fira Code), SU brand colors, pseudoheader section labels, catalog-style cards, and entity display components from suref-react.

### Layout Structure

```
+---------------------------------------------+
|  Nav Bar (sticky top, bg-su-black)           |
|  [ITUN logo/title]  [nav links]  [user menu] |
+---------------------------------------------+
|                                              |
|  <main> (flex-1, max-w-4xl, centered)        |
|                                              |
|    Route content (Outlet)                    |
|                                              |
+---------------------------------------------+
|  Footer (shared from suref-react)            |
|  [Leyline Press attribution + logo]          |
+---------------------------------------------+
```

- **Nav bar**: Sticky top. Background `su-black`, text `su-white`. Contains app title, navigation links (Dashboard, Patterns), and user menu (email + sign out).
- **Main content**: `flex-1` with `max-w-4xl mx-auto px-4`. Scrollable. Route outlet renders here.
- **Footer**: React port of the Astro Footer from suref-web. Lives in suref-react so both apps share it. Contains Leyline Press copyright, OGL link, image permission note, and "Powered by Salvage" logo.

### Authenticated Layout

The `_authenticated` route layout wraps all protected routes:

```
_authenticated.tsx
+-- index.tsx              -> Dashboard
+-- patterns/              -> (Phase 2)
+-- pilots/                -> (Phase 3)
+-- mechs/                 -> (Phase 3)
+-- crawlers/              -> (Phase 4)
login.tsx                  -> Login/signup (outside _authenticated)
```

### Auth Guard

The `_authenticated` layout checks auth state in `beforeLoad`:

```typescript
beforeLoad: () => {
  const { user } = useAuthStore.getState()
  if (!user) throw redirect({ to: '/login' })
}
```

---

## Database Schema

### Enums

```sql
-- Enum: which entity type a polymorphic row belongs to
CREATE TYPE parent_type AS ENUM ('pilot', 'mech', 'crawler');

-- Enum: condition of a system/module/bay/chassis
-- IMPORTANT: "damaged" means INOPERABLE, not "has taken damage".
-- intact = fully functional, damaged = inoperable (cannot be used), destroyed = permanently gone.
-- Applies to: systems, modules, crawler bays, chassis components.
CREATE TYPE item_condition AS ENUM ('intact', 'damaged', 'destroyed');
```

### Tables

#### campaigns

```sql
CREATE TABLE campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  crawler_id  uuid REFERENCES crawlers(id) ON DELETE SET NULL,
  invite_code text UNIQUE,
  archived    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_invite ON campaigns(invite_code);
```

#### campaign_members

```sql
CREATE TABLE campaign_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'player',  -- 'mediator' | 'player'
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);
```

#### crawlers

```sql
CREATE TABLE crawlers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crawler_ref text NOT NULL,
  name        text,
  tag         text,
  tech_level  smallint NOT NULL DEFAULT 1,
  current_sp  smallint NOT NULL DEFAULT 20,
  max_sp      smallint NOT NULL DEFAULT 20,
  upkeep      smallint NOT NULL DEFAULT 5,
  upgrade_pool smallint NOT NULL DEFAULT 0,
  -- Scrap inventory tracked per tech level (the communal budget pilots draw from)
  scrap_tl1   smallint NOT NULL DEFAULT 0,
  scrap_tl2   smallint NOT NULL DEFAULT 0,
  scrap_tl3   smallint NOT NULL DEFAULT 0,
  scrap_tl4   smallint NOT NULL DEFAULT 0,
  scrap_tl5   smallint NOT NULL DEFAULT 0,
  scrap_tl6   smallint NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawlers_user ON crawlers(user_id);
```

#### mechs

```sql
CREATE TABLE mechs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chassis_ref   text NOT NULL,
  pattern_name  text,
  current_sp    smallint NOT NULL DEFAULT 0,
  max_sp        smallint NOT NULL DEFAULT 0,
  current_ep    smallint NOT NULL DEFAULT 0,
  max_ep        smallint NOT NULL DEFAULT 0,
  heat_capacity smallint NOT NULL DEFAULT 0,
  current_heat  smallint NOT NULL DEFAULT 0,
  cargo_capacity smallint NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mechs_user ON mechs(user_id);
```

**Note on circular FK**: `pilots.mech_id -> mechs.id` creates a potential ordering issue. The migration handles this by creating `mechs` first without the FK, then creating `pilots`, then adding the FK via `ALTER TABLE`. Alternatively, both tables are created and the FK is added as a deferred constraint.

#### pilots

```sql
CREATE TABLE pilots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_ref   text NOT NULL,
  callsign    text NOT NULL,
  hp          smallint NOT NULL DEFAULT 10,
  max_hp      smallint NOT NULL DEFAULT 10,
  ap          smallint NOT NULL DEFAULT 5,
  max_ap      smallint NOT NULL DEFAULT 5,
  tp          smallint NOT NULL DEFAULT 0,
  crawler_id  uuid REFERENCES crawlers(id) ON DELETE SET NULL,
  mech_id     uuid UNIQUE REFERENCES mechs(id) ON DELETE SET NULL,
  visible     boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pilots_user ON pilots(user_id);
CREATE INDEX idx_pilots_crawler ON pilots(crawler_id);
```

#### mech_patterns

```sql
CREATE TABLE mech_patterns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chassis_ref   text NOT NULL,
  name          text NOT NULL,
  description   text,
  pattern_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  visible       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mech_patterns_user ON mech_patterns(user_id);
```

#### entity_refs

```sql
CREATE TABLE entity_refs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id      uuid NOT NULL,
  parent_type    parent_type NOT NULL,
  schema_name    text NOT NULL,
  schema_ref_id  text NOT NULL,
  condition      item_condition NOT NULL DEFAULT 'intact',
  sort_order     smallint NOT NULL DEFAULT 0,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_refs_user ON entity_refs(user_id);
CREATE INDEX idx_entity_refs_parent ON entity_refs(parent_id, parent_type);
CREATE INDEX idx_entity_refs_schema ON entity_refs(schema_name, schema_ref_id);
```

#### player_choices

```sql
CREATE TABLE player_choices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id        uuid,
  parent_type      parent_type,
  entity_ref_id    uuid REFERENCES entity_refs(id) ON DELETE CASCADE,
  guide_step_id    text,
  choice_id        text NOT NULL,
  choice_type      text NOT NULL DEFAULT 'permanent',
  selected_value   text,
  selected_values  jsonb,
  roll_value       smallint,
  parent_choice_id uuid REFERENCES player_choices(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_choices_user ON player_choices(user_id);
CREATE INDEX idx_player_choices_parent ON player_choices(parent_id, parent_type);
CREATE INDEX idx_player_choices_entity_ref ON player_choices(entity_ref_id);
```

#### cargo

```sql
CREATE TABLE cargo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id      uuid NOT NULL,
  parent_type    parent_type NOT NULL,
  name           text NOT NULL,
  schema_name    text,
  schema_ref_id  text,
  amount         smallint NOT NULL DEFAULT 1,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cargo_user ON cargo(user_id);
CREATE INDEX idx_cargo_parent ON cargo(parent_id, parent_type);
```

#### change_log

```sql
CREATE TABLE change_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id   uuid NOT NULL,
  target_type text NOT NULL,
  action      text NOT NULL,
  field       text,
  old_value   jsonb,
  new_value   jsonb,
  description text,
  session_id  uuid,
  reversible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_log_user ON change_log(user_id);
CREATE INDEX idx_change_log_target ON change_log(target_id, target_type);
CREATE INDEX idx_change_log_session ON change_log(session_id);
CREATE INDEX idx_change_log_created ON change_log(created_at DESC);
```

### Updated Timestamp Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crawlers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pilots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mechs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mech_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON entity_refs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON player_choices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cargo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### RLS Policies (Base — Owner Only)

All tables use per-user isolation. Extended policies (visibility, crew access) are added in Phase 5.

```sql
-- Template applied to each table:
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own {table}"
  ON {table} FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own {table}"
  ON {table} FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own {table}"
  ON {table} FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own {table}"
  ON {table} FOR DELETE
  USING (auth.uid() = user_id);
```

Applied to: `crawlers`, `pilots`, `mechs`, `mech_patterns`, `entity_refs`, `player_choices`, `cargo`.

**`change_log`** uses restricted RLS — append-only (INSERT + SELECT, no UPDATE/DELETE):

```sql
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own change_log"
  ON change_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own change_log"
  ON change_log FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**`campaigns`** uses `created_by` (not `user_id`) — basic creator-only RLS in Phase 1, replaced with member-based RLS in Phase 5:

```sql
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator can manage campaign"
  ON campaigns FOR ALL USING (auth.uid() = created_by);

ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memberships"
  ON campaign_members FOR SELECT USING (auth.uid() = user_id);
```

Campaign table RLS is different (member-based, not user_id) — see Phase 5 ARCHITECTURE.

### Migration Order

Due to FK dependencies, tables must be created in this order:

1. Enums (`parent_type`, `item_condition`)
2. `campaigns` (FK to auth.users only)
3. `campaign_members` (FK to campaigns, auth.users)
4. `crawlers` (no FKs to other app tables)
5. `mechs` (no FKs to other app tables)
6. `pilots` (FKs to `crawlers` and `mechs`, `visible` column)
7. `mech_patterns` (`visible` column)
8. `entity_refs` (app-enforced parent FK)
9. `player_choices` (FK to `entity_refs`, self-referential)
10. `cargo` (app-enforced parent FK)
11. `change_log` (no FKs to other app tables)
12. `update_updated_at()` trigger function + triggers on all tables with `updated_at`
13. RLS policies on all tables

---

## DisplayCard: Extracted Entity Display Shell

### Motivation

The EntityDisplay's visual structure — thick colored header, content area, colored footer — is the central thematic element of ITUN. Character sheets, pattern builder, crawler view, and other non-entity screens will all live inside this same card shell. Currently this structure is baked into `Card.tsx` + `EntityDisplay`, tightly coupled to entity data.

We extract the **visual shell** into a new `DisplayCard` component in suref-react that provides the header/content/footer shape with themed colors, independent of entity data. `EntityDisplay` refactors to use `DisplayCard` internally, and ITUN uses `DisplayCard` directly for non-entity screens.

### DisplayCard Component

Lives in `packages/suref-react/src/components/shared/DisplayCard.tsx`.

```typescript
type DisplayCardMode = 'full' | 'compact' | 'listing'

type DisplayCardProps = {
  /** Background color class for header and footer (e.g., "bg-su-green") */
  headerBg: string
  /** Optional CSS color for border derivation */
  headerBgColor?: string
  /** Content rendered inside the header bar */
  headerContent: ReactNode
  /** Content rendered inside the footer bar (optional) */
  footerContent?: ReactNode
  /** Main body content */
  children: ReactNode
  /** Optional pseudoheader label above the card */
  label?: string
  /** Display mode:
   *  - "full" (default): Standard card with header, body, footer
   *  - "compact": Reduced spacing and typography for inline/grid use
   *  - "listing": Minimal header-only clickable row (entity name + key stats)
   *    — body and footer are hidden; header is the entire card
   */
  mode?: DisplayCardMode
  /** @deprecated Use mode="compact" instead */
  compact?: boolean
  /** onClick handler (primarily used in listing mode for clickable rows) */
  onClick?: () => void
  /** Additional className on the outer wrapper */
  className?: string
}
```

**Visual structure:**

```
+--------------------------------------+
| HEADER (thick, colored bg)           |
| [headerContent -- fully customizable]|
+--------------------------------------+
|                                      |
| BODY (white bg, padded)              |
| [children]                           |
|                                      |
+--------------------------------------+
| FOOTER (thin, colored bg)            |
| [footerContent]                      |
+--------------------------------------+
```

- **Full mode**: Header (`rounded-t-sm`, background from `headerBg`, min-height 80px), body (white background, padded), footer (matching header color, `rounded-b-sm`). Shadow: `shadow-lg rounded-md overflow-hidden`.
- **Compact mode**: Same structure as full, but reduced header min-height (60px), tighter padding, smaller typography. Used in grids of cards (e.g., Pattern Builder system/module slots).
- **Listing mode**: Header-only presentation — body and footer are hidden. The entire card is a clickable row showing entity name and key stats in the header area. Reduced height (~40px). Used in selection lists, roster grids, and EntitySelectionModal results. `onClick` prop activates click behavior.
- Border derivation from header bg via existing `borderColorFromHeaderBg()`

### Refactoring EntityDisplay

`EntityDisplay` refactors its rendering to use `DisplayCard`:

```tsx
<DisplayCard
  headerBg={headerBg}
  headerContent={<EntityHeader entity={data} ... />}
  footerContent={<EntityFooter entity={data} ... />}
  label={label}
  compact={compact}
>
  <EntityDisplayContent ... />
</DisplayCard>
```

This is an internal refactor — `EntityDisplay`'s public API does not change.

---

## InteractiveStatDisplay: Editable Stat Controls

### Motivation

Pilot sheets show HP/AP/TP and mech sheets show SP/EP/Heat as key stats. During gameplay (Phase 6), players need to quickly adjust these values. The `InteractiveStatDisplay` provides +/− buttons wrapped around the familiar `ValueDisplay` visual style from EntityDisplay. Built in Phase 1 so consuming components in all later phases can use it immediately.

### Component

Lives in `packages/suref-react/src/components/shared/InteractiveStatDisplay.tsx`.

```typescript
type InteractiveStatDisplayProps = {
  /** Display label (e.g., "HP", "SP", "Heat") */
  label: string
  /** Current value */
  value: number
  /** Maximum value (for display and upper bound) */
  max: number
  /** Minimum value (default: 0) */
  min?: number
  /** Callback when value changes */
  onChange: (newValue: number) => void
  /** Color treatment for the stat (uses entity color classes) */
  color?: string
  /** Whether the control is disabled (e.g., mech destroyed) */
  disabled?: boolean
  /** Size variant matching ValueDisplay sizing */
  size?: 'sm' | 'md'
}
```

### Visual Layout

```
+---------------------------+
|         HP                |
|   [−]  8 / 10  [+]       |
+---------------------------+
```

- Matches `ValueDisplay` typography and spacing (monospace, same font sizes)
- +/− buttons: Small square buttons flanking the current/max display
- `−` disabled when `value <= min`
- `+` disabled when `value >= max`
- When `disabled`: entire control is dimmed, buttons inactive
- Color follows entity type convention (e.g., pilot stats use su-blue, mech stats use su-green)

### Read-Only Fallback

When no `onChange` is provided (or for export/print views), `InteractiveStatDisplay` gracefully degrades to standard `ValueDisplay` rendering (no buttons, just the stat display). This means components can conditionally enable editing without swapping components.

---

## Footer (React Port in suref-react)

`packages/suref-react/src/components/shared/Footer.tsx`:

```typescript
type FooterProps = {
  poweredBySalvageUrl: string // Asset URL passed by consuming app
}
```

Content identical to the Astro version:

- Leyline Press copyright with link
- OGL link
- Image permission notice
- "Powered by Salvage" logo

Exported from `suref-react/src/index.ts` barrel. Both suref-web and ITUN import this component directly — suref-web renders it as a static React component in `BaseLayout.astro`, ITUN renders it in `AppShell.tsx`. Both apps serve the logo from their respective `public/` directories and pass the URL via `poweredBySalvageUrl`.

---

## Routing

TanStack Router with file-based routing under `src/routes/`.

### Route Tree (Phase 1)

```
src/routes/
+-- __root.tsx                    # Root layout (html/body, providers, auth init)
+-- login.tsx                     # Login/signup page
+-- auth/
|   +-- callback.tsx              # OAuth callback
+-- _authenticated.tsx            # Protected layout (nav + footer)
    +-- index.tsx                 # Dashboard (skeleton)
```

Later phases add routes under `_authenticated/` for patterns, pilots, mechs, crawlers.

---

## Design Language

### Canonical Source: suref-web

ITUN mirrors suref-web's visual identity:

- **Font**: Fira Code (monospace) for all text
- **Colors**: SU brand palette via CSS custom properties (`--su-orange`, `--su-black`, `--su-white`, `--su-grey-*`)
- **Pseudoheaders**: Black background labels for section titles (using `Text variant="pseudoheader"` from suref-react)
- **Catalog cards**: Grid of clickable cards with colored left borders and entity-specific background tints (from `getCatalogBg()`)
- **Entity displays**: Full entity rendering via suref-react's entity display system
- **Spacing**: Consistent `max-w-4xl` container, `gap-3` grids, `px-4` horizontal padding

### Design Principles

- **Maximize screen real estate**: All screens should be space-efficient, showing as much relevant content as possible without wasted space. Dense but readable layouts.
- **Visual consistency with suref-web**: Every visual element in ITUN should resemble its suref-web counterpart. Stats use `ValueDisplay` (extended by `InteractiveStatDisplay`), entities use `EntityDisplay` (via `DisplayCard`), sections use pseudoheaders, colors match entity type conventions.
- **Extension, not replacement**: Interactive versions of read-only components (e.g., `InteractiveStatDisplay` extending `ValueDisplay`) add affordances on top of the same visual treatment — not a different visual language.

### ITUN-Specific Additions

- **ShadCN components**: Form inputs, buttons, dialogs, dropdowns, tabs, tooltips
- **Interactive states**: Hover/active/disabled styling on interactive elements
- **Selection indicators**: Checkmarks, outlines, count badges on multi-select

---

## App Shell Components

### `packages/suref-react/src/components/shared/Footer.tsx` (NEW)

React port of `apps/suref-web/src/components/Footer.astro`. See above.

### `src/components/shell/AppNav.tsx` (NEW)

Sticky top navigation bar.

```typescript
type AppNavProps = {
  user: User | null
}

export function AppNav({ user }: AppNavProps)
```

- Background: `su-black`, text: `su-white`
- Left: App title "In The Union Now" (links to `/`)
- Center/Right: Navigation links (Dashboard, Patterns)
- Right: User email + "Sign Out" button

### `src/components/shell/AppShell.tsx` (NEW)

Wraps the authenticated layout with nav + footer.

```typescript
type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps)
```

Layout: `min-h-dvh flex flex-col` -> `<AppNav />` + `<main className="flex-1">` + `<Footer />`.

### `src/routes/_authenticated.tsx` (MODIFY)

Wrap `<Outlet />` with `<AppShell>`.

---

## Data Flow

```
+-----------------------------------------------------+
|                    Supabase                          |
|  (Postgres + Auth + RLS)                             |
|  Tables: pilots, mechs, crawlers, entity_refs, ...   |
+-------------------------+---------------------------+
                          | REST API
                          v
+-----------------------------------------------------+
|              API Layer (src/lib/api/)                 |
|  patternApi.ts (Phase 2), pilotApi.ts (Phase 3), ... |
|  Raw Supabase queries with typed responses            |
+-------------------------+---------------------------+
                          |
                          v
+-----------------------------------------------------+
|           TanStack Query Hooks (src/hooks/)           |
|  usePatterns() (Phase 2), usePilots() (Phase 3), ... |
|  Key factories: patternKeys, pilotKeys, mechKeys      |
|  Handles: caching, refetching, optimistic updates     |
+-------------------------+---------------------------+
                          |
                          v
+-----------------------------------------------------+
|           Zustand Stores (src/stores/)                |
|  authStore: user session                              |
|  wizardStore: creation wizard state (Phase 3)         |
|  diceStore: d20 rolling (Phase 3)                     |
|  (Client-only state that doesn't belong in cache)     |
+-------------------------+---------------------------+
                          |
                          v
+-----------------------------------------------------+
|            React Components                           |
|  Routes -> Feature components -> suref-react UI       |
+-----------------------------------------------------+

+-----------------------------------------------------+
|        salvageunion-reference (Read-Only)              |
|  Game data: classes, chassis, systems, modules, ...   |
|  Helpers: findById, getChassis, getAbilities, ...     |
|  Used directly in components for entity resolution    |
+-----------------------------------------------------+
```

### Query Key Factories

```typescript
// Pattern established in Phase 1, reused by all phases
const patternKeys = {
  all: ['patterns'] as const,
  lists: () => [...patternKeys.all, 'list'] as const,
  details: () => [...patternKeys.all, 'detail'] as const,
  detail: (id: string) => [...patternKeys.details(), id] as const,
}
```

Same pattern for `pilotKeys`, `mechKeys`, `crawlerKeys`, `campaignKeys`.

### Mutation -> Invalidation Pattern

```typescript
useMutation({
  mutationFn: patternApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: patternKeys.lists() })
  },
})
```

---

## Shared Component Strategy

### Shared from suref-react

- `Heading`, `Text` -- base typography
- `Tooltip`, `Toaster`, `Modal` -- UI primitives
- `DisplayCard` -- extracted EntityDisplay shell (header/content/footer with themed colors)
- `Card`, `ValueDisplay`, `SheetDisplay` -- display components
- `BlockContentRendererView` -- content block renderer
- `GuideStepsDisplay` -- read-only guide step rendering (extended by ITUN's wizard in Phase 3)
- Entity display system -- chassis, systems, modules, abilities, equipment rendering
- `cn()` -- Tailwind class merging utility
- Theme CSS -- shared color variables and design tokens

---

## File Summary

### New Files (suref-react) -- 3

```
packages/suref-react/src/components/shared/DisplayCard.tsx
packages/suref-react/src/components/shared/InteractiveStatDisplay.tsx
packages/suref-react/src/components/shared/Footer.tsx
```

### Modified Files (suref-react) -- 3

```
packages/suref-react/src/components/entity/EntityDisplay/index.tsx  -- Use DisplayCard
packages/suref-react/src/components/shared/Card.tsx                  -- Simplify after extraction
packages/suref-react/src/index.ts                                    -- Export DisplayCard + Footer
```

### New Files (ITUN) -- 3

```
src/components/shell/AppNav.tsx
src/components/shell/AppShell.tsx
src/routes/_authenticated/index.tsx    (Dashboard skeleton)
```

### Modified Files (ITUN) -- 2

```
src/routes/_authenticated.tsx           -- Wrap with AppShell
src/types/database-generated.types.ts   -- Regenerate after migration
```

---

## Implementation Order

1. **DisplayCard extraction** -- Create `DisplayCard.tsx` in suref-react with full/compact/listing modes, refactor EntityDisplay to use it, verify rendering in suref-web
2. **InteractiveStatDisplay** -- Create `InteractiveStatDisplay.tsx` in suref-react with +/− buttons matching ValueDisplay visual style
3. **Footer port** -- Create `Footer.tsx` in suref-react, export from barrel
4. **Database migration** -- Create all tables + enums + RLS via Supabase MCP
5. **Regenerate types** -- `generate_typescript_types` -> update `database-generated.types.ts`
6. **Install ShadCN components** -- button, card, input, skeleton, badge, separator, dropdown-menu, dialog, tooltip
7. **App shell** -- AppNav, AppShell, update `_authenticated.tsx`
8. **Dashboard skeleton** -- Route + placeholder sections

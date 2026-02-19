# Phase 1 — Foundation & Thematic Setup

## Scope

Establish the foundational infrastructure, visual identity, and database schema that all subsequent phases build on. No interactive features ship in this phase — it is purely structural.

**What ships:**

- `DisplayCard` extracted from EntityDisplay in suref-react (reusable card shell for entity and non-entity screens)
- `Footer` React port in suref-react (shared by suref-web and ITUN)
- Authenticated app shell matching suref-web design language (sticky nav, flex-1 main, Footer)
- DB migration: all tables + enums + indexes + RLS (foundation for all phases)
- Dashboard skeleton (empty placeholder sections for patterns, pilots, crawlers)
- Basic routing structure under `_authenticated/`
- ShadCN component installations for Phase 2

**What does NOT ship:**

- Pattern Builder (Phase 2)
- Pilot/Mech creation (Phase 3)
- Crawler/Campaign management (Phase 4)
- User invites and roles (Phase 5)
- Live editing, change log, real-time (Phase 6)

---

## User Stories

### Authentication

- **US-F1**: As a user, I can sign in with email/password and see the authenticated dashboard.
- **US-F2**: As an unauthenticated user, I am redirected to the login page when accessing protected routes.

### App Shell

- **US-F3**: As a user, I see a consistent navigation bar, content area, and footer on every authenticated page.
- **US-F4**: As a user, the app uses the same design language as the SRD reference site (Fira Code, SU brand colors, pseudoheaders).

### DisplayCard

- **US-F5**: The `DisplayCard` component provides a reusable header/content/footer card shell with themed colors, usable for both entity and non-entity screens.
- **US-F6**: `EntityDisplay` in suref-react uses `DisplayCard` internally with no visual regression in suref-web.
- **US-F7**: **All major screens** in ITUN use `DisplayCard` as their primary container: Pattern Builder, pilot sheets, mech sheets, crawler views, wizard steps, campaign views. This is the central thematic element of the app — every feature lives inside the familiar header/content/footer card shape.
- **US-F8**: `DisplayCard` and all consuming components support **Compact** and **Listing** display modes — matching EntityDisplay's existing compact/listing patterns. Compact mode reduces spacing and typography for inline or grid use. Listing mode shows a minimal header-only clickable row (entity name, key stats) for use in selection lists and roster grids.

### InteractiveStatDisplay

- **US-F9**: An `InteractiveStatDisplay` component provides editable stat controls (e.g., HP, AP, TP, SP, EP, Heat) with **+/−** buttons for quick manipulation.
- **US-F10**: `InteractiveStatDisplay` visually resembles the existing `ValueDisplay` stat blocks from EntityDisplay, maintaining thematic consistency — but adds interactive affordances (increment/decrement buttons, constrained to min/max bounds).
- **US-F11**: `InteractiveStatDisplay` lives in suref-react so it can be shared across all stat-editing contexts: pilot sheets, mech sheets, crawler views.

---

## Entity Model Overview

Phase 1 creates the complete database schema even though most tables are unused until later phases. This avoids future migration complexity and lets the schema stabilize early.

### Tables Created

| Table              | Active In | Purpose                            |
| ------------------ | --------- | ---------------------------------- |
| `campaigns`        | Phase 4   | Multiplayer game sessions          |
| `campaign_members` | Phase 5   | Campaign membership and roles      |
| `crawlers`         | Phase 4   | Crawler vehicles                   |
| `mechs`            | Phase 3   | Pilot's physical mech (live state) |
| `pilots`           | Phase 3   | Player characters                  |
| `mech_patterns`    | Phase 2   | Abstract mech templates            |
| `entity_refs`      | Phase 3   | Polymorphic game data references   |
| `player_choices`   | Phase 3   | User selections from wizard steps  |
| `cargo`            | Phase 6   | Inventory items                    |
| `change_log`       | Phase 6   | Audit trail for all edits          |

### Enums

- `parent_type`: pilot, mech, crawler
- `item_condition`: intact, damaged, destroyed

---

## Acceptance Criteria

### AC-1: Authentication Flow

- [ ] User can sign in with email/password
- [ ] Authenticated users see the dashboard
- [ ] Unauthenticated users are redirected to login

### AC-2: App Shell

- [ ] Sticky nav bar with app title and user menu
- [ ] Footer matches suref-web (copyright, OGL, logo)
- [ ] Layout uses max-w-4xl centered container
- [ ] Monospace font (Fira Code) throughout

### AC-3: DisplayCard Extraction

- [ ] `DisplayCard` component exists in suref-react with header/content/footer structure
- [ ] `EntityDisplay` uses `DisplayCard` internally — no visual regression in suref-web
- [ ] `DisplayCard` can be used independently by ITUN for non-entity cards
- [ ] `DisplayCard` supports `compact` mode (reduced spacing/typography for grids)
- [ ] `DisplayCard` supports `listing` mode (minimal header-only row for selection lists)
- [ ] Both modes match EntityDisplay's existing compact/listing visual patterns

### AC-6: InteractiveStatDisplay

- [ ] `InteractiveStatDisplay` component exists in suref-react
- [ ] Renders stat label, current/max values, and +/− buttons
- [ ] +/− buttons respect min (0) and max bounds
- [ ] Visual style matches EntityDisplay `ValueDisplay` stat blocks (same font, spacing, color treatment)
- [ ] Disabled state when at min/max bounds
- [ ] Calls `onChange(newValue)` callback on button press

### AC-4: Database

- [ ] All tables created with correct columns and types
- [ ] Enums: parent_type, item_condition
- [ ] Indexes on user_id, parent_id+parent_type, etc.
- [ ] RLS enabled on all tables (user_id = auth.uid())
- [ ] updated_at triggers on all tables

### AC-5: Dashboard Skeleton

- [ ] Dashboard route renders at `/`
- [ ] Placeholder sections for Patterns, Pilots, Crawlers (empty states)
- [ ] Ready for Phase 2 to populate the Pattern section

---

## Cross-Cutting Concerns (All Phases)

### Types: Supabase-Generated First

All database-backed types must be derived from **Supabase-generated types** (`database-generated.types.ts`). After any DB schema change, regenerate types via Supabase MCP `generate_typescript_types` tool. Application-level types (e.g., `MechPatternRow`, `PilotRow`, `CrawlerWithRelations`) are aliases or extensions of the generated types — never hand-written duplicates.

```typescript
// Correct — derived from generated types
import type { Database } from './database-generated.types'
export type PilotRow = Database['public']['Tables']['pilots']['Row']

// Never — hand-written duplicates that drift from the DB
export type PilotRow = { id: string; callsign: string; ... }
```

### Testing: Comprehensive + E2E

Every phase must include comprehensive tests. Prefer E2E tests for complex workflows:

- **Unit tests**: Validation logic (slot constraints, scrap budget, ability prerequisites), utility functions, data transformations
- **Component tests**: Interactive component behavior (MechBuilder slot limits, wizard step transitions, Load In/Out toggle)
- **E2E tests**: Full user workflows — especially complex multi-step operations:
  - Create pilot -> create mech -> see on dashboard -> view detail -> load in/out
  - Build pattern -> save -> edit -> delete
  - Create crawler -> assign pilot -> dump scrap -> refund mech piece
  - Downtime flow: trigger -> TP grant -> heal -> repair -> craft -> train
  - Scrap translation, mech upgrade from crawler budget
  - Campaign invite -> join -> role management
- **Test runner**: Bun test runner (`bun --filter in-the-union-now test`)
- **E2E framework**: Playwright or similar for browser-based workflow testing

### Approval Workflow

Before committing any phase's work: queue to the user for review and approval. Do not auto-commit. Present the latest changes and wait for explicit sign-off. After the user confirms successful execution, **commit and push** the phase's work.

### Step Review Pattern

After completing each implementation step within a phase, review the **remaining steps** to identify anything that needs updating as a result of work done so far. This prevents cascading misalignment — e.g., if an API shape changes during implementation, downstream hooks and components should be updated immediately rather than discovered later.

### State Management: TanStack Query + Zustand

Use well-worn, regimented patterns for state management:

**TanStack Query** (server state — data from Supabase):

- Every API module (`src/lib/api/`) has a corresponding query hook file (`src/hooks/`)
- Every hook file exports a query key factory following the pattern:
  ```typescript
  export const fooKeys = {
    all: ['foos'] as const,
    lists: () => [...fooKeys.all, 'list'] as const,
    details: () => [...fooKeys.all, 'detail'] as const,
    detail: (id: string) => [...fooKeys.details(), id] as const,
  }
  ```
- Mutations always invalidate relevant query keys on success:
  ```typescript
  useMutation({
    mutationFn: fooApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fooKeys.lists() }),
  })
  ```
- Cross-entity invalidation when one mutation affects multiple entities (e.g., pilot assignment invalidates both crawler and pilot queries)

**Zustand** (client-only ephemeral state):

- `authStore` — user session (not server-fetched data)
- `wizardStore` — in-progress wizard state (temporary, not persisted until completion)
- `diceStore` — d20 rolling state (temporary). Uses `@randsum/roller` for all dice operations
- Stores do **NOT** hold fetched data — that belongs in TanStack Query cache
- Stores do **NOT** duplicate query state — components read from hooks, not stores

### Guide Step Handling: `paperOnly` Steps

Any guide step marked `paperOnly: true` is **completely omitted** — not displayed, not acted on, not counted. These steps exist only for the paper character sheet workflow and are irrelevant to the digital app. The wizard engine filters them out before rendering.

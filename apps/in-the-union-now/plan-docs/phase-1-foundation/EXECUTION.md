# Phase 1 — Foundation & Thematic Setup — Execution Report

## Summary

Phase 1 established the foundational infrastructure for ITUN: complete database schema, shared UI components in suref-react, ShadCN component library, authenticated app shell, and dashboard skeleton. No interactive features — purely structural.

---

## Acceptance Criteria Status

### AC-1: Authentication Flow

- [x] User can sign in with email/password (pre-existing)
- [x] Authenticated users see the dashboard
- [x] Unauthenticated users are redirected to login (pre-existing)

### AC-2: App Shell

- [x] Sticky nav bar with app title and user menu
- [x] Footer matches suref-web (copyright, OGL, logo)
- [x] Layout uses max-w-4xl centered container
- [x] Monospace font (Fira Code) throughout

### AC-3: DisplayCard Extraction

- [x] `DisplayCard` component exists in suref-react with header/content/footer structure
- [x] `EntityDisplay` uses `DisplayCard` internally (`EntityDisplayContent` + `EntityNpcDisplay` converted)
- [x] `DisplayCard` can be used independently by ITUN for non-entity cards
- [x] `DisplayCard` supports `compact` mode
- [x] `DisplayCard` supports `listing` mode

### AC-4: Database

- [x] All tables created with correct columns and types
- [x] Enums: parent_type, item_condition
- [x] Indexes on user_id, parent_id+parent_type, schema refs, etc.
- [x] RLS enabled on all tables (user_id = auth.uid())
- [x] updated_at triggers on all tables

### AC-5: Dashboard Skeleton

- [x] Dashboard route renders at `/`
- [x] Placeholder sections for Patterns, Pilots, Crawlers (empty states)
- [x] Ready for Phase 2 to populate the Pattern section

### AC-6: InteractiveStatDisplay

- [x] `InteractiveStatDisplay` component exists in suref-react
- [x] Renders stat label, current/max values, and +/- buttons
- [x] +/- buttons respect min (0) and max bounds
- [x] Visual style matches EntityDisplay ValueDisplay stat blocks
- [x] Disabled state when at min/max bounds
- [x] Calls onChange(newValue) callback on button press
- [x] Read-only fallback when no onChange provided

---

## Deviations from Plan

### 1. EntityDisplay Converted to DisplayCard (Completed)

**Plan:** Refactor `EntityDisplay` to use `DisplayCard` internally, then simplify `Card.tsx`.

**Actual:** Initially deferred, then completed. Both `EntityDisplayContent` and `EntityNpcDisplay` now use `DisplayCard` instead of `Card`. `Card` export was removed from `src/index.ts`. To support EntityDisplay's full feature set, `DisplayCard` gained several new props: `headerOpacity`, `disabled`, `bodyPadding`, `source` (expansion theming), `isExpanded`, `headerTestId`, and `absoluteElements`. Title rendering and header composition — previously internal to `Card` — are now handled by the consumer via `headerContent`, giving full layout control.

**Additional changes driven by this conversion:**

- **classAbilitiesRenderer** (suref-web): Refactored to use `TreeSection` components with pseudoheader dividers between ability trees. Advanced/legendary trees now display in a responsive 2-column grid. The `label` prop was removed from `EntityDisplay` calls since tree labels moved to the new divider pattern.
- **SchemaViewerIsland** (suref-web): Removed `isAbility` import and `label` prop — tree labeling is now handled inside `EntityDisplayContent`'s detail modal.
- **entityDataExtraction**: Removed ability tree name from subtitle details — tree identification moved to the `label` prop on `EntityDisplayContent` in modal view.
- **GuideStepsDisplay**: Responsive grid tweak (`grid-cols-2` → `grid-cols-1 md:grid-cols-2`) for better small-screen display.

**Impact:** `Card.tsx` is no longer exported but still exists in the codebase (unused). Both ITUN and suref-web now share the same `DisplayCard` primitive. All entity rendering flows through `DisplayCard`.

### 2. ShadCN Path Alias Handling

**Plan:** Architecture doc didn't specify import strategy for ShadCN components.

**Actual:** Installed ShadCN via CLI, then manually replaced all `src/lib/utils` imports with relative `../../lib/utils` paths. Added a local `src/lib/utils.ts` (re-implements `cn()`) since ShadCN components need it at that path. Kept `components.json` for future ShadCN CLI compatibility. Did NOT add `@/` path alias to tsconfig — all imports remain relative per project convention.

### 3. Footer Consolidated via suref-react

**Plan:** Port Footer.astro to suref-react, use in ITUN only.

**Actual:** Created the React Footer in suref-react (Phase 1 original work), then consolidated both apps to use it:

- Deleted `apps/suref-web/src/components/Footer.astro` — suref-web now imports `Footer` from suref-react directly in `BaseLayout.astro`
- Moved the "Powered by Salvage" logo from `src/assets/` to `public/` in suref-web (Astro's `<Image>` optimization no longer needed since the React component uses a plain `<img>`)
- Fixed logo sizing in suref-react Footer from `h-8 w-8` (32x32) back to `h-12 w-auto` (120x48) to match the original Astro footer dimensions
- Fixed ITUN's `@source` path in `src/index.css` — was `../../packages/suref-react/src` (resolved to `apps/packages/...`), corrected to `../../../packages/suref-react/src` so Tailwind scans suref-react's classes correctly

**Impact:** Both apps now render an identical footer from the single suref-react component. This establishes the pattern for sharing UI between suref-web and ITUN via the suref-react package.

---

## Files Changed

### suref-react — 9 files (4 new, 5 modified)

| File                                                                      | Action   | Description                                                                  |
| ------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `src/components/shared/DisplayCard.tsx`                                   | NEW      | Reusable card shell with full/compact/listing modes + entity display props   |
| `src/components/shared/InteractiveStatDisplay.tsx`                        | NEW      | Editable stat control with +/- buttons                                       |
| `src/components/shared/Footer.tsx`                                        | NEW      | React port of Astro Footer                                                   |
| `src/components/shared/__tests__/DisplayCard.test.tsx`                    | NEW      | 20 tests covering all modes, props, a11y, source theming                     |
| `src/components/shared/__tests__/InteractiveStatDisplay.test.tsx`         | NEW      | 11 tests for interactive controls, bounds, disabled/read-only                |
| `src/components/shared/__tests__/Footer.test.tsx`                         | NEW      | 6 tests for links, copyright, logo, external tab targets                     |
| `src/components/entity/EntityDisplay/components/EntityDisplayContent.tsx` | MODIFIED | Converted from Card to DisplayCard, header composed externally               |
| `src/components/entity/EntityDisplay/EntityNpcDisplay.tsx`                | MODIFIED | Converted from Card to DisplayCard                                           |
| `src/components/entity/GuideStepsDisplay.tsx`                             | MODIFIED | Responsive grid tweak for small screens                                      |
| `src/lib/entityDataExtraction.ts`                                         | MODIFIED | Removed ability tree from subtitle details                                   |
| `src/index.ts`                                                            | MODIFIED | Added DisplayCard/InteractiveStatDisplay/Footer exports, removed Card export |

### suref-web — 2 files modified

| File                                                | Action   | Description                                                  |
| --------------------------------------------------- | -------- | ------------------------------------------------------------ |
| `src/components/islands/SchemaViewerIsland.tsx`     | MODIFIED | Removed isAbility/label usage (tree labeling now internal)   |
| `src/components/islands/classAbilitiesRenderer.tsx` | MODIFIED | Refactored to TreeSection pattern with pseudoheader dividers |

### ITUN — 16 files (13 new, 3 modified)

| File                                    | Action   | Description                                                            |
| --------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `src/types/database-generated.types.ts` | MODIFIED | Regenerated from Supabase (10 tables, 2 enums)                         |
| `src/types/common.ts`                   | MODIFIED | Row/Insert/Update type aliases for all 10 tables + EntityUpdateHandler |
| `src/routes/_authenticated.tsx`         | MODIFIED | Wrapped Outlet with AppShell                                           |
| `src/routes/_authenticated/index.tsx`   | NEW      | Dashboard skeleton with placeholder sections                           |
| `src/components/shell/AppNav.tsx`       | NEW      | Sticky navigation bar                                                  |
| `src/components/shell/AppShell.tsx`     | NEW      | Layout wrapper (nav + main + footer)                                   |
| `src/lib/utils.ts`                      | NEW      | Local cn() utility for ShadCN components                               |
| `components.json`                       | NEW      | ShadCN configuration                                                   |
| `public/Powered_by_Salvage_Black.webp`  | NEW      | Footer logo asset                                                      |
| `src/components/ui/button.tsx`          | NEW      | ShadCN button                                                          |
| `src/components/ui/card.tsx`            | NEW      | ShadCN card                                                            |
| `src/components/ui/input.tsx`           | NEW      | ShadCN input                                                           |
| `src/components/ui/skeleton.tsx`        | NEW      | ShadCN skeleton                                                        |
| `src/components/ui/badge.tsx`           | NEW      | ShadCN badge                                                           |
| `src/components/ui/separator.tsx`       | NEW      | ShadCN separator                                                       |
| `src/components/ui/dropdown-menu.tsx`   | NEW      | ShadCN dropdown-menu                                                   |
| `src/components/ui/dialog.tsx`          | NEW      | ShadCN dialog                                                          |
| `src/components/ui/tooltip.tsx`         | NEW      | ShadCN tooltip                                                         |

### Database — 8 migrations applied

| Migration                        | Content                                           |
| -------------------------------- | ------------------------------------------------- |
| `create_enums`                   | parent_type, item_condition                       |
| `create_campaigns_and_members`   | campaigns + campaign_members tables               |
| `create_crawlers_mechs_pilots`   | crawlers, mechs, pilots + crawler FK on campaigns |
| `create_mech_patterns`           | mech_patterns table                               |
| `create_entity_refs_and_choices` | entity_refs + player_choices tables               |
| `create_cargo_and_change_log`    | cargo + change_log tables                         |
| `create_updated_at_trigger`      | Trigger function + triggers on all 8 tables       |
| `enable_rls_and_policies`        | RLS + owner-only policies on all 10 tables        |

---

## Verification

- **Typecheck:** 0 errors across all 4 packages (salvageunion-reference, suref-react, suref-web, in-the-union-now)
- **Tests:** 83 suref-react tests passing (37 new across DisplayCard, InteractiveStatDisplay, Footer)
- **Dev server:** Boots cleanly, route tree auto-generated
- **Supabase security advisors:** Clean (no warnings)
- **Database:** All 10 tables confirmed with correct columns, RLS enabled, indexes in place

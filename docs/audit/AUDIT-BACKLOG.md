# Audit Backlog

Organized backlog of 69 findings from the SURef monorepo audit, structured as epics and stories.

**GitHub Project:** https://github.com/orgs/SalvageUnion-io/projects/1
**Issues:** #108–#166

## How to Use This Document

- **Epics are ordered by recommended execution order.** Start at the top; early epics are quick wins and foundational cleanup that unblock later work.
- **Stories within an epic are ordered by dependency.** If story 2.2 depends on 2.1, 2.1 is listed first. Independent stories can be worked in parallel.
- **Effort estimates** use t-shirt sizes: **S** (< 1 day), **M** (1-2 days), **L** (2-3 days).
- **Each story is designed to be independently shippable** — it should pass `bun run check:all` on its own and not leave the codebase in a broken state.
- **Gameplay features (Epics 10-13)** reference items from the Phase 5II roadmap in `plan-docs/`. Items already on that roadmap are noted; net-new items are called out.
- **P3+ gameplay items** are not broken into individual stories. They appear as a consolidated "Future Considerations" section at the end.

---

## Epic 1: Dead Code Removal `[cleanup]`

> Remove dead exports, duplicate methods, and unused helpers across the reference package and shared components. Total effort: S

### Story 1.1: Remove dead code from salvageunion-reference
**Package(s):** `salvageunion-reference`
**Effort:** S

Remove 17 dead exported functions (~200 lines) from `utilities.ts`, remove dead helper types (`AllKeys`, `PropertyType`, `SURefMetaEntityKeys`), and remove 3 duplicate static methods (`getTechLevel`, `getTechLevelNumber`, `getSalvageValue`) from the `SalvageUnionReference` class.

**Acceptance Criteria:**
- [ ] All 17 unused functions removed from `packages/salvageunion-reference/lib/utilities.ts`
- [ ] Dead types at `utilities.ts:76-91` removed
- [ ] Duplicate static methods at `packages/salvageunion-reference/lib/index.ts:423-473` removed
- [ ] No consumers reference the removed exports (verify with grep)
- [ ] All tests pass (`bun test`)
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 1.2: Clean up suref-react barrel exports
**Package(s):** `suref-react`
**Effort:** S

Remove `DetailIcon` and `techLevelColors` from the barrel export (`packages/suref-react/src/index.ts`). Remove the deprecated `techLevelColors` export from `useReferenceEntityDisplayState.ts`. Verify no consumers import these symbols.

**Acceptance Criteria:**
- [ ] `DetailIcon` and `techLevelColors` removed from `packages/suref-react/src/index.ts`
- [ ] Deprecated `techLevelColors` removed from `packages/suref-react/src/components/referenceEntity/ReferenceEntityDisplay/useReferenceEntityDisplayState.ts:29`
- [ ] Grep confirms zero imports of these symbols across all workspaces
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 1.3: Replace ITUN's duplicate entity helper
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** S

Replace ITUN's `findChassisById` with the equivalent from `salvageunion-reference`. Delete `apps/in-the-union-now/src/lib/entityHelpers.ts` if it becomes empty after removal.

**Acceptance Criteria:**
- [ ] All call sites updated to use `salvageunion-reference` API
- [ ] `entityHelpers.ts` deleted or reduced to only non-duplicate helpers
- [ ] All tests pass (`bun test`)
- [ ] Lint/typecheck clean (`bun run check:all`)

---

## Epic 2: Accessibility Quick Fixes `[accessibility]`

> Fix WCAG AA violations and missing accessibility attributes in shared components. Total effort: S

### Story 2.1: Fix a11y issues in suref-react shared components
**Package(s):** `suref-react`
**Effort:** M

Address four accessibility gaps in shared components:
1. Add required `alt` prop to `CardImage` (`packages/suref-react/src/components/shared/CardImage.tsx`)
2. Fix color contrast on `StatDisplay` grey-on-grey (~1.5:1 ratio, needs 4.5:1 for AA) (`StatDisplay.tsx:86`)
3. Fix color contrast on `FilterChip` inactive state (`FilterChip.tsx:18-22`)
4. Add `:focus-visible` outline to `DisplayCard` button mode (`DisplayCard.tsx:172-184`)

**Acceptance Criteria:**
- [ ] `CardImage` requires `alt` prop; all existing usages updated with meaningful alt text
- [ ] `StatDisplay` foreground/background contrast meets WCAG AA (>= 4.5:1)
- [ ] `FilterChip` inactive state contrast meets WCAG AA (>= 4.5:1)
- [ ] `DisplayCard` button mode shows visible focus ring on keyboard navigation
- [ ] All tests pass (`bun test`)
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 2.2: Add aria-live regions and search accessibility
**Package(s):** `suref-react`, `suref-web`
**Effort:** S

Add `aria-live="polite"` to dynamic content regions: `DisplayCard` tab switching and `SearchIsland` result updates. Add "no results" message and result count announcement to `SearchIsland`.

**Acceptance Criteria:**
- [ ] `DisplayCard` tab content area has `aria-live="polite"` for screen reader announcements
- [ ] `SearchIsland` announces result count to assistive technology on query change
- [ ] `SearchIsland` displays "no results" message when search yields zero matches
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 2.3: Verify focus trap in ITUN modals
**Package(s):** `itun`
**Effort:** S

Audit custom modals in `apps/in-the-union-now/src/components/shared/` for proper focus trap behavior. Ensure focus is trapped within open modals, returned to trigger on close, and Escape key dismisses.

**Acceptance Criteria:**
- [ ] All custom modals trap focus correctly (Tab cycles within modal)
- [ ] Focus returns to the triggering element on modal close
- [ ] Escape key closes all modals
- [ ] Any gaps documented or fixed inline

---

## Epic 3: Build & DX Improvements `[dx]`

> Pin tooling versions, remove unused dependencies, and improve developer experience for local workflows. Total effort: S

### Story 3.1: Pin Bun version and clean up root dependencies
**Package(s):** `monorepo`
**Effort:** S

Create `.bun-version` file pinning `1.3.10` at the repo root. Verify whether `puppeteer-core` (root `package.json:29`) is actually used; remove it if unused. Remove redundant `build:package &&` prefix from the `build:itun` script (`package.json:45`).

**Acceptance Criteria:**
- [ ] `.bun-version` file exists at repo root with content `1.3.10`
- [ ] `puppeteer-core` removed from root devDeps if unused (or documented why it's needed)
- [ ] `build:itun` script no longer redundantly rebuilds the package
- [ ] `bun install` and `bun run build` succeed

### Story 3.2: Improve dev:watch process management
**Package(s):** `monorepo`
**Effort:** S

Replace `&` background process management in the `dev:watch` script with `concurrently` (or `bun run --parallel` if sufficient). Add a `dev:bot` watch mode script for Discord bot development.

**Acceptance Criteria:**
- [ ] `dev:watch` uses proper process management (all processes terminate cleanly on Ctrl+C)
- [ ] `dev:bot` watch script exists and restarts on file changes
- [ ] Both scripts documented in root `package.json`

---

## Epic 4: CI Infrastructure `[infrastructure]`

> Reduce CI duplication and improve pipeline maintainability. Total effort: M

### Story 4.1: DRY up CI workflow with composite action
**Package(s):** `monorepo`
**Effort:** M

Extract the repeated `bun install` + cache setup pattern (used in 7 jobs) in `.github/workflows/ci.yml` into a reusable composite action. Each job should reference the composite action instead of duplicating setup steps.

**Acceptance Criteria:**
- [ ] Composite action created at `.github/actions/setup-bun/action.yml` (or similar)
- [ ] All 7 CI jobs reference the composite action for setup
- [ ] CI pipeline passes on a test branch push
- [ ] Total YAML reduced by ~50% in the workflow file

---

## Epic 5: Code Quality — Type Safety & Component Hygiene `[cleanup]`

> Eliminate `any` types, rationalize memoization, and break apart oversized components. Total effort: L

### Story 5.1: Replace `any` with proper types in suref-react
**Package(s):** `suref-react`
**Effort:** S

Replace 6 instances of `any` with `unknown` + type guards in:
- `ReferenceEntityDisplayTooltip`
- `BlockContentRendererView`
- `GuideStepsDisplay`

**Acceptance Criteria:**
- [ ] Zero `any` types remain in the three listed components
- [ ] Type guards added where narrowing is needed
- [ ] All tests pass (`bun test`)
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 5.2: Audit and fix useCallback usage in ITUN
**Package(s):** `itun`
**Effort:** M

Audit `useCallback` usage in the following files and either remove unnecessary wrappers (where children are not memoized) or add `React.memo` to the children that would benefit:
- `MapPage.tsx` (14 instances)
- `ActionsSection.tsx`
- `LoadCargoModal.tsx`
- `PlayerPatternDisplay.tsx`
- `MechCargoSection.tsx`

**Acceptance Criteria:**
- [ ] Each `useCallback` is justified by a memoized consumer or removed
- [ ] No performance regressions in affected views
- [ ] All tests pass (`bun test`)
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 5.3: Extract action aggregation logic from ActionsSection
**Package(s):** `itun`
**Effort:** S

Extract the action aggregation logic at `ActionsSection.tsx:89-164` into a standalone `useAggregatedActions` hook (or pure utility function) for testability.

**Acceptance Criteria:**
- [ ] Aggregation logic lives in its own file with unit tests
- [ ] `ActionsSection` imports and uses the extracted logic
- [ ] Tests cover edge cases (empty actions, duplicate names, mixed sources)
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 5.4: Decompose PlayerPilotDisplay
**Package(s):** `itun`
**Effort:** L

Split `PlayerPilotDisplay` (757 lines, 22 props, 3 modes) into focused components:
- `PilotListingCard` — compact listing mode
- `PilotCompactCard` — summary card mode
- `PilotSheet` — full sheet mode

A shared internal hook or utility can hold common logic.

**Acceptance Criteria:**
- [ ] `PlayerPilotDisplay.tsx` replaced by 3 focused components, each under 300 lines
- [ ] Props per component reduced to only what that mode needs
- [ ] All existing rendering behavior preserved (visual regression check)
- [ ] All tests pass (`bun test`)
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 5.5: Decompose CrawlerStorageSection and ActionsSection
**Package(s):** `itun`
**Effort:** M

Break apart `CrawlerStorageSection` (683 lines) and `ActionsSection` (757 lines) into smaller, focused sub-components.

**Acceptance Criteria:**
- [ ] Each file reduced to under 300 lines
- [ ] Sub-components are co-located in the same directory
- [ ] All existing behavior preserved
- [ ] Lint/typecheck clean (`bun run check:all`)

---

## Epic 6: Shared Component Extraction `[cleanup]`

> Promote reusable ITUN patterns to suref-react so both apps share them. Total effort: M

### Story 6.1: Extract ModalShell to suref-react
**Package(s):** `suref-react`, `itun`
**Effort:** M

Move `ModalShell` from `apps/in-the-union-now/src/components/shared/ModalShell.tsx` into `packages/suref-react/`. Update all ITUN imports. Ensure suref-web can also consume it if needed.

**Acceptance Criteria:**
- [ ] `ModalShell` lives in suref-react with tests
- [ ] All 10+ ITUN modal usages import from suref-react
- [ ] No ITUN-specific dependencies pulled into suref-react
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 6.2: Extract FilterRow / FilterChipGroup to suref-react
**Package(s):** `suref-react`, `itun`, `suref-web`
**Effort:** S

Extract `FilterRow` and/or `FilterChipGroup` from `apps/in-the-union-now/src/components/shared/FilterRow.tsx` into suref-react. Update imports in both consuming apps.

**Acceptance Criteria:**
- [ ] `FilterRow` / `FilterChipGroup` exported from suref-react
- [ ] Both apps import from suref-react (no local copies remain)
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 6.3: Deduplicate theme colors in ITUN
**Package(s):** `itun`, `suref-react`
**Effort:** S

Replace duplicated color definitions in ITUN's `@theme` block (`apps/in-the-union-now/src/index.css`) with imports or references from suref-react's theme system. Establish a single source of truth for SU brand colors.

**Acceptance Criteria:**
- [ ] ITUN's `index.css` references suref-react theme tokens (no hardcoded hex duplicates)
- [ ] Visual appearance unchanged
- [ ] Lint/typecheck clean (`bun run check:all`)

---

## Epic 7: ORM API Enhancements `[orm-api]`

> Fill API gaps in the salvageunion-reference package to reduce ad-hoc querying in consumers. Total effort: M

### Story 7.1: Add resolveActions as first-class ORM method
**Package(s):** `salvageunion-reference`
**Effort:** S

Promote the action resolution logic (currently in `utilities.ts:187`) to a first-class method: `SalvageUnionReference.resolveActions(entity)`. This centralizes a pattern used by both ITUN and suref-web.

**Acceptance Criteria:**
- [ ] `SalvageUnionReference.resolveActions(entity)` exists and is typed
- [ ] Existing consumer code updated to use it (or noted for follow-up)
- [ ] Unit tests cover chassis, system, module, and ability action sources
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 7.2: Add type guard and query helpers
**Package(s):** `salvageunion-reference`
**Effort:** S

Add three utility functions:
1. `isValidSchemaName(name: string): name is SchemaName` type guard
2. `filterByTechLevel(schemaName, techLevel)` helper
3. `filterBySource(schemaName, source)` helper

**Acceptance Criteria:**
- [ ] All three functions exported from the package
- [ ] Type guard narrows correctly in conditional blocks
- [ ] Filter helpers return typed arrays
- [ ] Unit tests for each function
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 7.3: Add bulk query and reverse lookup methods
**Package(s):** `salvageunion-reference`
**Effort:** M

Add two ORM methods:
1. `getAllBySchemaNames(['chassis', 'systems'])` for bulk multi-schema queries
2. `findUsagesOf(schemaName, id)` for reverse relationship discovery (e.g., "which chassis use this system?")

**Acceptance Criteria:**
- [ ] Both methods exported and typed with proper return types
- [ ] `getAllBySchemaNames` returns a discriminated union or tagged results
- [ ] `findUsagesOf` traverses reference fields to find inbound links
- [ ] Unit tests cover common query patterns
- [ ] Lint/typecheck clean (`bun run check:all`)

---

## Epic 8: Data Quality & Validation `[data-quality]`

> Strengthen data validation tooling and improve schema documentation. Total effort: M

### Story 8.1: Add orphaned entity detection
**Package(s):** `salvageunion-reference`
**Effort:** M

Add bidirectional validation to the existing validation tooling in `packages/salvageunion-reference/tools/`. Currently validation checks that references point to valid targets; this adds the reverse — finding entities that nothing references (potential orphans).

**Acceptance Criteria:**
- [ ] New validation script or flag that reports unreferenced entities
- [ ] Output distinguishes intentional root entities (chassis, classes) from potential orphans
- [ ] Runnable via `bun run validate:orphans` or integrated into `validate:all`
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 8.2: Fill empty JSON Schema descriptions
**Package(s):** `salvageunion-reference`
**Effort:** S

Audit `schemas/*.schema.json` files for empty `description` fields. Add meaningful descriptions to Zod schemas in `lib/schemas/` so they propagate to generated JSON schemas on rebuild.

**Acceptance Criteria:**
- [ ] All top-level schema objects have non-empty `description` fields
- [ ] All required properties have descriptions
- [ ] Descriptions generated from Zod source (not hand-edited in `.schema.json`)
- [ ] `bun run build:package` produces updated schemas

### Story 8.3: Pre-build search index
**Package(s):** `salvageunion-reference`
**Effort:** S

Replace the per-query scan in `packages/salvageunion-reference/lib/search.ts` with a pre-built index constructed at module import time. This avoids redundant work on repeated searches.

**Acceptance Criteria:**
- [ ] Search index built once on first access (lazy singleton)
- [ ] Search performance improved for repeated queries (no re-scanning)
- [ ] Existing search behavior and results unchanged
- [ ] All tests pass (`bun test`)

---

## Epic 9: SEO & Performance `[performance]`

> Improve discoverability and load performance for both web apps. Total effort: M

### Story 9.1: Add JSON-LD structured data to entity pages
**Package(s):** `suref-web`
**Effort:** M

Add JSON-LD structured data (Schema.org) to entity pages in `apps/suref-web/src/pages/schema/`. Use `Article` or `TechArticle` type with entity name, description, and breadcrumb.

**Acceptance Criteria:**
- [ ] JSON-LD `<script>` tag rendered in `<head>` on all entity detail pages
- [ ] Structured data validates with Google's Rich Results Test
- [ ] Breadcrumb structured data included
- [ ] No impact on static build time

### Story 9.2: Optimize island hydration strategy
**Package(s):** `suref-web`
**Effort:** S

Audit Astro island directives across `apps/suref-web/`. Replace `client:idle` with `client:visible` for below-fold interactive components to reduce initial JS execution.

**Acceptance Criteria:**
- [ ] Below-fold islands use `client:visible` instead of `client:idle`
- [ ] Above-fold critical islands retain `client:load` or `client:idle` as appropriate
- [ ] No functional regressions in island interactivity

### Story 9.3: Add route-level code splitting to ITUN
**Package(s):** `itun`
**Effort:** M

Use TanStack Router's `lazy()` to code-split large feature routes in `apps/in-the-union-now/src/routes/`. Target the largest route bundles first (game detail, pilot sheet, crawler sheet).

**Acceptance Criteria:**
- [ ] At least 3 large routes use `lazy()` loading
- [ ] Initial bundle size reduced (measure before/after)
- [ ] Loading states shown during route transitions
- [ ] All tests pass (`bun test`)

---

## Epic 10: Schema & Hook Cleanup `[cleanup]`

> Tighten schema optionality, eliminate `.select('*')`, and decompose god hooks. Total effort: L

### Story 10.1: Tighten AbilitySchema optionality
**Package(s):** `salvageunion-reference`
**Effort:** S

Review `AbilitySchema` where 6/8 fields are optional. Determine which fields are always present in practice and tighten the schema. May require a data audit of the JSON files.

**Acceptance Criteria:**
- [ ] Fields that are always present in data are marked required in the Zod schema
- [ ] Consumers updated to remove unnecessary optional chaining
- [ ] All validation passes (`bun run validate:all`)
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 10.2: Replace `.select('*')` with explicit columns
**Package(s):** `itun`
**Effort:** M

Replace 18 instances of `.select('*')` in Supabase queries with explicit column selections. This reduces payload size and makes the data contract explicit.

**Acceptance Criteria:**
- [ ] Zero `.select('*')` calls remain in ITUN source
- [ ] Each query selects only the columns it uses
- [ ] TypeScript types match the narrowed selections
- [ ] All tests pass (`bun test`)

### Story 10.3: Split usePilotSheet god hook
**Package(s):** `itun`
**Effort:** M

Split `usePilotSheet` (405 lines) into 4 focused hooks, each handling a distinct concern (e.g., pilot data, mech data, actions, mutations).

**Acceptance Criteria:**
- [ ] `usePilotSheet` replaced by 4 focused hooks, each under 120 lines
- [ ] Original hook file becomes a thin composition of the new hooks (or is removed)
- [ ] All pilot sheet functionality preserved
- [ ] Lint/typecheck clean (`bun run check:all`)

### Story 10.4: Migrate multi-table operations to Supabase RPCs
**Package(s):** `itun`
**Effort:** L

Migrate 7 non-atomic multi-table operations to Supabase RPCs for transactional safety: `createGame`, `createPilot`, `createCrawler`, `instantiateMechFromPattern`, `updateMechEntityRefs`, `updateCrawlerWeapon`, `joinGame`.

**Acceptance Criteria:**
- [ ] RPC functions created in Supabase (SQL migrations)
- [ ] Client code calls RPCs instead of sequential mutations
- [ ] Partial failure scenarios handled atomically (rollback on error)
- [ ] All tests pass (`bun test`)

---

## Epic 11: Combat Loop `[gameplay]`

> Implement the core combat gameplay loop: action execution, heat tracking, and damage application. These are the highest-impact gameplay gaps. Total effort: XL

**Phase 5II status:** Action execution (item 43) and damage application (item 46) are listed in Phase 5II Wave 3 (Live Play). Heat management (item 45) is related but net-new scope.

### Story 11.1: Action Execution — AP/EP/SP spending
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** L

Add a "Use Action" button to actions that deducts the appropriate resource (AP, EP, SP, HP) with validation that the player has sufficient resources. Include undo/confirmation UX.

**Acceptance Criteria:**
- [ ] "Use Action" button appears on all usable actions
- [ ] Clicking deducts the correct resource cost and persists to Supabase
- [ ] Insufficient resources shows a clear error (button disabled or warning)
- [ ] Action usage logged to the change log / activity feed

### Story 11.2: Heat Management
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** M

Link action execution to heat generation. Display current heat level with overheat warnings when approaching or exceeding thresholds.

**Acceptance Criteria:**
- [ ] Actions that generate heat increment the heat stat on use
- [ ] Overheat threshold displays a visual warning
- [ ] Heat-related game rules surfaced in tooltips or inline help
- [ ] Heat changes logged to change log

### Story 11.3: Damage Application
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** L

Add a "Take Damage" flow that applies SP damage to a mech, cascading to equipment condition changes (intact -> damaged -> destroyed) according to game rules.

**Acceptance Criteria:**
- [ ] "Take X SP damage" input available on mech sheet
- [ ] Damage cascades to systems/modules per Salvage Union rules
- [ ] Condition changes reflected immediately in the UI
- [ ] Damage events logged to change log

---

## Epic 12: Session Management `[gameplay]`

> Support session transitions with downtime, ability training, and class advancement. Total effort: XL

**Phase 5II status:** Downtime wizard (item 44) is referenced in Phase 5II as deferred scope. Ability training (item 47) and class advancement (item 52) are net-new.

### Story 12.1: Downtime Wizard
**Package(s):** `itun`
**Effort:** L

Implement a guided 10-step downtime flow that walks the mediator and players through the between-session process (repairs, crafting, ability training, etc.).

**Acceptance Criteria:**
- [ ] Wizard UI with step navigation (next/back/skip)
- [ ] Each step corresponds to a downtime phase from the rulebook
- [ ] State changes (repairs, scrap spending) persisted on completion
- [ ] Wizard can be resumed if interrupted

### Story 12.2: Ability Training UI
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** M

Add UI for spending TP to train new abilities, with prerequisite validation (class tree requirements, level requirements).

**Acceptance Criteria:**
- [ ] "Train Ability" flow accessible from pilot sheet
- [ ] TP cost deducted and validated
- [ ] Prerequisites enforced (cannot train abilities you don't qualify for)
- [ ] New abilities appear in pilot's ability list after training

### Story 12.3: Class Advancement UI
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** M

Implement the ceremony flow for advancing to hybrid or advanced classes, including prerequisite checks and class selection.

**Acceptance Criteria:**
- [ ] Advancement flow accessible when prerequisites are met
- [ ] Hybrid and advanced class options displayed with requirements
- [ ] Class change persisted and reflected across all views
- [ ] Advancement logged to change log

---

## Epic 13: Multiplayer & Social `[gameplay]`

> Fill gaps in the multiplayer experience: invite flows, pushing mechanics, and salvage/crafting. Total effort: L

**Phase 5II status:** Invite code flow (item 48) is part of Phase 5II Wave 2 (Multiplayer). Pushing, crafting, and salvage tallying are net-new.

### Story 13.1: Invite Code Join Flow
**Package(s):** `itun`
**Effort:** S

Add an "Enter Code" modal for new players to join a game via invite code.

**Acceptance Criteria:**
- [ ] "Join Game" button opens a code entry modal
- [ ] Valid codes add the player to the game with appropriate role
- [ ] Invalid/expired codes show a clear error
- [ ] New member appears in roster immediately

### Story 13.2: Pushing Mechanics
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** M

Implement the push/risk-reward modal that allows players to push actions for enhanced effect at a cost.

**Acceptance Criteria:**
- [ ] "Push" option available on eligible actions
- [ ] Risk/reward trade-off clearly communicated in the modal
- [ ] Push outcome applied to resources and logged

### Story 13.3: Crafting System
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** M

Implement basic crafting: select an item, spend the required scrap, and acquire the crafted item.

**Acceptance Criteria:**
- [ ] Crafting UI accessible from mech or crawler sheet
- [ ] Scrap costs validated against inventory
- [ ] Crafted item added to appropriate inventory
- [ ] Scrap deducted on completion

### Story 13.4: Salvage Tallying
**Package(s):** `itun`, `salvageunion-reference`
**Effort:** S

Convert destroyed items into scrap according to salvage rules. Provide a post-encounter "tally salvage" flow.

**Acceptance Criteria:**
- [ ] Destroyed items can be converted to scrap
- [ ] Scrap value calculated per game rules
- [ ] Scrap added to appropriate inventory (pilot or crawler)

---

## Epic 14: Discord Bot Expansion `[discord]`

> Extend the Discord bot with character display, resource management, and encounter tracking. Total effort: L

### Story 14.1: /character command
**Package(s):** `discord-bot`, `salvageunion-reference`
**Effort:** M

Add a `/character` slash command that displays pilot and mech stats as an embed.

**Acceptance Criteria:**
- [ ] `/character <name>` displays pilot stats (HP, AP, TP, class, abilities)
- [ ] Mech stats included (chassis, SP, Heat, systems, modules)
- [ ] Formatted as a Discord embed with clear layout
- [ ] Command registered and deployed via `bun run deploy-commands`

### Story 14.2: Resource management commands
**Package(s):** `discord-bot`
**Effort:** M

Add `/damage`, `/heal`, and `/spend` commands for managing character resources directly from Discord.

**Acceptance Criteria:**
- [ ] `/damage <amount>` applies SP damage to active mech
- [ ] `/heal <amount>` restores SP
- [ ] `/spend <resource> <amount>` deducts AP/EP/SP/HP
- [ ] All commands validate resource bounds

### Story 14.3: /encounter command
**Package(s):** `discord-bot`, `salvageunion-reference`
**Effort:** M

Add an `/encounter` command that summons enemy stat cards from the reference data.

**Acceptance Criteria:**
- [ ] `/encounter <enemy>` displays enemy stats as a formatted embed
- [ ] Supports all enemy types in salvageunion-reference
- [ ] HP tracking via message reactions or follow-up commands

### Story 14.4: ITUN integration
**Package(s):** `discord-bot`, `itun`
**Effort:** L

Connect the Discord bot to ITUN's Supabase backend so bot commands can read and update live campaign state.

**Acceptance Criteria:**
- [ ] Bot authenticates with Supabase using service role key
- [ ] `/character` pulls live data from ITUN campaigns
- [ ] Resource changes via bot commands reflected in ITUN UI (via realtime)
- [ ] RLS policies allow bot access appropriately

---

## Future Considerations (P3+)

The following items are acknowledged but not yet sized into stories. They should be revisited after Epics 1-14 are substantially complete or as user demand dictates.

| # | Item | Notes |
|---|------|-------|
| 54 | Campaign archive UI | Archive completed campaigns with read-only access |
| 55 | Dice rolling integration | In-app dice roller (may overlap with Discord bot) |
| 56 | Rumor gathering system | Downtime sub-feature |
| 57 | Bay damage effects tracking | Crawler-level damage mechanics |
| 58 | Dark mode support | Theme toggle in suref-react + both apps |
| 59 | Faction/formation tracking | Campaign-level social structures |
| 60 | Vehicle management in ITUN | Non-mech vehicle tracking |
| 61 | Creature/Bio-Titan encounter tracking | Specialized NPC stat blocks |
| 62 | Image uploads to Supabase Storage | Profile images, mech art |
| 63 | Export/Import (PDF sheets) | Character sheet PDF generation |
| 64 | Blackmarket item enforcement | Source-based item availability rules |
| 65 | Crawler population flavor text | Cosmetic NPC descriptions |

Additionally, **NPC/Enemy Encounter Tracking** (item 53) is a significant feature that bridges the Discord bot encounter command (Story 14.3) and the ITUN app. It should be planned as its own epic when combat loop features (Epic 11) are stable.

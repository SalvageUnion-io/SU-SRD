# ITUN Revamp — Tech Spec Data
<!-- Produced by ideate:architecture Phase 2 (Tech Spec) — orchestrated, autonomous mode -->
<!-- Feeds Arc42 §§1–4, 6–12 of ideate/architecture.md -->

**Source:** `ideate/PRD.md`, `ideate/prd-audit.md`, `ideate/milestones-data.md`, existing codebase
**Mode:** Orchestrator-dispatched, autonomous (no Q&A, no human review)
**Date:** 2026-05-17

---

## Project Breakdown

| Project | Purpose | Tech Stack | Documentation |
|---------|---------|------------|---------------|
| **ITUN SPA** (`apps/in-the-union-now/`) | Local-first single-player character builder — build/save/share/print pilots, mechs, crawlers | React 19.2, TypeScript 5.9, Vite 7.x, TanStack Router v1, TanStack Query v5, Zustand v5, Zod v4, Dexie 4.x, ShadCN + Tailwind v4, `suref-react` (workspace), `salvageunion-reference` (workspace) | [React](https://react.dev), [Vite](https://vite.dev), [TanStack Router](https://tanstack.com/router), [TanStack Query](https://tanstack.com/query), [Zustand](https://zustand.docs.pmnd.rs), [Zod](https://zod.dev), [Dexie](https://dexie.org) |
| **Snapshot Backend** (`netlify/functions/snapshots/`) | Anonymous publish + immutable retrieval by short URL; rate-limiting per IP | Netlify Functions (TypeScript) + Netlify Blobs (`@netlify/blobs`), `@netlify/functions` | [Netlify Functions](https://docs.netlify.com/functions/overview/), [Netlify Blobs](https://docs.netlify.com/blobs/overview/) |
| **`salvageunion-reference`** (`packages/salvageunion-reference/`) | **Preserved.** Zod-validated TypeScript ORM + JSON dataset for all SU game data | TypeScript 5.9, Zod v4 | [package-contracts.md](../docs/architecture/package-contracts.md) |
| **`suref-react`** (`packages/suref-react/`) | **Preserved.** Shared component library — theme, typography, entity display system, UI primitives | React 19.2, TypeScript 5.9, ShadCN, Tailwind v4, Radix UI | [package-contracts.md](../docs/architecture/package-contracts.md) |

**Adjacent (out of scope for this revamp):**
- `apps/suref-web/` — static SRD reference site; preserved, no changes in this effort
- `apps/discord-bot/` — Discord.js bot; preserved, no changes in this effort
- `apps/itun-legacy/` — archived; frozen at point-in-time

---

## Separation of Responsibilities

### ITUN SPA

**Owns:** All character-building UI, local persistence, rule enforcement, sheet rendering, print stylesheet, workspace grouping, contextual SU reference display, snapshot publish/open flow, JSON import/export (Should-Have).

| Responsibility | Description |
|----------------|-------------|
| Builder flows | Multi-step or tabbed flows for pilot, mech, crawler — each independently completable |
| Rule enforcement | Capacity/slot math, scrap tier math, cargo capacity — pure TypeScript utilities, unit-tested |
| Soft-warning system | Detects rule violations on save; surfaces warning + confirm-or-fix dialog |
| Local persistence | IndexedDB via Dexie: CRUD for Pilot, Mech, Crawler, Workspace, SoftLink, Pattern entities |
| Zustand stores | `entityStore`, `workspaceStore`, `uiStore` — ephemeral UI state, no server round-trips at MVP |
| TanStack Query | Wraps Dexie reads as queries (list/get) and mutations (create/update/delete/link); wraps snapshot publish/fetch for error-handling and loading state |
| Sheet rendering | All four composition modes (pilot-only, mech-only, crawler-only, wired); click-to-edit live stats |
| Print stylesheet | A4 + US Letter print media queries; `@page` rules; font embedding; page-break controls |
| Snapshot publish UX | "Publish" action calls Snapshot Backend → receives short URL → displays/copies it |
| Snapshot open UX | Routes `/:snapshotId` → fetches snapshot JSON from backend → renders read-only sheet |
| Workspace UI | Named workspace CRUD; assign/unassign builds; global "all builds" pool |
| Contextual reference | Inline entity displays (via `suref-react` `ReferenceEntityDisplay`) + deep-links to `suref-web` |

### Snapshot Backend

**Owns:** Anonymous publish endpoint, immutable retrieval endpoint, per-IP rate limiting, blob lifecycle.

| Responsibility | Description |
|----------------|-------------|
| Publish | POST `/api/snapshots` → validates payload (no PII), generates short ID, writes to Netlify Blobs (global store), returns `{ id, url }` |
| Retrieve | GET `/api/snapshots/:id` → reads blob → returns snapshot JSON; 404 for unknown IDs |
| Immutability | No PATCH / PUT / DELETE routes exposed; blob key = short ID (write-once at publish time) |
| Rate limiting | Per-IP counter in Netlify Blobs (or request header `x-nf-client-connection-ip`); rejects > 30/hour/IP |
| No PII | Payload stripped of any identifying fields before storage; IP not stored in blob content |

### `salvageunion-reference` (preserved)

**Owns:** All canonical SU game data (27 schemas), Zod schemas, TypeScript ORM, JSON dataset, lazy-load API. No changes in this project.

### `suref-react` (preserved)

**Owns:** Theme (SU brand colors, Tailwind v4 config), base typography (`Text`), entity display system (`ReferenceEntityDisplay`, `DisplayCard`, etc.), UI primitives, shared utilities. New components built in ITUN that prove generally useful are promoted to `suref-react` post-stabilization.

---

## Integration Points

| System | Direction | Pattern | Purpose | Discovery Required | Documentation |
|--------|-----------|---------|---------|-------------------|---------------|
| `salvageunion-reference` | In → ITUN SPA | TypeScript workspace import + `preload()` API | All canonical SU game data, rule references, roll tables | None — workspace package | [package-contracts.md](../docs/architecture/package-contracts.md) |
| `suref-react` | In → ITUN SPA | TypeScript workspace import (no build step) | Shared components, theme, entity displays | None — workspace package | [package-contracts.md](../docs/architecture/package-contracts.md) |
| `suref-web` (sibling) | Outbound deep-link | URL hand-off (anchor `href`) | Full SRD entity browsing | Stable URL structure for entity pages (`/schema/[schemaId]/item/[itemId]`) | `apps/suref-web/src/pages/` |
| Snapshot Backend | Out → In (HTTPS) | REST (POST publish, GET retrieve) | Anonymous build publishing + sharing | None — same Netlify project | Netlify Functions docs |
| Netlify Blobs | ITUN SPA → Backend | `@netlify/blobs` SDK (server-side only) | Blob storage for snapshots | None — auto-provisioned by Netlify | [Netlify Blobs](https://docs.netlify.com/blobs/overview/) |
| IndexedDB | ITUN SPA internal | Browser API via Dexie | Primary local persistence | None — browser primitive | [Dexie.js](https://dexie.org/docs/) |
| Netlify CDN | Static assets | Build artifact + Netlify deploy | SPA hosting, asset caching | Netlify project config | [Netlify Docs](https://docs.netlify.com/) |

---

## Proposed Technology Stack

### Core Technologies (verified 2026-05-17)

| Layer | Technology | Version | Check Source | Rationale |
|-------|------------|---------|-------------|-----------|
| **SPA Framework** | React | 19.2.0 | `package.json` (in-repo) | Matches existing workspace alignment; React 19 concurrent features, use client/server patterns; all shared packages built for 19.x |
| **Language** | TypeScript | 5.9.3 | `package.json` (in-repo) | Workspace standard; latest stable |
| **Build tool** | Vite | 7.x (`^7.2.2` in pkg.json) | `package.json` (in-repo); context7 confirms v7/v8 line active | Inherited from legacy ITUN; fastest HMR; excellent TanStack Router plugin; `@netlify/vite-plugin-tanstack-start` already a dev dep |
| **Router** | TanStack Router | v1.x (`^1.136.1`) | `package.json` (in-repo); context7 confirms v1 stable | Already in legacy ITUN; file-based routing, type-safe params, SPA-first; far better fit for local-first SPA than Astro's static model |
| **Server state / async** | TanStack Query | v5.x (`^5.90.9`) | `package.json` (in-repo) | Wraps Dexie queries and snapshot HTTP calls; provides loading/error state, optimistic updates, and cache invalidation without a real server |
| **Client state** | Zustand | v5.x (`^5.0.11`) | `package.json` (in-repo); context7 confirms v5.0.12 | UI-ephemeral state (active workspace, open panels, soft-warning dialog); no auth store at MVP |
| **Validation** | Zod | v4.x (`^4.3.6`) | `package.json` (in-repo); context7 confirms v4.0.1 | Workspace standard; `salvageunion-reference` already at v4; local entity schemas defined with Zod |
| **Local persistence** | Dexie | ^4.x | context7 `/dexie/dexie.js` — v4 confirmed | See ADR-002; migration-aware, TypeScript-native, excellent DX for versioned schema evolution |
| **UI components** | ShadCN + Radix UI | ShadCN latest (no pkg version); Radix per component | ShadCN docs; inherited from legacy ITUN | Workspace standard; integrated with `suref-react` theme |
| **Styling** | Tailwind CSS v4 | 4.2.1 | `package.json` (root) | Workspace standard; `@source` paths already configured for `suref-react` |
| **Runtime / package manager** | Bun | 1.3.14 | `bun --version` on host | Workspace standard; current stable |
| **Snapshot backend compute** | Netlify Functions (TypeScript) | `@netlify/functions` latest | Netlify MCP coding rules confirmed API | See ADR-001; same Netlify project as SPA; zero additional infra |
| **Snapshot blob storage** | Netlify Blobs | `@netlify/blobs` latest | Netlify MCP coding rules confirmed API | Zero-config, auto-provisioned, 5 GB max object, global store for cross-deploy persistence |
| **Lint / format** | ESLint 10 + Prettier 3 | 10.0.3 / 3.8.1 | `package.json` (root) | Workspace standard |
| **Pre-commit / pre-push hooks** | Lefthook | 2.1.4 | `package.json` (root) | Workspace standard; pre-commit: lint+format+typecheck; pre-push: test+validate |
| **A11y CI** | puppeteer-core + axe-core | per tools/a11y-scan.ts | Root `package.json` | Existing `a11y-scan` skill enforces WCAG 2.1 AAA/AA gating |
| **Testing** | Bun test runner + React Testing Library | Bun 1.3.14 / RTL 16.3.2 | `package.json` (root) | Workspace standard |

### Infrastructure Platform

**Primary: Netlify** (existing deployment target)

| Component | Service | Purpose |
|-----------|---------|---------|
| **SPA hosting** | Netlify CDN | Static Vite build; SPA redirect rule (`/* → /index.html, 200`) |
| **Snapshot API** | Netlify Functions | TypeScript serverless functions at `/api/snapshots` |
| **Blob storage** | Netlify Blobs (global store) | Snapshot JSON storage; key = short ID |
| **CI/CD** | Netlify CI (auto-deploy on push) | Build command: `bun run build:package:ci && bun --filter in-the-union-now build` |

**Alternative evaluated:** Cloudflare Workers + KV (see ADR-001 for trade-off analysis).

---

## Environment Strategy

| Environment | Purpose | Infrastructure | Notes |
|-------------|---------|---------------|-------|
| **Development** | Local coding + unit tests | `bun run dev:itun` (Vite dev server); Netlify Blobs emulated via `@netlify/vite-plugin-tanstack-start` | IndexedDB is real browser storage; blobs use sandboxed local store |
| **Staging** | Integration testing, snapshot backend smoke tests | Netlify Deploy Preview (auto-created per PR) | Uses deploy-scoped Netlify Blobs store (not global production store) |
| **Production** | Live app for SU players | Netlify production deploy; global Netlify Blobs store | Global blobs store ensures cross-deploy snapshot persistence |

**Environment isolation for Netlify Blobs:** The snapshot Function checks `Netlify.context?.deploy.context === 'production'` and uses `getStore()` for production vs. `getDeployStore()` for all other contexts. This prevents staging test snapshots from polluting the production blob namespace.

---

## Security Architecture

### Security Layers

| Layer | Controls |
|-------|----------|
| **Transport** | TLS enforced by Netlify CDN (HSTS header already in `netlify.toml`); all snapshot API calls over HTTPS |
| **Anonymous publish model** | No auth token required; the short URL itself is the capability token — sufficiently unguessable (128-bit entropy nanoid) |
| **Rate limiting** | Per-IP counter in Netlify Blobs (`rate::{ip}` key, per-hour counter); publish returns 429 if > 30 req/hour/IP |
| **Immutability** | Snapshot blobs written once at publish time; no update or delete routes exposed |
| **No PII** | Snapshot payload validated (Zod) to reject any field matching known PII patterns; IP address never stored in blob content |
| **CSP** | Existing `netlify.toml` Content-Security-Policy header; `connect-src` updated to include snapshot API path |
| **Spam / abuse** | Short ID ≠ guessable sequence; no listing endpoint; low operational risk at projected scale (< 10k snapshots/year) |
| **Denial-of-service** | Netlify's built-in DDoS protection + rate limiting; solo-project risk profile is low |

### Compliance Considerations

| Requirement | Approach |
|-------------|----------|
| No PII collection (REQ-NF-06) | Zod schema for snapshot payload explicitly excludes any identifying fields; no auth, no user ID, no IP stored |
| Snapshot immutability (REQ-NF-05) | Netlify Functions expose GET (retrieve) and POST (publish) only; no PATCH/PUT/DELETE |
| Snapshot retention ≥ 1 year (REQ-NF-09) | Netlify Blobs global store has no automatic TTL; blobs persist until explicitly deleted. The target is ≥ 1 year passive retention. A scheduled cleanup function can be added post-MVP if storage grows unexpectedly |

---

## Scalability & Performance

### Load Scenarios

| Scenario | Volume | Approach |
|----------|--------|----------|
| **Normal use** | < 10k snapshot publishes/year (solo-maintainer project, early community) | Netlify Blobs global store; no scaling concern |
| **Peak burst** | Community event (forum post goes viral) — up to 500 publishes/day | Per-IP rate limiting absorbs spam; Netlify auto-scales functions |
| **Snapshot reads** | Read-heavy (share links clicked by friends/community) | Netlify CDN + function cold-start is acceptable; no read cache needed at this scale |

### Client-Side Performance (the real scaling surface)

The vast majority of performance work is client-side (local-first means no server latency for build/edit/save/load). Key targets:

| Target | Approach |
|--------|----------|
| TTI ≤ 3.0 s (REQ-NF-01) | Vite code-splitting; `salvageunion-reference.preload()` lazy — defer full load until after first paint; route-based chunk splitting via TanStack Router |
| Local save ≤ 100 ms (REQ-NF-02) | Dexie writes are async; Zustand store updates optimistically before Dexie confirms; no blocking UI render |
| 60 FPS sheet scroll on mobile (REQ-NF-03) | Avoid layout-triggering reads during scroll; use CSS `contain: content` on sheet sections; avoid heavy JS during scroll events |
| `salvageunion-reference` load budget | ~1.1 MB total JSON; selective `preload(['chassis', 'systems', 'modules'])` on builder entry; preload all on app load after first paint |

---

## Cross-Cutting Concepts (Arc42 §8)

### Coding Conventions

Inherited from repo `CLAUDE.md` and `.claude/rules/`:
- Relative imports only (no `@/` aliases)
- `type` over `interface` for object types
- `import type` for type-only imports
- Named exports everywhere except TanStack Router file-based route components (may use default exports)
- Zod schemas define local entity types; TypeScript types inferred via `z.infer`
- No React Context; Zustand + TanStack Query for all state

### Soft-Link Data Model

Pilot, Mech, Crawler, and Pattern are **independent top-level entities** stored as separate IndexedDB records. Relationships are expressed as `SoftLink` records:

```
SoftLink { id, fromType, fromId, toType, toId, linkType: 'mech-to-pilot' | 'pilot-to-crawler' }
```

- Deleting an entity removes all `SoftLink` records that reference it; the linked entity is unaffected.
- Rendering a mech sheet with no linked pilot record shows an "auto stand-in" placeholder section, not blank fields.
- This model is upgrade-path-aware: when multiplayer is added, `SoftLink` records gain optional `campaignId` and `ownerId` fields without schema breaking changes.
- Workspace grouping follows the same pattern: `WorkspaceAssignment { workspaceId, entityType, entityId }` — an entity can belong to one workspace (or none). Moving it is a record update, not a schema change.

### State Management Boundary

| Layer | Owner | What lives here |
|-------|-------|-----------------|
| **IndexedDB (Dexie)** | Persistence | Authoritative source of truth for all local builds — Pilot, Mech, Crawler, Workspace, SoftLink, Pattern, WorkspaceAssignment |
| **TanStack Query** | Async data management | Wraps Dexie reads as queries (key factories like `pilotKeys.all`); wraps snapshot HTTP calls; provides loading/error state, cache invalidation, optimistic mutations for edit operations |
| **Zustand** | Ephemeral UI state | Active workspace selection, open panels/modals, soft-warning dialog state, current edit mode — nothing that needs to survive a page reload |
| **React component state** | Micro-ephemeral state | Form field values within a single builder step; not hoisted unless needed by a sibling |

TanStack Query is the right fit even in a local-first app because it eliminates boilerplate loading/error patterns and gives clean optimistic update semantics. It wraps Dexie the same way it would wrap `fetch` — the adapter is a `queryFn` that calls `db.pilots.get(id)` instead of hitting an HTTP endpoint.

### Error Handling and Offline Tolerance

- All non-snapshot operations (build, edit, save, load, delete, print) must be fully functional offline after initial app load.
- IndexedDB errors (quota exceeded, schema version mismatch) surface as toast notifications with non-blocking recovery suggestions.
- Snapshot publish errors (network offline, rate-limit, server error) surface as toast notifications with a "retry" path; the build is not lost.
- Dexie schema migration errors on upgrade result in a migration failure dialog with a "download raw data and reset" escape hatch — avoids silent data loss.

### Shared-Package Reuse Rules

- All cross-cutting UI components from `suref-react`: `DisplayCard`, `ReferenceEntityDisplay`, `Text`, `FilterChip`, `Modal`, `RollTable`, `ValueDisplay`, `StatDisplay`, `StatsBar`, etc.
- All game data exclusively via `salvageunion-reference` — no inline copies of chassis names, ability text, roll table entries.
- New ITUN-specific components that prove generally useful (e.g., a new entity display slot variant, a new print-helper component) are promoted to `suref-react` after stabilization per the package-contracts cross-package checklist.

---

## Runtime Scenarios (Arc42 §6)

### SC-01: Build a standalone pilot (REQ-001, REQ-010)

User selects "New Pilot" from the dashboard. TanStack Router navigates to `/pilots/new`. The pilot wizard component loads pilot-related schemas via `SalvageUnionReference.preload(['classes', 'abilities', 'equipment', 'rollTables'])`. The user completes class selection, ability picks (filtered by class), equipment selection (capacity-enforced), and roll-table results for callsign/motto/keepsake/appearance. On "Save," `entityStore.createPilot(data)` is called, which writes a new `Pilot` record to IndexedDB via Dexie. No mech or crawler record is required. The pilot list page immediately reflects the new entry via TanStack Query cache invalidation on `pilotKeys.all`.

### SC-02: Build a standalone mech (REQ-002, REQ-009, REQ-013, REQ-014, REQ-015)

User selects "New Mech." The mech builder loads `['chassis', 'systems', 'modules', 'cargo']` schemas. The user selects a chassis (slot layout displayed from `chassis.systemSlots` and `chassis.moduleSlots`). Each system/module addition calls the `capacity.ts` utility synchronously — if slots are exceeded, the addition is blocked with a clear UI error (REQ-009). Scrap budget and cargo capacity are recomputed on each addition via `scrap.ts` and `cargo.ts`. On save, a `Mech` record is written to IndexedDB. No pilot record is required; the sheet preview renders with an "auto stand-in" pilot section. The user may optionally save the build as a named `Pattern` record (REQ-013).

### SC-03: Build a standalone crawler (REQ-003, REQ-005)

User selects "New Crawler." The crawler builder loads `['crawlers', 'crawlerBays', 'techLevels']` schemas. The user configures crawler name, tech level, bays, and systems. No pilot assignment is required; the sheet preview shows a "No pilots assigned" stand-in. On save, a `Crawler` record is written to IndexedDB.

### SC-04: Wire entities together (REQ-004)

From any entity detail view, the user selects "Assign Mech" (on a pilot) or "Assign Pilot" (on a crawler). A selection modal lists compatible existing entities. On confirm, a `SoftLink` record is written to IndexedDB. The sheet view for the pilot now renders the linked mech's data inline. Deleting the mech later removes the `SoftLink` record and reverts the pilot sheet to the auto stand-in for mech — the pilot record itself is unaffected.

### SC-05: Publish a snapshot (REQ-017, REQ-NF-04..06)

From the sheet view, user clicks "Publish." The ITUN SPA serializes the current build to a JSON payload (stripping any ephemeral UI state). TanStack Query's `useMutation` calls `POST /api/snapshots` with the payload. The Netlify Function validates the payload with Zod (no PII fields), checks the per-IP rate counter in Netlify Blobs, generates a `nanoid`-derived short ID, and writes `snapshots::{id}` to the global Netlify Blobs store. The Function returns `{ id, url: "https://itun.app/s/{id}" }`. The SPA displays the short URL with a copy-to-clipboard button. Total network round-trip budget: < 2 s on broadband.

### SC-06: Open a published snapshot (REQ-018)

A friend receives the URL `https://itun.app/s/abc123`. TanStack Router matches the route `/s/:snapshotId`. The `SnapshotView` component mounts; TanStack Query calls `GET /api/snapshots/abc123`. The Netlify Function reads from Netlify Blobs and returns the JSON. The SPA renders the build in a read-only sheet view (no edit controls, no publish button). If the snapshot ID is unknown, the Function returns 404 and the SPA shows a "Snapshot not found" page.

### SC-07: Print a sheet (REQ-019, REQ-NF-13, REQ-NF-14)

From the sheet view, user clicks "Print" or uses Ctrl/Cmd+P. The browser print dialog opens. The CSS print stylesheet (`@media print`) hides navigation, edit controls, and sidebars; displays only the sheet content. `@page` rules set margins for A4 and US Letter with a user-selectable switch (or dual `@page` size declarations). Page breaks are inserted before the mech section (if wired sheet). Fonts are embedded via `@font-face` with local fallbacks. The maintainer visual review gate confirms professional fidelity before M2 release.

### SC-08: Edit sheet stats live (REQ-016)

On the sheet view, the user clicks a stat value (e.g., HP). The stat field transitions to an inline edit mode (native `contenteditable` or a small Radix-based controlled input). The user types the new value and blurs or presses Enter. TanStack Query's `useMutation` calls `entityStore.updatePilot(id, { hp: newValue })`, which writes to IndexedDB. The mutation applies an optimistic update immediately (< 100 ms, REQ-NF-02). If the Dexie write fails, the rollback path reverts the displayed value and shows a toast.

### SC-09: Capacity enforcement triggers a block (REQ-009)

During mech building, the user attempts to drag a system into a slot that is already full. `capacity.ts` is called synchronously with the current mech state + the candidate system. It returns `{ allowed: false, reason: 'No system slots remaining (3/3 used)' }`. The UI shows a non-dismissible inline error on the slot target; the add action does not proceed. No Dexie write occurs.

### SC-10: Soft-warning progression edit (REQ-012)

The user opens a saved pilot and adds an ability marked in `salvageunion-reference` as level-4-locked. On "Save," `softWarnings.ts` is called and returns a warning: `"Bionic Senses is normally available at level 4. This pilot is level 2."` A modal presents the warning and two options: "Save anyway" and "Cancel." If the user confirms, the Pilot record is written to IndexedDB with the ability added. The soft warning is stored alongside the pilot record as a `softWarningFlags` field for display on the sheet.

---

## Quality Requirements (Arc42 §10)

### Quality Tree

```
ITUN Revamp Quality
├── Performance
│   ├── QS-001: TTI ≤ 3.0 s broadband desktop
│   ├── QS-002: Local save ≤ 100 ms
│   └── QS-003: Sheet scroll 60 FPS mobile
├── Reliability / Offline Tolerance
│   ├── QS-004: All non-publish features functional offline post-load
│   └── QS-005: Snapshot publish idempotency (no silent overwrites)
├── Accessibility
│   ├── QS-006: WCAG 2.1 AAA on sheet view (zero violations in CI)
│   └── QS-007: WCAG 2.1 AA on all other views (zero violations in CI)
├── Security
│   ├── QS-008: Rate-limit publish at 30/hour/IP
│   ├── QS-009: Snapshot immutability (no PATCH/PUT/DELETE)
│   └── QS-010: No PII stored in snapshots
├── Usability / Ergonomics
│   ├── QS-011: Touch targets ≥ 44 × 44 px on sheet view
│   ├── QS-012: No horizontal scroll at 320 px viewport
│   ├── QS-013: A4 + US Letter print fidelity (maintainer-reviewed)
│   └── QS-014: First-build time ≤ 10 min (fresh visitor)
└── Maintainability
    ├── QS-015: All shared UI from suref-react; all game data from salvageunion-reference
    ├── QS-016: bun run check:all green on every PR
    ├── QS-017: Lefthook pre-commit + pre-push pass on every commit
    └── QS-018: Rule-enforcement utilities have unit tests
```

### Quality Scenarios

| QS-ID | Source | Stimulus | Response | Measure |
|-------|--------|----------|----------|---------|
| QS-001 | New visitor on broadband | Opens ITUN for the first time | App reaches interactive state | ≤ 3.0 s TTI (Lighthouse) |
| QS-002 | Player saves a mech edit | Clicks "Save" | IndexedDB write completes, UI acknowledges | ≤ 100 ms (P95) |
| QS-003 | Player scrolls sheet on iPhone | Scrolls sheet view end-to-end | No dropped frames | ≥ 60 FPS (DevTools) |
| QS-004 | Player goes offline mid-session | Builds, edits, deletes a build | All local operations succeed | Zero feature degradation (except publish) |
| QS-006 | CI `a11y-scan` run | Scans sheet view | axe-core reports | Zero WCAG 2.1 AAA violations |
| QS-008 | Automated spam script | 31 publish requests in 60 min from same IP | 31st request rejected | HTTP 429 returned; no 31st blob stored |
| QS-009 | Attacker PATCHes snapshot | PATCH `/api/snapshots/:id` | Server rejects | HTTP 405 returned |
| QS-013 | Maintainer print review | Prints mech sheet on A4 in Chrome | Visual review | No clipped fields, professional typography |
| QS-016 | Developer pushes PR | CI runs `bun run check:all` | All gates pass | Zero lint/typecheck/test/validate failures |

---

## Architecture Decisions (Arc42 §9)

### ADR-001: Snapshot Publishing Backend — Netlify Functions + Blobs

**Status:** Accepted

**Context:**
The snapshot publishing requirement (REQ-017, REQ-018) needs: anonymous POST to publish, GET to retrieve by short ID, immutable storage, per-IP rate limiting, no PII, ≥ 1 year retention, solo-maintainer operability, Netlify-aligned hosting.

**Decision Drivers:**
- Operational simplicity for a solo maintainer
- Zero additional account/project to manage at MVP
- Netlify is the existing deployment target (confirmed by `netlify.toml`)
- Free-tier-appropriate at projected scale (< 10k snapshots/year)
- Auth-layering path must remain credible

**Considered Options:**

| Option | Pros | Cons | Eliminated Because |
|--------|------|------|-------------------|
| **Netlify Functions + Blobs** | Same project, zero additional infra, auto-provisioned, no account management, `@netlify/vite-plugin-tanstack-start` already a dev dep | Netlify vendor lock-in for blob layer; no built-in rate-limit primitive (need custom counter) | **Selected** |
| Cloudflare Workers + KV | Fast global edge, generous free tier, KV is well-suited to key-value snapshot storage | Separate account/project from Netlify; two platform relationships to manage; Workers + KV have per-request/per-storage costs at scale | Operational overhead for solo maintainer |
| Supabase (new project, anon-only) | Familiar pattern (legacy ITUN used Supabase); good free tier; supports auth upgrade path natively | New Supabase project to manage after decommissioning the old one; SQL + RLS for what is essentially a key-value blob operation is over-engineered; contradicts the "no more Supabase at MVP" direction | Over-engineered for the use case; adds back what was just removed |
| Upstash (Redis) | Fast, generous free tier | Extra account; Redis for immutable blobs is semantically awkward; rate limiting via Redis INCR is correct but the extra vendor adds friction | Extra vendor |
| Turso (SQLite) | Edge-native SQLite | Extra account; relational DB for key-value blobs is over-engineered | Over-engineered |
| Vercel KV | Similar to Upstash | Netlify + Vercel is contradictory; two CDN/edge vendors | Platform conflict |

**Decision Outcome:**
Use **Netlify Functions (TypeScript)** for the compute layer and **Netlify Blobs (global store)** for snapshot storage. Two functions: `POST /api/snapshots` (publish) and `GET /api/snapshots/:id` (retrieve). Rate limiting implemented via a Blobs-backed per-IP counter (`rate::{ip_hash}::hour`). Short IDs generated with `nanoid` (~21 chars, ~128-bit entropy). Snapshot payload validated with Zod before storage.

**Consequences:**
- (+) Zero additional accounts or projects to manage
- (+) Same deploy pipeline as the SPA — snapshot functions deploy with the app
- (+) `@netlify/vite-plugin-tanstack-start` already present in dev deps; blobs emulated locally
- (+) Auth upgrade path: Netlify supports auth extensions; a magic-link flow can be layered on top of anonymous snapshots by adding a `ownerId` field to the blob metadata without rewriting the storage model
- (−) Netlify Blobs eventual consistency (default); for snapshot reads this is acceptable (URL shared asynchronously)
- (−) Custom rate-limit implementation (not a managed service); acceptable for < 10k/year scale
- (−) Netlify vendor dependency for blob layer; mitigated by the fact that snapshot JSON could be re-imported to another store with a migration script if needed

**Links:** REQ-017, REQ-018, REQ-NF-04, REQ-NF-05, REQ-NF-06, REQ-NF-08, REQ-NF-09

---

### ADR-002: Local Persistence Library — Dexie (over raw `idb` or `idb-keyval`)

**Status:** Accepted

**Context:**
The app needs IndexedDB persistence for Pilot, Mech, Crawler, Workspace, SoftLink, Pattern, and WorkspaceAssignment records. Schema will evolve across releases (schema versioning and migration are required). The choice is between raw IndexedDB API, `idb` (thin promise wrapper), `idb-keyval` (key-value only), or Dexie (full ORM-style abstraction).

**Decision Drivers:**
- Schema migration support is load-bearing: builds may be persisted for years; schema changes must not lose user data
- TypeScript integration and type inference quality
- Bundle size impact relative to benefit
- DX for a solo maintainer writing complex multi-table queries

**Considered Options:**

| Option | Bundle | Migration support | DX | Eliminated Because |
|--------|--------|------------------|----|--------------------|
| Raw IndexedDB API | 0 KB | Manual (onupgradeneeded) | Low — verbose, callback-heavy | Too much boilerplate for complex multi-table migrations; no TypeScript type inference |
| `idb` (jakearchibald/idb) | ~5 KB | Manual | Medium — promise-based but still low-level | Migration story is still manual; minimal DX uplift for the schema complexity needed |
| `idb-keyval` | ~1 KB | None — KV only | Low for multi-entity | KV-only; can't model relational structure (SoftLinks, WorkspaceAssignments) without layering |
| **Dexie** | ~30 KB | First-class (`.version(n).stores(...).upgrade()`) | High — table-per-entity, query API, TypeScript-native | **Selected** |

**Decision Outcome:**
Use **Dexie v4** as the IndexedDB abstraction layer. Each entity type gets a typed Dexie table. Schema versioning starts at v1; future versions add `.upgrade()` callbacks per the Dexie migration API. The Dexie instance is created once, shared via a module-level singleton, and consumed by Zustand stores and TanStack Query `queryFn`s.

**Consequences:**
- (+) First-class migration support reduces risk of data loss on schema evolution
- (+) TypeScript type inference is built-in
- (+) Query API (`.where()`, `.filter()`) is readable and maintainable
- (+) Context7 docs confirm Dexie v4 migration patterns are well-documented
- (−) ~30 KB bundle addition (acceptable; reference data is ~1.1 MB)
- (−) Dexie abstracts away raw IndexedDB debugging; developer must understand Dexie's version model

**Links:** REQ-006, REQ-007, REQ-008, REQ-NF-02

---

### ADR-003: App Framework — Vite + TanStack Router + React 19 SPA (over Astro 5)

**Status:** Accepted

**Context:**
The app shell for the new ITUN could use either Astro 5 (as `suref-web` does) with React islands, or the Vite + TanStack Router + React 19 SPA pattern (as the legacy ITUN uses). These have meaningfully different architectural implications for a local-first interactive app.

**Decision Drivers:**
- ITUN is a fully interactive SPA, not a content site with islands of interactivity
- Local-first persistence (IndexedDB) requires client-side JS on every route
- TanStack Router's type-safe route params are important for snapshot URLs and entity URLs
- Legacy ITUN already invested in the TanStack Router pattern; the file-based routing structure and router plugin are known quantities

**Considered Options:**

| Option | Fit for ITUN | Eliminated Because |
|--------|-------------|-------------------|
| **Vite + TanStack Router + React 19** | Excellent — pure SPA, client-side routing, no SSR overhead, type-safe params, `@netlify/vite-plugin-tanstack-start` already in devDeps | **Selected** |
| Astro 5 + React islands | Good for `suref-web` (content-heavy, static) | Poor fit for a fully interactive app: every ITUN route needs full React; islands add complexity without benefit; `useQuery` + Zustand + Dexie are all client-only — Astro's partial hydration model adds friction rather than value; Astro Router does not provide TanStack Router's type-safe param guarantees |

**Decision Outcome:**
Retain **Vite + TanStack Router v1 + React 19** as the app shell. File-based routing in `src/routes/`. This is a direct continuation of the legacy ITUN's framework stack, minus Supabase and auth.

**Consequences:**
- (+) Consistent with existing monorepo patterns and maintainer familiarity
- (+) TanStack Router file-based routing generates type-safe `routeTree.gen.ts` — already excluded from lint per monorepo conventions
- (+) `@netlify/vite-plugin-tanstack-start` dev dep enables local Netlify Functions + Blobs emulation
- (+) Pure client-side SPA is the correct model for local-first IndexedDB apps
- (−) No SSR / server components — acceptable for this use case; snapshots are rendered client-side

**Links:** REQ-NF-01, REQ-NF-07, REQ-NF-20

---

### ADR-004: State Architecture — Zustand (UI) + TanStack Query (async data) + Dexie (persistence)

**Status:** Accepted

**Context:**
The legacy ITUN used Zustand for auth state and TanStack Query for all Supabase server state. In the new local-first ITUN, there is no server at MVP (except the snapshot backend). The question is whether TanStack Query still adds value when the "server" is IndexedDB.

**Decision Drivers:**
- TanStack Query provides loading/error state, optimistic updates, and cache invalidation that would otherwise require significant manual Zustand boilerplate
- The snapshot HTTP calls (publish + retrieve) are genuine async network operations that benefit from TanStack Query's error/retry/loading lifecycle
- No React Context per project conventions

**Decision Outcome:**
Three-layer architecture:
1. **Dexie** — authoritative persistence (IndexedDB)
2. **TanStack Query** — async data management layer wrapping both Dexie reads/mutations and snapshot HTTP calls
3. **Zustand** — ephemeral UI state only (active workspace, modal open/close, soft-warning dialog state)

TanStack Query `queryFn` for local reads calls `db.pilots.toArray()` (or equivalent). This is not a server call but it is asynchronous and benefits from TanStack Query's loading state, cache key management, and `useMutation`'s optimistic update / rollback pattern.

**Consequences:**
- (+) Consistent with monorepo patterns; no new state management paradigm
- (+) Optimistic mutations work identically for local (Dexie) and remote (snapshot) operations
- (+) Clean separation: Zustand never holds entity data; TanStack Query never holds UI state
- (−) Slight conceptual mismatch: using a "query cache" for local data may surprise developers unfamiliar with the pattern; document the `queryFn` = Dexie adapter pattern explicitly in `docs/architecture/data-flow.md` (update required post-implementation)

**Links:** REQ-NF-20; addresses milestones-data.md assumption #9

---

### ADR-005: Print Stylesheet Strategy

**Status:** Accepted

**Context:**
The print stylesheet is a first-class MVP deliverable (REQ-019, REQ-NF-13, REQ-NF-14). The approach must produce professional output at both A4 and US Letter without a separate PDF-generation service.

**Decision Outcome:**
Pure CSS `@media print` approach. No PDF library, no server-side rendering, no Puppeteer-based PDF export at MVP.

Key implementation decisions:
- **Page size:** `@page { size: A4 }` as default; a user-accessible "US Letter" toggle changes the `@page { size: letter }` rule via a CSS custom property or an alternate stylesheet applied via `<link media>`. Both sizes are testable in Chrome's print preview.
- **Page breaks:** `break-before: page` before the mech section in wired sheets; `break-inside: avoid` on entity cards and ability blocks.
- **Font embedding:** `suref-react`'s `@font-face` declarations with WOFF2 sources; fallbacks to system serif/sans. Fonts already loaded for screen use are reused in print.
- **Hide screen-only elements:** Navigation, edit controls, publish button, workspace sidebar — hidden via `display: none` in print media.
- **Color:** AAA contrast targets on sheet view already exceed print legibility thresholds; minimal adjustments needed. Avoid ink-heavy backgrounds in print media (prefer border-based section separators).
- **Maintainer review gate:** Print quality is not CI-automated; an explicit maintainer visual review is a M2 DoD gate item.

**Consequences:**
- (+) No external dependency; works offline; no per-print cost
- (+) Browser print dialog gives user the paper size and margin control they expect
- (−) CSS print quirks differ across browsers (Chrome is the reference target; Firefox is secondary; Safari ≥ 16 is tertiary)
- (−) Cannot guarantee pixel-perfect identical output across browsers — acceptable for a rulebook-fidelity target

**Links:** REQ-019, REQ-NF-13, REQ-NF-14

---

### ADR-006: Auth Runway — Anonymous → Magic-Link Upgrade Path

**Status:** Decision record only (upgrade path, not built)

**Context:**
MVP has no auth (REQ-W-02). The architecture must not foreclose adding magic-link or full-account auth later without rewriting the snapshot system.

**Upgrade path design:**
1. **Anonymous phase (MVP):** Snapshots have no `ownerId`. Short URL = capability token. No user identity in the system.
2. **Magic-link phase (post-MVP):** Netlify Identity or a lightweight JWT provider is added. When a user publishes while authenticated, the `ownerId` field is written to the blob's metadata (`getStore().set(id, payload, { metadata: { ownerId } })`). Existing anonymous snapshots are unaffected (no `ownerId`).
3. **Full-auth phase:** `ownerId` enables "my published snapshots" list, snapshot deletion by author, and cloud sync of local builds.
4. **IndexedDB migration:** The `Pilot/Mech/Crawler` Zod schemas include an optional `cloudId` field from v1. When auth is added, the sync layer writes `cloudId` on first cloud save — no schema migration required.

**The snapshot system does not need to be rewritten** because Netlify Blobs metadata is mutable (blob content is immutable, but metadata can be updated). The publish function signature stays the same; an optional `Authorization` header is layered on top.

**Links:** REQ-W-02, PRD §2.2 architectural runway

---

## Risks & Technical Debt (Arc42 §11)

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|-----------|
| R-01 | **Scope creep back toward multiplayer / combat** (PRD R-1) | H | H | §5.4 Won't-Have list is binding. Architecture ADRs explicitly defer these. Every PR is reviewed against scope. |
| R-02 | **Composability data model edge cases** (PRD R-2) | M | M | ADR-004 documents SoftLink model. Spike on snapshot mutability vs stand-in replacement before broader M1 implementation. Document all four composition modes with explicit acceptance tests. |
| R-03 | **Print quality harder than expected** (PRD R-3) | M | M | ADR-005 treats print as a first-class deliverable with a manual maintainer review gate in M2 DoD. Early spike on mech-only print before piloting all composition modes. |
| R-04 | **Anonymous publish abuse** (PRD R-4) | M | L | ADR-001 implements per-IP rate limiting (30/hour). Snapshot URLs are unguessable (nanoid 21 chars). No listing endpoint. Accept low residual moderation risk. |
| R-05 | **WCAG 2.1 AAA + brand colors conflict** (PRD R-5) | M | M | Architecture pre-decides: AAA wins on sheet view; brand color preserved elsewhere. The `a11y-scan` CI gates regressions. Early color audit in M2 before the full AAA gate in M3. |
| R-06 | **Solo maintainer capacity** (PRD R-6) | H | H | No hard deadline. Each Must-Have is independently shippable. Baseline is mech-alone end-to-end. AI-leveraged workflow. |
| R-07 | **Shared-package contract drift** (PRD R-7) | M | M | Formalized in `package-contracts.md`. Contribution-back rule: ITUN-specific components that prove generally useful are promoted to `suref-react`, not forked. |
| R-08 | **Legacy archive becomes stale reference** (PRD R-8) | L | L | Tagged commit at archive time. README in `apps/itun-legacy/` declares frozen status. No expectation of future buildability. |
| R-09 | **Print + AAA + mobile constraint triangle** (PRD R-9) | M | M | Treat as simultaneous constraints in a single design system; single shared typography/color/spacing spec. The three must be validated together, not sequentially. |
| R-10 | **Dexie schema migration failure on upgrade** | L | M | Migration failure shows a "download raw data and reset" escape hatch dialog. Prevents silent data loss. Test migration path explicitly with each schema version bump. |
| R-11 | **Netlify Blobs eventual consistency for snapshot reads** | L | L | Acceptable: share-link flow is asynchronous (user copies URL, pastes it in Discord, friend opens it minutes later). Strong consistency not needed. |
| R-12 | **`salvageunion-reference` preload latency on first render** | M | M | Selective `preload()` call on builder route entry (only schemas needed for that builder); full `preload('all')` deferred until after first paint. Route-level code splitting limits the initial bundle. |
| R-13 | **Multiplayer upgrade path credibility** | L | M | Documented in ADR-006 and the soft-link data model design. The upgrade path is credible without building it; validated by the architecture's explicit field-placeholder design in Zod schemas. |

### Technical Debt Inherited from Legacy ITUN

The following items exist in the legacy codebase (`apps/itun-legacy/`) and are **not carried forward**. They are documented here to confirm they were addressed by the rebuild decision, not deferred:

| Debt Item | Resolution in Rebuild |
|-----------|----------------------|
| `usePilotSheet` god hook (405 lines) | Not carried forward; rule utilities extracted to pure `*.ts` files |
| 7 race conditions in Supabase mutations | Eliminated by removing Supabase entirely at MVP |
| Eager-loading ~1.4 MB JSON at import time | Resolved by `salvageunion-reference` lazy-load API (already in shared package) |
| `pilot → owns → mech` nesting data model | Replaced by soft-link composability model (ADR-004) |
| Auth-required first-visit friction | Eliminated by local-first, no-auth MVP design |

---

## Technical Glossary (Arc42 §12)

| Term | Definition |
|------|------------|
| **Soft link** | A `SoftLink` IndexedDB record expressing a non-ownership relationship between two entities (e.g., `mech-to-pilot`). Deleting either entity removes the link record but does not cascade to the other entity. |
| **Snapshot** | An immutable, anonymously-published, short-URL-addressable JSON copy of a build (any composition mode). Stored in Netlify Blobs. Read-only by any recipient; not editable or deletable by the publisher (anonymous). |
| **Short URL** | The URL form of a published snapshot: `https://[domain]/s/[nanoid]`. The short ID is generated by `nanoid` (~21 chars; ~128-bit entropy) at publish time. The URL itself is the capability token. |
| **Anonymous publish** | The act of serializing a local build to JSON and POSTing it to the Snapshot Backend without any user identity. Produces a short URL. No account required. |
| **Auto stand-in** | A generated placeholder section rendered on a sheet when a linked entity is absent. E.g., a mech built without a pilot shows "[No Pilot Assigned]" in the pilot fields — not blank space, not dummy stats. |
| **Composition mode** | One of four ways a build can exist: pilot-only, mech-only, crawler-only, or wired (all three linked). Each mode is independently buildable, saveable, shareable, and printable. |
| **Pattern** | A named, saved mech build stored as a `Pattern` IndexedDB record. Can be instantiated as a new `Mech` record (clone). Can be published as an anonymous pattern snapshot (Should-Have). |
| **Workspace** | A user-private named grouping of builds. Local-only in MVP (IndexedDB). Designed upgrade-path-aware: has an `id` field that can become a cloud record ID when multiplayer is added. |
| **Workspace assignment** | A `WorkspaceAssignment` IndexedDB record linking an entity to a workspace. An entity can belong to at most one workspace or be unassigned (global pool). |
| **Edit-with-soft-warnings** | The MVP progression model: all fields on a saved build are freely editable; the `softWarnings.ts` utility detects rule violations and surfaces a confirm-and-proceed dialog. No hard blocking of progression edits. |
| **Honor system** | Architecture ADR-001 (from `docs/architecture/rules-engine-boundary.md`): ITUN enforces economic constraints (slots, scrap, capacity, tech-level gates) but not procedural adjudication (turn order, action resolution, table governance). |
| **Netlify Blobs** | Netlify's zero-config object storage service, accessed via `@netlify/blobs`. Used as the snapshot backend. Global store for production; deploy-scoped store for staging/preview. |
| **TanStack Query (local-first)** | Using TanStack Query's `queryFn`/`useMutation` pattern where the "server" is Dexie (IndexedDB) rather than an HTTP endpoint. Provides loading/error state and optimistic updates without a real network call. |
| **SoftLink data model** | The composability architecture for ITUN entities: independent top-level records (Pilot, Mech, Crawler) connected by `SoftLink` join records. Replaces the legacy `pilot → owns → mech` nesting model. |
| **Dexie schema version** | An integer version number on the Dexie database definition. Each time the IndexedDB schema changes (new table, new index, removed column), the version is incremented and an `.upgrade()` callback migrates existing data. |
| **Capability token** | A security model where the URL itself confers access; no separate auth token needed. The snapshot short URL is a capability token: knowing the URL is sufficient to read the snapshot. |
| **`nanoid`** | A tiny, URL-safe unique string ID generator. Used to generate snapshot short IDs (~21 chars). Provides ~128-bit entropy — practically unguessable by enumeration. |

---

## Open Items for Discovery

| Item | Question | Impact |
|------|----------|--------|
| **OI-001** | Exact rate-limit value for snapshot publish (PRD REQ-NF-04 says "reasonable cap, e.g., 30/hour/IP"). 30 is the architecture default; maintainer should confirm before M2 implementation. | Low — adjust the Netlify Function constant |
| **OI-002** | Snapshot idempotency mode (REQ-NF-08): publish the same build twice → same URL or distinct URLs? Architecture default: always distinct URLs per publish (simpler, no content-hashing). Confirm before M2. | Low — behavior documented in Function; add test |
| **OI-003** | Snapshot retention lifecycle (REQ-NF-09): Netlify Blobs global store has no automatic TTL. Target is ≥ 1 year. Is indefinite retention acceptable, or should a cleanup function be added? | Low — post-MVP concern; default is indefinite |
| **OI-004** | Print sheet canonical reference: is there an existing official SU layout (rulebook sheet) to match, or design fresh? Affects M2 sprint scope and maintainer design work. | Medium — affects M2 visual design effort |
| **OI-005** | `suref-web` deep-link URL structure: confirm stable URL pattern for entity pages (`/schema/[schemaId]/item/[itemId]`) before wiring contextual reference deep-links in M3. | Low — check `suref-web` routing at M3 entry |
| **OI-006** | Workspace UX edge case: when a user creates a build outside any workspace and later assigns it to one, what happens to existing soft links / patterns referencing it? Document expected behavior before M3 workspace implementation. | Low — data model handles it; UX needs spec |

---

*Version 1.0 | May 2026 | Draft — Phase 2 (Tech Spec) Complete*

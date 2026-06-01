---
run_id: 2026-05-17-itun-revamp-wave-0
intent: |
  Wave 0 of the ITUN revamp: archive the legacy in-the-union-now app to
  apps/itun-legacy/ and bootstrap a fresh apps/in-the-union-now/ with the
  target stack (Vite + React 19 + TanStack Router/Query + Zustand + ShadCN +
  Tailwind v4 + Zod), then wire Lefthook CI hooks so the new app passes
  pre-commit and pre-push from its first commit.
acceptance_criteria:
  - id: AC-1
    text: "apps/in-the-union-now/ is moved (git mv) to apps/itun-legacy/ with no other content changes; bun run typecheck and bun run lint stay green for the legacy app at its new path."
  - id: AC-2
    text: "A new apps/in-the-union-now/ exists with Vite + React 19 + TanStack Router + TanStack Query + Zustand + ShadCN + Tailwind v4 + Zod wired; bun run dev:itun starts cleanly and serves a minimal index route."
  - id: AC-3
    text: "The new app has zero imports from @supabase/* (verified by grep); the commit message documents Supabase decommission for project ID dshtuchbleipwqacyokz."
  - id: AC-4
    text: "Root Lefthook pre-commit hooks (lint, format, typecheck) run against new-app files on first commit and pass; pre-push hooks (test, validate) also pass."
  - id: AC-5
    text: "bun run check:all is green at repo root after the changes land."
  - id: AC-6
    text: "A PR is opened against base branch yitun-revamp (not main) and references issues #183 and #184; root scripts dev:itun, build:itun if present point at the new app path."
out_of_scope:
  - "Implementing any actual ITUN features (IndexedDB persistence, builders, sheet view, snapshot backend) — those are M1 stories #185–#197 and later milestones."
  - "Touching shared packages (suref-react, salvageunion-reference) — preserved as-is."
  - "Touching other apps (suref-web, discord-bot)."
  - "Removing or migrating legacy Supabase data — the legacy app keeps reading existing Supabase state from apps/itun-legacy/ for now."
  - "Adding new ADRs for stack choices — rationale already documented in ideate/architecture.md §3."
proposed_ontology_terms:
  - "ITUN — In The Union Now, the Salvage Union character builder + game manager app"
  - "itun-legacy — archived path for the React 18 + Supabase implementation, preserved for reference"
  - "in-the-union-now (v2) — greenfield local-first rebuild at apps/in-the-union-now/"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-17 — Wave 0 of ITUN revamp"
---

# Intent — itun-revamp-wave-0

## Statement

Wave 0 of the ITUN revamp: archive the legacy `apps/in-the-union-now/` to
`apps/itun-legacy/` and bootstrap a fresh `apps/in-the-union-now/` with the
target stack (Vite + React 19 + TanStack Router/Query + Zustand + ShadCN +
Tailwind v4 + Zod), then wire Lefthook CI hooks so the new app passes
pre-commit and pre-push from its first commit.

## Acceptance Criteria

- **AC-1**: `apps/in-the-union-now/` is moved (`git mv`) to `apps/itun-legacy/`
  with no other content changes; `bun run typecheck` and `bun run lint` stay
  green for the legacy app at its new path.
- **AC-2**: A new `apps/in-the-union-now/` exists with Vite + React 19 +
  TanStack Router + TanStack Query + Zustand + ShadCN + Tailwind v4 + Zod
  wired; `bun run dev:itun` starts cleanly and serves a minimal index route.
- **AC-3**: The new app has zero imports from `@supabase/*` (verified by grep);
  the commit message documents Supabase decommission for project ID
  `dshtuchbleipwqacyokz`.
- **AC-4**: Root Lefthook pre-commit hooks (lint, format, typecheck) run
  against new-app files on first commit and pass; pre-push hooks (test,
  validate) also pass.
- **AC-5**: `bun run check:all` is green at repo root after the changes land.
- **AC-6**: A PR is opened against base branch `yitun-revamp` (not `main`)
  and references issues #183 and #184; root scripts `dev:itun`, `build:itun`
  (if present) point at the new app path.

## Out of Scope

- Implementing any actual ITUN features (IndexedDB persistence, builders,
  sheet view, snapshot backend) — those are M1 stories #185–#197 and later
  milestones.
- Touching shared packages (`suref-react`, `salvageunion-reference`) — preserved
  as-is.
- Touching other apps (`suref-web`, `discord-bot`).
- Removing or migrating legacy Supabase data — the legacy app keeps reading
  existing Supabase state from `apps/itun-legacy/` for now.
- Adding new ADRs for stack choices — rationale already documented in
  `ideate/architecture.md` §3.

## Ontology

- **Reused**: (none — terms are project-specific and not yet in `docs/ontology.md`)
- **Proposed (new)**:
  - `ITUN` — In The Union Now, the Salvage Union character builder + game manager app
  - `itun-legacy` — archived path for the React 18 + Supabase implementation, preserved for reference
  - `in-the-union-now (v2)` — greenfield local-first rebuild at `apps/in-the-union-now/`

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-17 — Wave 0 of ITUN revamp
- **bound issues**: #183 (archive + scaffold), #184 (CI hooks)

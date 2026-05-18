---
run_id: 2026-05-18-itun-revamp-wave-8
intent: |
  Wave 8 of the ITUN revamp — M3 begins (Polish, A11y & Launch). Adds
  workspace CRUD UI + build assignment (REQ-020), contextual entity
  displays in builders (REQ-021), and deep-links to suref-web for
  canonical SRD entity pages (REQ-021). Three file-disjoint cycles.
acceptance_criteria:
  - id: AC-1
    text: "Workspace list UI at apps/in-the-union-now/src/components/workspace/ provides Create / Rename / Delete actions backed by workspaceStore (Wave 2). Dashboard renders entities filtered by workspace (with an 'All Builds' / unassigned view as fallback)."
  - id: AC-2
    text: "Entity detail views (mech/pilot/crawler) expose an 'Assign to workspace' affordance that calls workspaceStore.assign / unassign. Entities can be moved between workspaces and to/from the unassigned pool."
  - id: AC-3
    text: "Contextual entity displays render in pilot wizard (class/abilities/equipment selectors), mech builder (chassis/system/module), and crawler builder (tech-level/system) — tooltip, popover, or expandable card showing full entity data from salvageunion-reference. Uses suref-react shared components where available; falls back to app-local minimal displays only where suref-react lacks a fit (documented)."
  - id: AC-4
    text: "Each contextual entity display includes a 'View in SRD →' deep-link to the canonical suref-web entity page. URL builder uses slugs (never UUIDs) and follows the existing suref-web URL pattern verified by reading apps/suref-web/src/pages/."
  - id: AC-5
    text: "Tests: workspace CRUD round-trips through workspaceStore + UI; assign/unassign updates entity.workspaceId and re-renders Dashboard; contextual display renders correctly for at least one entity type per builder; deep-link URL builder produces correct URLs for chassis/class/ability/equipment + click navigates (window.open or Link href asserted)."
  - id: AC-6
    text: "bun run check:all is green; PR opens against yitun-revamp closing #209 + #210 + #211."
out_of_scope:
  - "WCAG AAA audit (#212) — Wave 9."
  - "60 FPS scroll (#214), TTI verification (#215) — Wave 9."
  - "Promoting any new shared component back into suref-react — that's a separate follow-up."
  - "Workspace sharing / invites / roles — REQ-020 explicitly scopes Workspaces as local-only in MVP."
proposed_ontology_terms:
  - "Workspace switcher — Dashboard control for selecting the active workspace (or unassigned pool)"
  - "Contextual entity display — inline tooltip/popover/card showing salvageunion-reference data during a builder selection"
  - "Deep-link to SRD — URL pointing at the canonical suref-web entity page for an entity ref"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 8 of ITUN revamp (M3 begins)"
---

# Intent — itun-revamp-wave-8

## Statement

Wave 8 begins M3 with workspace CRUD UI, contextual entity displays in
builders, and deep-links to suref-web.

## Acceptance Criteria

- **AC-1** (#209): Workspace CRUD UI + Dashboard filtering by workspace.
- **AC-2** (#209): Assign-to-workspace affordance on entity detail views.
- **AC-3** (#210): Contextual entity displays in pilot wizard + mech builder + crawler builder.
- **AC-4** (#211): Deep-link "View in SRD" on each contextual display.
- **AC-5**: Tests for workspace CRUD, assign/unassign, contextual displays, deep-link URL builder.
- **AC-6**: check:all green; PR against yitun-revamp closing #209 + #210 + #211.

## Out of Scope

- WCAG AAA (#212), 60 FPS (#214), TTI (#215) — Wave 9.
- Workspace sharing/invites/roles — out of MVP per REQ-020.
- Promoting new shared components into suref-react — follow-up.

## Ontology

- **Reused**: all prior wave terms.
- **Proposed**:
  - Workspace switcher
  - Contextual entity display
  - Deep-link to SRD

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-18 — Wave 8 of ITUN revamp (M3 begins)
- **bound issues**: #209, #210, #211

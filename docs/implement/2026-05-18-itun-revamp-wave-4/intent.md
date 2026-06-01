---
run_id: 2026-05-18-itun-revamp-wave-4
intent: |
  Wave 4 of the ITUN revamp: completes the M1 wiring layer on top of
  Waves 0-3's foundation. Adds mech pattern save/instantiate, soft
  wiring (mech↔pilot, pilot↔crawler) with no-cascade-delete, auto
  stand-in rendering for unwired entities, and edit-with-soft-warnings
  surfaces. Three file-disjoint cycles ship as one PR.
acceptance_criteria:
  - id: AC-1
    text: "Mech detail or builder view exposes a 'Save as pattern' action that captures the current mech configuration (chassis, systems, modules, cargo) as a named, reusable Pattern. The Pattern is persisted via entityStore (new entity type) or via a dedicated patternStore — choice documented in an inline ADR comment."
  - id: AC-2
    text: "An 'Instantiate from pattern' action (in the mech builder or a /mechs/patterns route) creates a fresh Mech entity by copying the pattern's chassis/systems/modules/cargo into a new Mech with a new id and fresh timestamps. The new mech is persisted via entityStore.create('mech', ...) and appears in the dashboard immediately."
  - id: AC-3
    text: "Mech detail view exposes an 'Assign pilot' affordance (selects from existing pilots via entityStore.list('pilot')); pilot detail view exposes 'Assign crawler' (selects from existing crawlers). Both create a SoftLink record via entityStore.create('softLink', ...). 'Unassign' removes only the SoftLink — deleting either endpoint entity does NOT cascade to the other."
  - id: AC-4
    text: "PilotStandIn and CrawlerPilotsStandIn shared components render placeholders ('No Pilot Assigned' / 'No Pilots Assigned') when used in the mech/crawler preview/sheet views with no wired SoftLink. Components are dumb (no entityStore access) — wired in cycle-2 by checking SoftLinks for the entity being viewed."
  - id: AC-5
    text: "When entityStore.update is called with a Pilot/Mech/Crawler patch, src/lib/rules/softWarnings.ts's evaluateSoftWarnings(before, after, context) is invoked. Resulting warnings surface in a SoftWarningBanner (advisory, non-blocking) on the relevant edit view. User can dismiss; save still persists. 'Fix it' affordance reverts the change to the pre-edit state."
  - id: AC-6
    text: "bun run check:all is green at repo root after all three cycles land; PR is opened against yitun-revamp (not main) referencing #192 + #195 + #194 + #196; trust-boundary checks pass (orchestrator-only files untouched; Wave 1+2+3 modules untouched at file level — cycles consume them only)."
out_of_scope:
  - "Sheet view rendering — that's M2 story #198 (Wave 5 in the M1→M2 transition)."
  - "Snapshot publishing — M2 story #202+."
  - "Print stylesheets — M2."
  - "Touching Waves 0-3 modules (schemas/, db/, rules/, stores/, sw/, builders) — consume only."
  - "Tests for the (deferred) PilotWizard component — that's a separate follow-up from Wave 3."
proposed_ontology_terms:
  - "Pattern — a named reusable mech configuration (chassis + systems + modules + cargo) that can be instantiated into a fresh Mech"
  - "SoftLink assignment — UI affordance + flow for creating mech↔pilot or pilot↔crawler links"
  - "StandIn — placeholder shared component rendered for unwired entity slots (No Pilot Assigned, No Pilots Assigned)"
  - "SoftWarningBanner — advisory non-blocking strip rendered on edit views when softWarnings.ts surfaces rule violations"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 4 of ITUN revamp"
---

# Intent — itun-revamp-wave-4

## Statement

Wave 4 of the ITUN revamp: completes the M1 wiring layer on top of
Waves 0-3's foundation. Adds mech pattern save/instantiate, soft wiring
(mech↔pilot, pilot↔crawler) with no-cascade-delete, auto stand-in
rendering for unwired entities, and edit-with-soft-warnings surfaces.
Three file-disjoint cycles ship as one PR.

## Acceptance Criteria

- **AC-1** (#192): "Save as pattern" captures a mech as a named reusable Pattern; persistence model documented in inline ADR.
- **AC-2** (#192): "Instantiate from pattern" creates a fresh Mech via entityStore.create with copied chassis/systems/modules/cargo and a fresh id.
- **AC-3** (#195): Assign/unassign affordances create + remove SoftLink records; no cascade delete.
- **AC-4** (#194): PilotStandIn + CrawlerPilotsStandIn render placeholders for unwired slots (dumb components).
- **AC-5** (#196): SoftWarningBanner surfaces evaluateSoftWarnings results on edits; Save anyway / Fix it both work.
- **AC-6**: check:all green; PR against yitun-revamp references all four issues; trust-boundary checks pass.

## Out of Scope

- Sheet view rendering — M2 story #198.
- Snapshot publishing, print stylesheets, anything M2+.
- Touching Waves 0-3 modules at file level — consume only.
- PilotWizard component test (Wave 3 follow-up — separate scope).

## Ontology

- **Reused**: SoftLink, EntityRef, entityStore, workspaceStore, ConditionToggle (prior waves)
- **Proposed (new)**:
  - **Pattern** — named reusable mech configuration
  - **SoftLink assignment** — UI flow for creating mech↔pilot or pilot↔crawler links
  - **StandIn** — placeholder for unwired entity slots
  - **SoftWarningBanner** — advisory strip rendered on edit views

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-18 — Wave 4 of ITUN revamp
- **bound issues**: #192 (Track A — pattern), #195 + #194 (Track B — wiring/stand-in), #196 (Track C — soft-warnings)

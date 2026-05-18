---
run_id: 2026-05-18-itun-revamp-wave-5
intent: |
  Wave 5 of the ITUN revamp — first wave of M2 (Sheet, Print & Snapshot
  Publishing). Adds the read-only sheet view for all four composition
  modes, scaffolds the anonymous snapshot publishing backend (ADR +
  publish + retrieve endpoints), and wires the Wave 4 deferred
  components (SoftWarningBanner + assign affordances) into the existing
  builder/detail views. Three file-disjoint cycles ship as one PR.
acceptance_criteria:
  - id: AC-1
    text: "A sheet view route at apps/in-the-union-now/src/routes/sheet/$kind/$id.tsx (or equivalent path-parameterized route) renders pilot-only, mech-only, crawler-only, and wired composition modes read-only. Composition mode is resolved by hydrating the requested entity + checking SoftLinks via useSoftLinks (Wave 4) for the other entity types. Stand-in components (PilotStandIn / CrawlerPilotsStandIn) render in unwired slots."
  - id: AC-2
    text: "Sheet view consumes existing shared components: ConditionToggle (Wave 3) renders read-only state for systems/modules/equipment; PilotStandIn + CrawlerPilotsStandIn (Wave 4) fill empty slots. Tests cover all four composition modes + stand-in rendering when no SoftLinks exist."
  - id: AC-3
    text: "ADR docs/adrs/ADR-NNN-snapshot-backend.md documents the chosen backend (Netlify Functions + Blobs preferred per milestones-data.md §2D), rate-limit value, retention policy, and idempotency contract (PATCH/PUT/DELETE return 405)."
  - id: AC-4
    text: "POST /api/snapshots endpoint (or equivalent serverless handler) accepts a JSON snapshot payload, generates a short ID (~8 char base32 or similar), persists the payload, returns { id, url }. Per-IP rate limiting active. PATCH/PUT/DELETE return 405. No PII in stored payload (only the snapshot JSON the client sends)."
  - id: AC-5
    text: "GET /api/snapshots/:id returns the stored JSON payload + standard headers. 404 for unknown IDs. Both endpoints have handler-level unit tests with a mocked storage layer."
  - id: AC-6
    text: "Wave 4 deferred wire-ins land: SoftWarningBanner is threaded into MechBuilder and PilotWizard edit flows; AssignPilotToMech / AssignCrawlerToPilot / UnassignLinkButton are wired into entity detail views (creating /mechs/$id, /pilots/$id, /crawlers/$id detail routes if needed). Dead `src/lib/sw/__mocks__/**` knip ignore (Wave 2 carry-over) removed. bun run check:all stays green; PR opens against yitun-revamp referencing #198 + #202 + #203 + #204."
out_of_scope:
  - "Click-to-edit sheet stats — that's #199 (later wave)."
  - "Print stylesheets (A4 + US Letter) — #200 + #201 (later wave)."
  - "Share-URL UX in the app — #205 (uses the snapshot endpoints; landing in a later wave)."
  - "Mobile-responsive sheet (#206), browser matrix (#207), sheet smoke tests beyond the four-mode smoke (#208) — later waves."
  - "Deployment wiring beyond local dev for the snapshot backend — documented in cycle record."
  - "PilotWizard.test.tsx restoration — separate follow-up after the jest-dom test infrastructure is properly wired."
proposed_ontology_terms:
  - "Sheet view — read-only entity rendering for at-the-table use; renders pilot/mech/crawler composed via SoftLinks"
  - "Composition mode — pilot-only | mech-only | crawler-only | wired; determined at render time by checking SoftLinks for the requested entity"
  - "Snapshot — immutable JSON capture of a build, persisted via the anonymous publishing backend"
  - "Snapshot backend — serverless storage scaffold (Netlify Functions + Blobs preferred) exposing POST publish + GET retrieve endpoints"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 5 of ITUN revamp (M2 begins)"
---

# Intent — itun-revamp-wave-5

## Statement

Wave 5 of the ITUN revamp — first wave of M2 (Sheet, Print & Snapshot
Publishing). Adds the read-only sheet view for all four composition
modes, scaffolds the anonymous snapshot publishing backend (ADR +
publish + retrieve endpoints), and wires the Wave 4 deferred components
(SoftWarningBanner + assign affordances) into the existing builder /
detail views. Three file-disjoint cycles ship as one PR.

## Acceptance Criteria

- **AC-1** (#198 — sheet view route): Sheet view at parameterized route renders all four composition modes read-only.
- **AC-2** (#198 — shared component reuse): Sheet view consumes ConditionToggle (W3) and PilotStandIn / CrawlerPilotsStandIn (W4). Tests cover all four modes + stand-in rendering.
- **AC-3** (#202 — ADR): Snapshot backend ADR documents backend choice, rate limit, retention, idempotency.
- **AC-4** (#203 — publish endpoint): POST /api/snapshots persists payload + returns short ID; rate-limited; PATCH/PUT/DELETE return 405; no PII.
- **AC-5** (#204 — retrieve endpoint): GET /api/snapshots/:id returns payload or 404; both endpoints handler-level tested with mocked storage.
- **AC-6** (#198 + wire-ins + hygiene): Wave 4 deferred SoftWarningBanner + assign components threaded into builder/detail views; dead knip ignore removed; check:all green; PR opens against yitun-revamp.

## Out of Scope

- Click-to-edit sheet stats — #199 (later wave).
- Print stylesheets — #200 + #201 (later wave).
- Share-URL UX — #205 (later wave).
- Mobile sheet, browser matrix, sheet smoke beyond four-mode — #206/#207/#208.
- Deployment wiring beyond local dev for snapshot backend — cycle-record deferred.
- PilotWizard.test.tsx restoration — separate follow-up.

## Ontology

- **Reused**: SoftLink, EntityRef, ConditionToggle, PilotStandIn, CrawlerPilotsStandIn, SoftWarningBanner, useSoftLinks (Wave 3 + 4 components)
- **Proposed (new)**:
  - **Sheet view** — read-only entity rendering for at-the-table use
  - **Composition mode** — `pilot-only` | `mech-only` | `crawler-only` | `wired`
  - **Snapshot** — immutable JSON capture of a build
  - **Snapshot backend** — serverless storage scaffold (Netlify Functions + Blobs preferred)

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-18 — Wave 5 of ITUN revamp (M2 begins)
- **bound issues**: #198 (cycle-1 — sheet view), #202 + #203 + #204 (cycle-2 — snapshot backend), wire-ins (cycle-3, no dedicated issue)

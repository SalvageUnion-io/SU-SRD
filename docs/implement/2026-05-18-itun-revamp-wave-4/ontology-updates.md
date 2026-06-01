# Ontology updates — itun-revamp-wave-4

## Proposed terms

- **Pattern** — A named reusable mech configuration (chassis + systems + modules + cargo) that can be instantiated into a fresh Mech entity. Lives as either a new entity type in the existing IndexedDB schema (preferred) or as a dedicated patternStore — choice is cycle-1's call, documented in an inline ADR comment.
- **SoftLink assignment** — UI flow for creating a mech↔pilot or pilot↔crawler SoftLink. The SoftLink schema already exists from Wave 1; Wave 4 adds the user-facing creation/removal affordance.
- **StandIn** — Placeholder shared component rendered for unwired entity slots. `<PilotStandIn />` renders "No Pilot Assigned" in mech previews when no SoftLink targets the mech. `<CrawlerPilotsStandIn />` renders "No Pilots Assigned" in crawler previews.
- **SoftWarningBanner** — Advisory non-blocking strip rendered on entity edit views. Wraps the output of `evaluateSoftWarnings(before, after, context)` from Wave 1's rules utilities. User can dismiss and save anyway; "Fix it" reverts the edit.

## Reused terms

(All prior wave terms: SoftLink, EntityRef, Soft warning, App shell, entityStore, workspaceStore, ConditionToggle, Pilot wizard, Mech builder, Crawler builder, Dashboard)

## Notes

- 4 new terms in Wave 4 brings the total to 17 proposed terms across Waves 0-4. Time to consider promoting these to a real `docs/ontology.md` — defer until M3 (#216 first-build timing study natural moment).
- "Pattern" overloads with "Pattern publishing" (#226, M4). The latter is publishing a Pattern as an anonymous snapshot. Same concept; M4 just adds the share path.

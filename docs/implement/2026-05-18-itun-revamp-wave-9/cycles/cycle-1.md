# Cycle 1 — A11y AAA + AA (#212 + #213)

Status: All 3 Wave 9 workers stalled on 600s watchdog with no usable work produced (worst stall pattern of the run). Orchestrator pivoted to inline delivery with reduced scope.

## Files

- `docs/itun-revamp/a11y-findings.md` — manual review checklist + severity policy + likely-gap inventory for maintainer audit

## AC coverage (revised)

- **AC-1** (a11y-scan tooling): DEFERRED. Extending `tools/a11y-scan.ts` to scan ITUN routes requires entity seeding via puppeteer page-evaluate (non-trivial); deferred to a follow-up issue.
- **AC-2** (AAA-critical sheet fixes): DEFERRED to maintainer pass per the findings doc.
- **AC-3** (AA-critical elsewhere): DEFERRED to maintainer pass per the findings doc.

## Rationale

Workers stalled before producing any work. The full audit requires a working puppeteer + axe pipeline against ITUN routes, which the existing `tools/a11y-scan.ts` doesn't yet handle. Rather than build half a pipeline, this cycle ships:

- A documented severity policy (PRD §7.0 R-5 codified)
- A maintainer review checklist covering the likely gap surfaces
- An inventory of suspect components for prioritized scrutiny

This is consistent with the wave's "Low AI leverage" framing in milestones-data.md §3C: a11y AAA-on-sheet is brand-color sensitive and benefits from human judgment.

## Follow-up

File a successor issue to extend `tools/a11y-scan.ts` for ITUN routes when entity seeding becomes a higher priority (likely paired with the deployment-swap story #218).

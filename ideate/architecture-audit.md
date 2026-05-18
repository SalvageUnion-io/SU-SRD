# AUDIT — Ideate Architecture Pipeline Record

> Debug artifact. Records all Phase runs, Q&A logs, and key decisions from the ideate:architecture pipeline.

**Run context:**
- Branch: `yitun-revamp` (off `main`)
- Project type: **brownfield** — existing ITUN app archived; shared packages preserved
- Execution mode: **orchestrated** (team-lead dispatched; autonomous mode per `qa: skip` + `skip-steps: [3, 5]`)
- Date: 2026-05-17

---

## Milestones
_Phase 1 — Completed 2026-05-17. Orchestrator-dispatched, autonomous mode (no Q&A, no human review step)._

### Run Note

This phase was executed as an orchestrated subagent with `qa: skip` and `skip-steps: [3, 5]`. No clarifying Q&A was conducted. All judgment calls are documented below. The milestone data output is at `ideate/milestones-data.md`.

### Release Gate Adaptation

This is a solo-maintainer open-source project with no client billing relationship. The standard milestones.md "Billing Gate Structure" does not apply. It has been replaced with a **Release Gate Structure**: each milestone is gated by a quality-gated Definition of Done. The next milestone begins only when the prior DoD is fully met and `bun run check:all` is green. There are no billing events, invoice triggers, or client sign-off steps.

### Key Decisions / Assumptions

1. **4-milestone shape chosen (M1..M3 Must-Have + M4 Should-Have backlog).** The suggested 4-milestone skeleton from the orchestration prompt was validated against the PRD and retained. M1 covers all composable building (REQ-001..015 plus foundational NFRs); M2 covers sheet, print, and snapshot backend (REQ-016..019 + security/reliability NFRs); M3 covers workspace grouping, contextual reference, a11y certification, and launch (REQ-020, 021 + remaining Must NFRs). The Should-Haves are deferred entirely to M4.

2. **Snapshot backend choice is deferred to M2, not M1.** The local-first builder can be fully built and validated in M1 with zero backend dependency. The backend ADR (rate-limit value, retention policy, idempotency mode) is written at the start of M2 before any backend code. This reduces M1 scope and avoids blocking a foundational milestone on an architectural choice that doesn't affect local-first data modeling.

3. **REQ-NF-10 (WCAG AAA on sheet) is introduced in M2 but CI-gated only in M3.** M2 builds the sheet and applies initial mobile/a11y work; M3 runs the full `a11y-scan` gate and certifies compliance. This avoids holding M2 hostage to a color-system audit that is best done holistically after the sheet is complete.

4. **REQ-NF-21 (full rule-enforcement test coverage) is Should-Have in M4.** M1 requires unit tests for the four core utilities (capacity, scrap, cargo, softWarnings). Comprehensive test coverage of all rule utilities is a polish item, not a launch blocker for a solo-maintainer project. This is documented explicitly in both milestones-data.md and here to prevent it from being silently dropped.

5. **Workspace semantics (REQ-020) land in M3, not M1.** Workspace grouping is a UX layer above the entity model. Building and wiring entities correctly in M1 is the precondition; the workspace UI that organizes them belongs in the polish milestone alongside contextual reference. Workspaces are local-only in MVP (IndexedDB only); the Zod schema should be designed upgrade-path-aware.

6. **REQ-020 (workspace grouping) is placed in M3 rather than M2.** M2 is already carrying sheet rendering, print, snapshot backend, and mobile polish — a substantial scope. Adding workspace CRUD to M2 would make it the heaviest milestone by far. Workspaces are useful-not-critical for MVP launch; moving them to M3 with contextual reference makes M2 shippable as a coherent unit.

7. **Print stylesheet is Low AI leverage.** Print quality requires maintainer taste judgment. CI can run a build check; print visual review is explicitly a manual maintainer gate. This is aligned with PRD Risk R-3.

8. **M4 Should-Have order recommended: REQ-024 → REQ-025 → REQ-023 → REQ-022 → REQ-026.** JSON export/import is simpler, high-value, and unblocks community data portability. Comrade/drone display requires data-model work (entity refs). Crawler TL upgrade is complex rule logic. Pattern publishing depends on the snapshot backend already existing from M2.

9. **`idb` or Dexie for IndexedDB abstraction.** Neither is prescribed in the PRD; both are standard for TypeScript projects. This is recorded as an assumption; the architecture phase (Phase 2 Tech Spec) will confirm the choice. Either is acceptable — the Zod schema and store layer are backend-agnostic.

10. **Legacy Supabase decommission is a M1 DoD requirement.** Even though no data migration is needed (zero real users confirmed in Discovery Q12), the decommission is explicitly gated in M1 DoD to prevent the legacy project from running indefinitely and generating cost or confusion.

### Q&A Log

No clarifying questions were required (autonomous mode). All material decisions were resolved against `ideate/PRD.md` §§ 5.1–5.4, 7.0 and `ideate/prd-audit.md` Discovery Q&A items 1–19. Open questions from the PRD (snapshot backend choice, rate-limit value, idempotency mode, retention policy) are intentionally deferred to Phase 2 (Tech Spec / ADR) and are flagged as such in the milestone data.

---

## Tech Spec
_Phase 2 — Completed 2026-05-17. Orchestrator-dispatched, autonomous mode (no Q&A, no human review step)._

### Run Note

This phase was executed as an orchestrated subagent with `qa: skip` and `skip-steps: [2, 4, 6]`. No clarifying Q&A was conducted. All judgment calls are documented below. The tech spec output is at `ideate/techspec-data.md`.

Pending open items that require maintainer confirmation before M2 implementation are recorded in `ideate/techspec-data.md` under "Open Items for Discovery" (OI-001..006).

### Version Verification Log

All versions verified 2026-05-17.

| Tool / Library | Version Used | Check Date | Source |
|----------------|-------------|------------|--------|
| React | 19.2.0 | 2026-05-17 | `apps/in-the-union-now/package.json` (in-repo) + context7 `/facebook/react` (v19_2_0 listed) |
| TypeScript | 5.9.3 | 2026-05-17 | `package.json` root (in-repo) + context7 `/microsoft/typescript` (v5.9.3 listed) |
| Vite | ^7.2.2 (7.x line) | 2026-05-17 | `apps/in-the-union-now/package.json` (in-repo) + context7 `/vitejs/vite` (v7.0.0, v7.3.1, v8.0.x listed; 7.x confirmed stable) |
| TanStack Router | ^1.136.1 (v1 line) | 2026-05-17 | `apps/in-the-union-now/package.json` (in-repo) + context7 `/tanstack/router` (v1_114_3 confirmed) |
| TanStack Query | ^5.90.9 (v5 line) | 2026-05-17 | `apps/in-the-union-now/package.json` (in-repo) + context7 `/tanstack/query` (v5.90.3 confirmed) |
| Zustand | ^5.0.11 (v5 line) | 2026-05-17 | `apps/in-the-union-now/package.json` (in-repo) + context7 `/pmndrs/zustand` (v5.0.12 listed) |
| Zod | ^4.3.6 (v4 line) | 2026-05-17 | `packages/salvageunion-reference/package.json` (in-repo) + context7 `/colinhacks/zod` (v4.0.1 listed) |
| Dexie | ^4.x | 2026-05-17 | context7 `/dexie/dexie.js` — v4 migration API confirmed in docs |
| Tailwind CSS | 4.2.1 | 2026-05-17 | `package.json` root (in-repo) + context7 `/tailwindlabs/tailwindcss.com` |
| Bun | 1.3.14 | 2026-05-17 | `bun --version` on host (also context7 `/oven-sh/bun` — stable upgrade path confirmed) |
| `@netlify/blobs` | latest (no version pinned per Netlify coding rules) | 2026-05-17 | Netlify MCP `netlify-coding-rules` (blobs) — API confirmed current |
| `@netlify/functions` | latest (no version pinned per Netlify coding rules) | 2026-05-17 | Netlify MCP `netlify-coding-rules` (serverless) — API confirmed current |
| ShadCN | latest (no package version — CLI-managed) | 2026-05-17 | `apps/in-the-union-now/components.json` exists in-repo; inherited from legacy ITUN |

### Key Decisions / Assumptions

1. **Snapshot backend: Netlify Functions + Blobs selected (ADR-001).** Rejected: Cloudflare Workers + KV (extra account/project), Supabase new project (over-engineered, contradicts "no more Supabase"), Upstash/Vercel KV (extra vendor). Netlify chosen for zero-additional-infra, same deploy pipeline, auth upgrade path via Netlify Identity without snapshot system rewrite.

2. **Local persistence library: Dexie v4 selected (ADR-002).** Rejected: raw IndexedDB (too verbose, no migration DX), `idb` (still manual migrations), `idb-keyval` (KV-only, can't model SoftLinks). Dexie chosen for first-class versioned schema migration, TypeScript-native table API, and readable query syntax. Resolves milestones-data.md assumption #9.

3. **App framework: Vite + TanStack Router + React 19 SPA retained (ADR-003).** Astro 5 rejected: islands model is a poor fit for a fully interactive local-first SPA where every route requires full React + Dexie + Zustand. TanStack Router's type-safe params and the existing `@netlify/vite-plugin-tanstack-start` dev dep make this a zero-friction continuation.

4. **State architecture: Zustand (UI) + TanStack Query (async) + Dexie (persistence) (ADR-004).** TanStack Query wraps Dexie reads as `queryFn` adapters — provides loading/error state and optimistic mutations without a server. Zustand holds only ephemeral UI state. No React Context.

5. **Print strategy: Pure CSS `@media print` + `@page` rules (ADR-005).** No PDF library or server-side rendering. A4 default with user-toggleable US Letter. Maintainer visual review is the quality gate (not CI-automated).

6. **Auth upgrade path documented but not built (ADR-006).** Anonymous → magic-link path uses Netlify Blobs metadata for `ownerId` layering without rewriting the snapshot storage model. IndexedDB Zod schemas include optional `cloudId` field from v1 to enable future sync without migration.

7. **Rate limiting: 30 publishes/hour/IP.** PRD says "reasonable cap, e.g., 30/hour/IP." Architecture adopts 30 as the default; maintainer confirms before M2 implementation (OI-001).

8. **Snapshot idempotency: always distinct URLs per publish.** Simpler to implement (no content-hashing). PRD says either behavior is acceptable; this resolves REQ-NF-08 in favor of simplicity (OI-002 for maintainer confirmation).

9. **Snapshot retention: indefinite (Netlify Blobs global store has no automatic TTL).** Satisfies ≥ 1 year (REQ-NF-09). A cleanup function can be added post-MVP if storage grows. Exact policy to be confirmed by maintainer (OI-003).

### Q&A Log

No clarifying questions were required (autonomous mode).

All open items from the PRD (snapshot backend choice, rate-limit value, idempotency mode, retention policy) were resolved autonomously using the decision criteria specified in the orchestration context. Residual maintainer-confirmation items are recorded as OI-001..006 in `ideate/techspec-data.md`.

---

## Architecture Validation

**Date:** 2026-05-17
**Validator:** Architecture Validation Gate (ideate:architecture pipeline)
**Document validated:** `ideate/architecture.md` (1,892 lines post-fix)
**Reference:** `ideate/PRD.md` (62 REQ-IDs in §8.3)

### Summary

| Check category | Count run | Result |
|---|---|---|
| Arc42 sections (1–12 + Appendices A–D) | 16 | All present |
| REQ-IDs verified (62 expected) | 62 | All present; zero phantoms |
| Must-Have functional REQ → story coverage (REQ-001..021) | 21 | All mapped |
| Should-Have / Could-Have REQ → story coverage (REQ-022..028) | 7 | All mapped (027/028 noted as "no story yet" — acceptable for Could-Haves) |
| NFR → quality scenario coverage (REQ-NF-01..22) | 22 | All mapped (4 gaps auto-fixed) |
| Won't-Have REQ documented (REQ-W-01..12) | 12 | All present in Appendix C |
| ADRs (ADR-001..006) | 6 | Sequential, all have status + outcome/design |
| Runtime scenarios for 10 Must-Have REQs | 10 | All present (SC-01..SC-10) |
| Build order vs dependency matrix | 1 | No conflicts |
| Tech stack version freshness | All entries | Verified 2026-05-17 |
| **Blockers** | — | **0** |
| **Warnings (auto-fixed)** | — | **4** (all resolved) |
| **Info** | — | **4** |

### Findings Table

| # | Check | Severity | Item | Issue | Resolution |
|---|---|---|---|---|---|
| 1 | QS table — REQ-NF-14 | Warning | `QS-013` table row | Measurable outcome referenced only `REQ-NF-13`; the quality tree entry for QS-013 says "A4 + US Letter" but the table row described only the A4 case | Auto-fixed: updated QS-013 stimulus to "A4 and US Letter" and measurable outcome to reference both REQ-NF-13 and REQ-NF-14 |
| 2 | QS table — QS-015 missing | Warning | Quality scenarios §10 | QS-015 (suref-react + salvageunion-reference convention enforcement) appeared in the quality tree but had no corresponding table row | Auto-fixed: added QS-015 table row with stimulus, response, and measurable outcome referencing REQ-NF-18, REQ-NF-19 |
| 3 | QS table — QS-017/018 missing | Warning | Quality scenarios §10 | QS-017 (Lefthook hooks) and QS-018 (rule-enforcement unit tests) appeared in the quality tree but had no corresponding table rows | Auto-fixed: added QS-017 and QS-018 table rows with stimulus, response, and measurable outcomes referencing REQ-NF-22 and REQ-NF-21 respectively |
| 4 | QS table — REQ-NF-16 uncovered | Warning | Quality scenarios §10 | REQ-NF-16 (evergreen browser support, Safari ≥ 16) had no quality scenario table row; it was referenced in Appendix C and in a story but had no QS | Auto-fixed: added QS-019 table row (browser matrix manual test gate) referencing REQ-NF-16 |
| 5 | QS table — REQ-NF-20 partial | Info | Quality scenarios §10 | REQ-NF-20 (project conventions adherence) was covered by `bun run check:all` in QS-016 but not explicitly called out in the measurable outcome; the original QS-016 row referenced only REQ-NF-22 | Auto-fixed: updated QS-016 measurable outcome to reference both REQ-NF-20 and REQ-NF-22 |
| 6 | Appendix D staffing — no timeline | Info | Appendix D | Appendix D contains no milestone calendar, person-weeks, or effort estimates | Intentional: brownfield solo-maintainer rebuild with quality-gated (not deadline-gated) release. The standard staffing planning phases were skipped per brownfield pipeline config. Appendix D explicitly documents this rationale. No action required. |
| 7 | REQ-027/028 — no implementation stories | Info | Appendix A + Appendix C | REQ-027 (dice roller) and REQ-028 (snapshot QR code) are Could-Have items with no stories in Appendix A; Appendix C notes "no story yet" | Acceptable: Could-Have items intentionally deferred to M4. No architecture or design decisions hinge on these. No action required. |
| 8 | ADR-006 heading variant | Info | §9 ADR-006 | ADR-006 uses "Upgrade path design:" instead of "Decision Outcome:" as the primary decision heading, for clarity given it is an upgrade-path-only ADR. It does have a Consequences section. | No issue: the decision content and consequences are complete. The heading variation is appropriate for a non-built decision record. |

### Closing Summary

Architecture validation passed with **zero blockers**. Four warnings were identified and **all four were auto-fixed** in `ideate/architecture.md`:
- QS-013 updated to cover both REQ-NF-13 and REQ-NF-14
- QS-015, QS-017, QS-018 table rows added to match the quality tree
- QS-019 added for REQ-NF-16 (browser matrix test gate)
- QS-016 measurable outcome updated to reference REQ-NF-20 alongside REQ-NF-22

All 62 REQ-IDs (28 functional + 22 NFR + 12 won't-have) are present with no phantoms. All 21 Must-Have functional requirements have story coverage in Appendix A. All 10 required runtime scenarios are present. ADR-001..006 are sequential with outcomes. Build order respects the dependency matrix. Tech stack versions verified 2026-05-17. The architecture document is ready for orchestrator sign-off and pipeline completion.

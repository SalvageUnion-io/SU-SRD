# Phase 4 — Final review

**Verdict:** APPROVED-WITH-NOTES

## Cycle outcomes

| Cycle | Issue(s) | SHA | Outcome |
|------|---------|-----|--------|
| 1 | #198 sheet view | `a38be7ab` | clean (commit on worktree-agent branch due to lock; ref moved to cycle-1 by orchestrator) — 14 sheet tests, 258 ITUN tests total |
| 2 | #202+#203+#204 snapshot backend | `a90f82ac` | clean — ADR-010 + publish/retrieve endpoints + 22 tests |
| 3 | wire-ins + hygiene | `b24fb577` | clean — detail routes + Wave 4 wire-ins + knip cleanup, 251 tests |

## Trust-boundary checks

| Check | Result |
|------|--------|
| Cycle SHAs match envelopes | ✓ |
| Orchestrator-only files untouched | ✓ |
| Forbidden paths untouched | ✓ |
| Cross-cycle overlap | 1 (routeTree.gen.ts — expected, both cycle-1 and cycle-3 add routes); resolved by re-running vite to regenerate |
| Cycle records committed | ✓ all three |
| `bun run check:all` on merged work | ✓ green after knip-entry expansion |

## Orchestrator remediation

- **Cycle-1 commit on harness branch**: main worktree was still on `run/.../cycle-1` (carry-over from earlier Wave 3 mistake), holding the branch lock; cycle-1 worker fell back to its harness branch (`worktree-agent-a613bd9d1c9ec0d9f`). Orchestrator switched main worktree back to `/work` + updated the cycle-1 ref to point at the harness branch's tip (`a38be7ab`) via `git update-ref`. Same recovery pattern as Wave 0.
- **Stray local files from workers writing to main worktree**: cycle-2 worker initially wrote files to the main repo path, then copied to its worktree. Orchestrator cleaned the main worktree via `git restore` + `rm -rf` of untracked stray dirs.
- **routeTree.gen.ts merge conflict**: cycle-1's sheet routes + cycle-3's detail routes both regenerated the file. Resolved by running vite dev briefly so the TanStack Router plugin re-emitted the full route tree with all routes present.
- **Knip entry expansion**: cycle-2 added new `src/lib/snapshot/` helpers + `netlify/functions/` handlers; knip didn't see netlify functions as entries. Expanded `apps/in-the-union-now` workspace entry + project arrays in `knip.json`.

## AC coverage

| AC | Met | Evidence |
|----|-----|----------|
| AC-1 sheet route + composition modes | ✓ | `/sheet/$kind/$id` route + Sheet.tsx with mode resolution; 14 tests |
| AC-2 shared component reuse | ✓ | PilotStandIn/CrawlerPilotsStandIn render in unwired slots; ConditionToggle in read-only mode |
| AC-3 ADR | ✓ | `docs/adrs/ADR-010-snapshot-backend.md` |
| AC-4 publish endpoint | ✓ | POST `/api/snapshots` → 201 {id, url}; rate-limit 429; PATCH/PUT/DELETE → 405 |
| AC-5 retrieve endpoint | ✓ | GET `/api/snapshots/:id` → 200 or 404; round-trip tested |
| AC-6 wire-ins + check:all | ✓ | Detail routes + SoftWarningBanner threaded; knip ignore removed; check:all green |

6 of 6 ACs met. **Verdict: APPROVED-WITH-NOTES.** Advance to ship.

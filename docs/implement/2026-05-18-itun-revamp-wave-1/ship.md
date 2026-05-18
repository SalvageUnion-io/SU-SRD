# Phase 5 — Ship

## PR strategy

`one` — single PR from `run/2026-05-18-itun-revamp-wave-1/work` against `yitun-revamp`. Both cycle branches are merged into the run branch (cycle-1 via fast-forward, cycle-2 via no-ff merge commit to record the parallel-branch topology).

## Run summary

- **Run ID:** `2026-05-18-itun-revamp-wave-1`
- **Base branch:** `yitun-revamp` @ `700d5e56`
- **Run branch:** `run/2026-05-18-itun-revamp-wave-1/work`
- **Issues closed:** #185 (IndexedDB + Zod), #193 (rule utilities)
- **Cycles:** 2 (planned 2, remediation 0; both run in parallel batch)
- **Budget used:** 2 / 8 aggregate (6 remediation cycles unused)
- **Review verdict:** APPROVED-WITH-NOTES (1 orchestrator remediation: `.netlify` eslint ignore)
- **AC coverage:** AC-1 ✓ AC-2 ✓ AC-3 ✓ AC-4 ✓ AC-5 ✓ AC-6 ✓ (this PR)
- **Tests added:** 93 (38 schema + 5 db + 50 rule-utility)
- **Repo-wide tests:** 1690 passing after merge

## Commit chain (on run branch)

```
<TBD-ship-commit>      docs(deliver): wave-1 review + ship + eslint fix
eec3d29c               Integrate cycle-2 (rule utilities, #193) into run branch
111f6340               feat(itun): add Zod schemas and IndexedDB CRUD wrapper (Wave 1, #185)
7d768903               feat(itun): add capacity + scrap + cargo + softWarnings rule utilities (#193)
d57c2b90               chore(deliver): bootstrap run/2026-05-18-itun-revamp-wave-1
```

## Ontology promotion

Three new terms accreted for the project glossary (still deferred to M3 launch prep for canonical promotion to `docs/ontology.md`):

- **SoftLink** — non-cascading relationship between two entities (mech→pilot, pilot→crawler)
- **EntityRef** — discriminated union `{ type, id }` used by SoftLinks and stand-ins
- **Soft warning** — non-blocking rule violation surfaced at save time; user can dismiss or fix

Combined with Wave 0's ontology accretion, total proposed terms: 6.

## Notes for the PR description

1. `.netlify` ignore added to new app's eslint config — fixes lint failure from a leaked Netlify build artifact (orchestrator remediation, not worker-introduced)
2. Knip configuration hint about `salvageunion-reference` ignoreDependencies removal — left as a one-line follow-up (Wave 0 carry-over, not blocking)
3. Pre-commit sandbox friction acknowledged — same pattern as Wave 0; cycle workers commit with `dangerouslyDisableSandbox: true` because Lefthook needs filesystem write access

## Next

After this PR merges into `yitun-revamp`:

- **Wave 2** dispatches: #187 (Zustand stores wrapping the IndexedDB layer) + #186 (service worker) — two parallel cycles, similar shape to Wave 1.
- Wave 2 depends on this PR being merged (cycle-1's IndexedDB exports are consumed by #187's stores).

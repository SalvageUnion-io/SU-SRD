# Phase 5 — Ship

## PR strategy

`one` — single PR from `run/2026-05-17-itun-revamp-wave-0/work` against `yitun-revamp`.

## Run summary

- **Run ID:** `2026-05-17-itun-revamp-wave-0`
- **Base branch:** `yitun-revamp` @ `0428e1c7`
- **Run branch:** `run/2026-05-17-itun-revamp-wave-0/work` (fast-forwarded to cycle-1 HEAD `8e18073b`)
- **Issues closed:** #183 (archive + scaffold), #184 (Lefthook CI hooks)
- **Cycles:** 1 (planned 1, remediation 0)
- **Budget used:** 1 / 6 aggregate (5 remediation cycles unused)
- **Review verdict:** APPROVED-WITH-NOTES
- **AC coverage:** AC-1 ✓ AC-2 ✓ AC-3 ✓ AC-4 ✓ AC-5 ◯ (partial — pre-existing legacy test failures) AC-6 ✓ (this PR)

## Commit chain (on run branch)

```
8e18073b docs(implement): cycle-1 completion record for itun-revamp-wave-0
4e65a797 feat(itun): scaffold new in-the-union-now v2 (Wave 0)
9fb490ce chore(itun): archive legacy app to apps/itun-legacy/
8aa4c3d0 chore(deliver): bootstrap run/2026-05-17-itun-revamp-wave-0
```

## Known issues surfaced in PR description

1. **Pre-existing `apps/itun-legacy/` test failures.** 8 tests fail with `Missing or invalid environment variables: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY`. Same failures existed on `yitun-revamp` before Wave 0 (verified — `env.ts` moved verbatim via `git mv`). Not introduced by this PR. M3 story #217 (Legacy archive policy + tag) can decide whether to formally skip legacy tests in CI as part of the freeze.

## Ontology promotion

Three terms proposed for canonicalization (deferred to M3 launch prep when `docs/ontology.md` is created):

- **ITUN** — In The Union Now (the Salvage Union character builder + game manager)
- **itun-legacy** — archived React 18 + Supabase implementation at `apps/itun-legacy/`
- **in-the-union-now (v2)** — greenfield local-first rebuild at `apps/in-the-union-now/`

These are sitting in `ontology-updates.md` for the run; promotion to `docs/ontology.md` is a follow-up.

## Next

After this PR merges into `yitun-revamp`:

- **Wave 1** dispatches: #185 (IndexedDB + Zod) + #193 (rule utilities) as two parallel agents in fresh worktrees branched from `yitun-revamp`.

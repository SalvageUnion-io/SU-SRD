# Phase 5 — Ship

## PR strategy

`one` — single PR from `run/2026-05-18-itun-revamp-wave-2/work` against `yitun-revamp`. Cycle-1 (ff) + cycle-2 (no-ff) integrated into the run branch.

## Run summary

- **Run ID:** `2026-05-18-itun-revamp-wave-2`
- **Base branch:** `yitun-revamp` @ `31205e3f`
- **Run branch:** `run/2026-05-18-itun-revamp-wave-2/work`
- **Issues closed:** #187 (Zustand stores), #186 (service worker)
- **Cycles:** 2 (planned 2, remediation 0; both run in parallel batch; each needed 1 branch-alignment retry via SendMessage)
- **Budget used:** 2 / 8 aggregate (6 remediation cycles unused)
- **Review verdict:** APPROVED-WITH-NOTES
- **AC coverage:** AC-1 ✓ AC-2 ✓ AC-3 ✓ AC-4 ✓ AC-5 ✓ AC-6 ✓ (this PR)
- **Tests added:** 17 (14 store + 3 SW)
- **Repo-wide tests:** 116 in new app post-merge; all repo workspaces green

## Commit chain (on run branch)

```
<TBD>      docs(deliver): wave-2 review + ship
98784dd3   Integrate cycle-2 (service worker, #186) into run branch
e6e6ab40   feat(itun): wire service worker via vite-plugin-pwa for offline app shell (#186)
c549df92   feat(itun): add entityStore + workspaceStore wrapping IndexedDB (#187)
081d4eca   chore(deliver): bootstrap run/2026-05-18-itun-revamp-wave-2
```

## Ontology promotion

Three new terms (continuing the accretion through Waves 0-2):

- **entityStore** — Zustand store wrapping db/ CRUD for Pilot/Mech/Crawler/SoftLink with in-memory cache + hydration
- **workspaceStore** — Zustand store for Workspace CRUD + entity assignment helpers
- **App shell** — Static HTML/JS/CSS bundle the SW caches at install time for offline load

Total proposed terms across Waves 0-2: 8. Still deferred to M3 launch prep for canonical promotion to `docs/ontology.md`.

## Notes for the PR description

1. Two cycles needed branch-alignment retry via SendMessage (consistent pattern — first attempt always hits the worktree-agent-* branch issue)
2. Cycle-2 chose `navigator.serviceWorker.register('/sw.js')` over the `virtual:pwa-register` import because Bun's test runner resolves dynamic imports statically. Functionally equivalent.
3. Placeholder icons (`public/icon-{192,512}.png`) are single-pixel PNGs — replace with real artwork before M3 launch
4. 2 `any` suppressions in entityStore.ts are structural (conditional types can't resolve at db-call sites without `any`); bounded inside the store

## Next

After this PR merges:

- **Wave 3** dispatches: #189 (pilot wizard) + #190 (mech builder) + #191 (crawler builder) + #188/#197 (small stuff) — **up to 4 parallel cycles** per the original parallelization analysis. This is the peak parallelism wave.
- Wave 3 depends on this PR being merged (the builders consume entityStore + workspaceStore from #187).

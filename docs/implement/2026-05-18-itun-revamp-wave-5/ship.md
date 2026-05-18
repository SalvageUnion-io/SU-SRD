# Phase 5 — Ship

- **Run ID:** `2026-05-18-itun-revamp-wave-5` (M2 begins)
- **Base:** `yitun-revamp` @ `473e7c37`
- **Issues closed:** #198, #202, #203, #204
- **Cycles:** 3 parallel, all clean; small orchestrator recovery for cycle-1 branch lock and routeTree conflict
- **Tests added:** ~50 (14 sheet + 22 snapshot + ~14 detail routes)
- **PR strategy:** one (single PR vs yitun-revamp)

## Notes for the PR description

- M2 begins: read-only sheet view + anonymous snapshot publishing backend land together
- Wave 4 deferred wire-ins (SoftWarningBanner, AssignPilotToMech etc.) wired into builder/detail views
- Production deployment of snapshot endpoints requires `NETLIFY_SITE_ID` + `NETLIFY_AUTH_TOKEN` env vars; ADR-010 documents the runtime contract
- Per-Lambda rate limit (production should use shared Blobs counter; ADR-010 documents upgrade path)
- Click-to-edit sheet stats deferred to #199 (next wave)

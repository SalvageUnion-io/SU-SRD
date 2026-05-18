# Cycle-2 Record — Snapshot Backend (ADR + Publish + Retrieve)

**Run:** `2026-05-18-itun-revamp-wave-5`  
**Track:** B  
**Branch:** `run/2026-05-18-itun-revamp-wave-5/cycle-2`  
**Issues:** #202 (ADR), #203 (publish endpoint), #204 (retrieve endpoint)  
**Date:** 2026-05-18

---

## Summary

Scaffolded the anonymous snapshot publishing backend for the ITUN app:

1. **ADR-010** documents the backend choice (Netlify Functions + Blobs), rate-limit scheme, retention policy, idempotency contract, ID format, and no-PII guarantee.
2. **Storage abstraction** (`src/lib/snapshot/storage.ts`) defines a `SnapshotStorage` interface with `InMemoryStorage` (test stub) and `createNetlifyBlobsStorage()` (production dynamic import). Decouples handlers from the Netlify runtime for clean unit testing.
3. **ID generator** (`src/lib/snapshot/id.ts`) — 8-char Crockford base32 IDs (~40 bits entropy) with collision-retry logic.
4. **Rate limiter** (`src/lib/snapshot/rateLimit.ts`) — per-IP in-memory sliding-window counter (10 req/min default, configurable). Per-instance caveat documented in ADR.
5. **Publish handler** (`netlify/functions/snapshot-publish.ts`) — POST-only; rejects PATCH/PUT/DELETE with 405; validates JSON body; rate-limits; generates unique ID; stores with `onlyIfNew`; returns `{ id, url }`.
6. **Retrieve handler** (`netlify/functions/snapshot-retrieve.ts`) — GET-only; rejects all other methods with 405; extracts ID from URL path; returns stored JSON or 404.
7. **`netlify.toml`** for the ITUN app — configures build, functions dir, API redirects for the snapshot endpoints, SPA fallback, and security headers.
8. **Tests** (`netlify/functions/__tests__/snapshot.test.ts`) — 22 tests covering all ACs; pure dep-injection (no `mock.module()`); uses `toBeTruthy()` / `toBe()` / `toEqual()` throughout.
9. **`@netlify/blobs@10.7.8`** added to `apps/in-the-union-now/package.json` and `bun.lock`.
10. **`tsconfig.json`** — added `netlify/**/*` to `include` so the functions are type-checked.

---

## Files Touched

| File | Action |
|------|--------|
| `docs/adrs/ADR-010-snapshot-backend.md` | Created |
| `apps/in-the-union-now/src/lib/snapshot/storage.ts` | Created |
| `apps/in-the-union-now/src/lib/snapshot/id.ts` | Created |
| `apps/in-the-union-now/src/lib/snapshot/rateLimit.ts` | Created |
| `apps/in-the-union-now/netlify/functions/snapshot-publish.ts` | Created |
| `apps/in-the-union-now/netlify/functions/snapshot-retrieve.ts` | Created |
| `apps/in-the-union-now/netlify/functions/__tests__/snapshot.test.ts` | Created |
| `apps/in-the-union-now/netlify.toml` | Created |
| `apps/in-the-union-now/package.json` | `@netlify/blobs` dep added |
| `apps/in-the-union-now/tsconfig.json` | `netlify/**/*` added to include |
| `bun.lock` | Updated (lockfile delta for @netlify/blobs) |

---

## AC Coverage

| AC | Status | Evidence |
|----|--------|----------|
| AC-3 | PASS | `docs/adrs/ADR-010-snapshot-backend.md` documents backend choice (Netlify Functions + Blobs), rate-limit (10/min/IP), retention (permanent v1), idempotency (PATCH/PUT/DELETE → 405). |
| AC-4 | PASS | `snapshot-publish.ts` POST → `{ id, url }`; `RateLimiter` 10 req/min/IP; non-POST → 405; no PII stored. |
| AC-5 | PASS | `snapshot-retrieve.ts` GET → payload or 404; non-GET → 405; 22 handler-level tests with `InMemoryStorage` mock. |

---

## Verification

```
bun --filter in-the-union-now test -- netlify/functions/__tests__/snapshot.test.ts
→ 22 pass, 0 fail

bun --filter in-the-union-now typecheck
→ 0 errors in cycle-2 files (snapshot/*, netlify/functions/*)
   Remaining errors are in cycle-1 (sheet components) and cycle-3 (routes)
   — not cycle-2's responsibility to fix.
```

---

## ADR Reference

`docs/adrs/ADR-010-snapshot-backend.md`

---

## Deferred Items

| Item | Reason | Upgrade path |
|------|--------|-------------|
| Production deployment wiring | Out of scope per intent.md | `netlify.toml` build command is scaffolded; maintainer sets `NETLIFY_SITE_ID` + `NETLIFY_AUTH_TOKEN` in Netlify dashboard at deploy time. |
| Shared rate-limit counter | Per-instance limiter is acceptable for v1 | Move IP counter to a Netlify Blob keyed by `ratelimit:<ip>:<windowStart>`. Documented in ADR-010 §Consequences. |
| Snapshot archival / TTL | Retention policy is permanent for v1 | Add a scheduled cleanup Lambda when storage costs become significant. |
| Share-URL UX in the app | Issue #205 — later wave | Cycle-2 exposes the endpoint; #205 wires the "Publish" button + share dialog. |
| E2E / deploy smoke tests | Out of scope per intent.md | Later wave; the endpoint contract is fully tested at handler level here. |

# ADR-010: Snapshot Backend — Netlify Functions + Blobs

**Status:** Accepted  
**Date:** 2026-05-18  
**Deciders:** maintainer (alxjrvs)  
**Issues:** #202 (ADR), #203 (publish endpoint), #204 (retrieve endpoint)  
**PRD refs:** REQ-NF-04 (rate limit), REQ-NF-05 (no PII), REQ-NF-06 (immutable), REQ-NF-08 + REQ-NF-09 (backend choice)

---

## Context

Wave 5 of the ITUN revamp (M2) introduces anonymous snapshot publishing: a user clicks "Publish" in the character builder, the current build is serialised to JSON and stored with a short URL that anyone can open to see a read-only copy. The backend must:

- Accept a JSON payload and return a stable short URL.
- Enforce immutability (no edits or deletes after publish).
- Apply per-IP rate limiting so a single client cannot flood storage.
- Store no PII — the only data stored is the snapshot JSON the client sends.
- Require no separate infra account beyond what the project already deploys to.

Three candidate backends were considered:

| Candidate | Notes |
|-----------|-------|
| Netlify Functions + Blobs | Same Netlify account as suref-web; no separate infra; Blobs are pay-as-you-go; Functions are included on all Netlify plans. |
| Cloudflare Workers + KV | Excellent globally distributed latency, but requires a separate Cloudflare account + wiring that the project does not currently have. |
| Supabase Storage | Already provisioned for ITUN auth, but Storage is designed for user-owned files, not anonymous blobs; RLS would be awkward; no natural URL routing. |

---

## Decision

**Use Netlify Functions + Blobs.**

Justifications:

1. **Zero-friction deploy.** The project already targets Netlify for suref-web (`apps/suref-web/netlify.toml`). The ITUN app will be deployed to the same Netlify account; Functions and Blobs are available without additional sign-ups or billing seats.
2. **Native blob store.** `@netlify/blobs` provides a typed key/value store backed by Netlify's CDN edge. No schema, no migrations, no connection strings.
3. **Cold-start acceptable.** The publish path is a rare, user-triggered action. Lambda cold-start latency (sub-100 ms typical on Netlify) is acceptable for a non-hot path.
4. **Locality.** Functions live in `apps/in-the-union-now/netlify/functions/` — colocated with the app they serve, not spread across a separate service.

---

## Rate Limiting

- **Limit:** 10 POST requests per minute per originating IP.
- **Enforcement:** In-memory per-Lambda-instance map (`Map<string, { count: number; windowStart: number }>`).
- **Production caveat:** Netlify spins up multiple Lambda instances; the in-memory store is per-instance, not globally shared. For v1 this is acceptable — a single IP can exceed 10 rps by hitting different instances, but the attack surface for anonymous blob flooding is low. A shared counter via Netlify Blobs is documented as the upgrade path (see *Consequences* below).
- **Response on limit exceeded:** `429 Too Many Requests`.

---

## ID Scheme

- **Format:** 8-character base32 string (Crockford alphabet: `0-9A-Z` minus `ILOU`).
- **Entropy:** ~40 bits. At 10 million snapshots (a conservative upper bound for v1), collision probability remains below 1 %.
- **Collision handling:** On insert, check if the key already exists in the blob store. If so, retry with a fresh random ID (up to 5 attempts before returning 500).
- **URL shape:** `GET /api/snapshots/:id` (mapped via `netlify.toml` redirect `[[redirects]]`).

---

## Retention

- **v1:** Permanent. Blobs are never deleted by the backend.
- **Archival policy:** TBD. If storage costs become significant, a TTL-based cleanup Lambda can be added. No TTL metadata is encoded in the blob today, so any future archival pass must use the blob creation date (available via Netlify Blobs metadata).

---

## Idempotency and Mutation

- Snapshots are **immutable** after publish.
- `PATCH`, `PUT`, and `DELETE` requests to either endpoint return **405 Method Not Allowed**.
- The blob key is write-once in `onlyIfNew: true` mode to enforce server-side immutability even against direct API calls.

---

## No-PII Contract

- The only data stored per snapshot is the JSON body the client sends.
- The backend does **not** record IP addresses, user agents, or any other request metadata in the blob payload or blob metadata.
- The Netlify Functions execution logs may transiently contain IP addresses as part of standard infrastructure logging (outside our control), but no PII is persisted to the blob store.

---

## Storage Abstraction

A thin `SnapshotStorage` interface (`apps/in-the-union-now/src/lib/snapshot/storage.ts`) decouples the endpoint handlers from the Netlify Blobs runtime:

```ts
type SnapshotStorage = {
  get(id: string): Promise<unknown | null>
  put(id: string, payload: unknown, options?: { onlyIfNew?: boolean }): Promise<{ modified: boolean }>
}
```

- **Production binding:** `NetlifyBlobsStorage` — wraps `@netlify/blobs` `getStore()`.
- **Test binding:** `InMemoryStorage` — a `Map<string, unknown>` with the same interface. Injected via factory parameter; no `mock.module()` needed.

---

## Consequences

### Positive

- No new accounts, billing tiers, or credential management required.
- All backend code lives in the same monorepo workspace as the app it serves.
- Storage interface is mockable without runtime mocking frameworks.

### Negative / Deferred

- Rate limiting is per-Lambda-instance in v1. Upgrade path: move the counter to a Netlify Blob keyed by IP + time-window. This is a two-line change to the publish handler once the per-instance limit proves insufficient.
- Blobs don't have a native TTL mechanism. Any archival policy requires a scheduled cleanup Function (deferred to a future wave).
- Netlify Blobs require `NETLIFY_SITE_ID` + `NETLIFY_AUTH_TOKEN` env vars when invoked outside the Netlify runtime (e.g., `netlify dev`). These are wired at deploy time; local dev must use `netlify dev` or the in-memory mock.

### Rejected Alternatives

| Alternative | Reason rejected |
|-------------|-----------------|
| Cloudflare Workers + KV | Requires separate Cloudflare account not currently in the project. |
| Supabase Storage | RLS complexity; designed for user-scoped files, not anonymous blobs. |
| Supabase table (jsonb) | Adds DB row per snapshot; overkill; rate-limit query complexity. |

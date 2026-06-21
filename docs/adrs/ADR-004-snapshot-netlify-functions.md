# ADR-004: Snapshot Sharing via Unauthenticated Netlify Functions + Blobs

## Status

Accepted

## Context

The local-first decision ([ADR-001](ADR-001-local-first-no-backend.md)) keeps
user data on-device, but players still want to share a built pilot or mech —
post a link in a Discord channel, open it on a phone, hand it to a GM. That needs
a server endpoint, but introducing accounts or a database would undo the reasons
local-first was chosen.

## Decision

ITUN shares **immutable snapshots** through two **Netlify Functions** backed by
**Netlify Blobs** (`apps/in-the-union-now/netlify/functions/`):

- `snapshot-publish` (POST) stores a snapshot and returns a short ID;
  `snapshot-retrieve` (GET) returns it by ID.
- **No authentication.** Snapshots are opaque blobs, not user records.
- **Immutable.** Writes use `onlyIfNew: true`; a snapshot ID never changes
  content.
- **Short IDs.** 8-character Crockford base32 (~40 bits), generated in
  `apps/in-the-union-now/src/lib/snapshot/id.ts`.
- **Rate limited.** ~10 requests/minute per client IP, tracked in memory
  per function instance (`apps/in-the-union-now/src/lib/snapshot/rateLimit.ts`).
- **Bounded.** Payloads are capped (~256 KB) and **no PII is logged**.
- **Storage is abstracted.** `SnapshotStorage` (`src/lib/snapshot/storage.ts`)
  has a `NetlifyBlobsStorage` production implementation and an in-memory
  implementation for tests. Error reporting via Sentry is optional and
  env-gated (`SENTRY_DSN`).

## Consequences

- Sharing works with zero accounts: publish → get a link → anyone retrieves it.
- Immutability means a shared link is a stable, point-in-time copy — editing your
  local entity does not change a previously shared snapshot.
- Rate limiting is best-effort: in-memory per-instance counters reset on cold
  start and don't coordinate across instances. Acceptable for abuse-dampening,
  not a hard quota.
- This is the **only** server surface in the project; keep it limited to opaque
  snapshot storage. Anything that needs user identity or mutable shared state
  belongs in a new ADR, not here.
- The storage abstraction keeps the functions testable without Netlify Blobs and
  leaves room to swap providers.

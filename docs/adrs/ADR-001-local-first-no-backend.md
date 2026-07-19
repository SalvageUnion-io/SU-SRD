# ADR-001: Local-First, No Backend, No Auth

## Status

Accepted

## Context

SURef ships player-facing tools for a tabletop RPG: a static SRD reference site
(`srd`), a character builder & game manager (`itun`, "ITUN"),
and a Discord dice bot. None of these need a shared server of record: the SRD is
public read-only data, and a player's pilots/mechs/crawlers are private working
documents, not multiplayer state.

An earlier iteration of ITUN used a hosted backend (Postgres, auth,
row-level security, realtime). That coupling bought nothing the product needed — it required
accounts, network availability, and an operational burden — while standing in
the way of an offline-capable, zero-friction "open the app and build" workflow.

## Decision

The apps are **local-first** with **no authentication** and **no application
backend**.

- All user data lives in the browser (IndexedDB; see [ADR-002](ADR-002-indexeddb-idb-zod.md)).
- There are no accounts, sessions, tokens, or per-user server records.
- `srd` is a fully static site (see [ADR-012](ADR-012-srd-astro-static.md)); it has no server runtime.
- ITUN is a PWA with an auto-updating service worker, so it works offline and
  installs to the home screen.
- The **only** server-side surface is the optional, unauthenticated snapshot
  sharing endpoint (see [ADR-004](ADR-004-snapshot-netlify-functions.md)) — it
  stores opaque, immutable snapshots, not user data.

## Consequences

- Data security model is "it's on your device." There is no server breach
  surface for user data and no PII to protect server-side.
- Sharing between devices/people is explicit and opt-in via snapshot URLs, never
  implicit account sync. Cross-device editing is not a feature.
- There is no server-side game state, so there is **no turn/initiative
  enforcement and no cross-player writes** — ITUN is a self-service living
  character sheet on the honor system, and the table handles sequencing socially
  (see `docs/architecture/rules-engine-boundary.md`).
- Backups are the user's responsibility; ITUN nudges export (see the backup
  nudge in `apps/itun/src/lib/backupNudge.ts`).
- No login means no gating; every feature is immediately usable.
- Do **not** reintroduce auth, server-side user storage, or realtime sync
  without a new ADR superseding this one. Multi-user "Games" (cross-user
  pilot↔crawler interactions) are explicitly deferred under this decision.
- Rules logic must stay backend-free so it runs in the browser and the bot
  alike (see [ADR-006](ADR-006-pure-rules-logic.md)).

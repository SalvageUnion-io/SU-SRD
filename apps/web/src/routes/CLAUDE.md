# routes — the client app

**Storage modes: read
[`.claude/rules/app-data-access.md`](../../../../.claude/rules/app-data-access.md)
before touching data.**

- Base `/build/` everywhere, dev too (`lib/appBase.ts`); e2e opens routes via
  `at()`; one spec: `bun run e2e <name>.e2e.ts`.
- **PWA `registerType` stays `'prompt'`:** `autoUpdate` activates a new worker
  under a live page and breaks its chunk loads. Navigations are network-first
  (`src/pwa.ts`); a compatible build is picked up at the next page change
  (`src/lib/sw/softUpdate.ts`); a breaking one raises `convex/buildFloor.ts` by
  hand, which reloads stale tabs.

## Data

- **Zod schemas in `game-domain/schemas/*` are the source of truth**; every
  create, update and adopted server row parses strictly (`src/replica/records.ts`).
- An entity lives in exactly one container, a **Game** or the owner's
  **Shelf**: one nullable `gameId`, resolved through `game-domain/container`.
  Filter with `containerOf` + `sameContainer`, only when `mode === 'connected'`.
- Assignments: draw soft links only via `assignLink`; the rules are
  `game-domain/links/linkRules`, shared with Convex.
- **Never insert into an `appId`-addressed table** (`pilots`, `mechs`,
  `crawlers`, `npcs`, `mechPatterns`) without looking the app id up first:
  `by_app_id` is not unique, and the lookups resolve a duplicate to the oldest row.
- **A copy gets a new UUID; a move keeps its own.** Import (`mergeImport`) and
  Starter Set copies (`copyStarter`) mint fresh ids, since an id becomes the
  server `appId` and a kept one would aim writes at another account's row;
  provenance goes in `seedRef`. Shelf ↔ Game patches `gameId` and nothing else.

## Rules

Pure math is `salvageunion-reference/rules` (never the main barrel or a local
re-export); `src/lib/rules/` is app-local rules only; every die:
`src/lib/dice.ts`.

## Errors

- Say a failed write with `useServerAction` / `failureMessage`, never by
  matching `'Server Error'`.
- **A caught error is reported or explained, never dropped:** surface an
  outcome, report (`captureException` browser, `reportError` Worker), or comment
  why dropping is right. Possibly-unloaded reference data reads through
  `readReference` (`src/lib/readReference.ts`).
- No error SDK in `convex/`; verify reporting by probe ([convex-ops](../../../../.claude/skills/convex-ops/SKILL.md)).

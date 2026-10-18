# cantina — The Cantina, the character builder

React app for building and running Salvage Union pilots, mechs, and crawlers.

**Storage modes — read
[`.claude/rules/cantina-data-access.md`](../../../../.claude/rules/cantina-data-access.md)
before touching data** (it loads with the stores, `src/lib/entities/`, `src/lib/connection/`,
product component folders, `convex/`, `e2e/`).

- Every read-only sheet (`/sheet/:kind/:id`, `/p/:kind/:appId`) is the live
  `<Sheet readOnly>` over `src/build/sheet/readOnlySheetStore.model.ts`;
  build no other.

## Stack

- React 19 + Vite, TypeScript.
- **TanStack Router** — file-based routes in `src/routes/`, generated to
  `src/routeTree.gen.ts`.
- **Zustand** stores (`src/stores/`), in memory (what may persist:
  `cantina-data-access.md`).
- **Base UI** primitives from `src/components` (`atoms/`, `containers/`) —
  there is no app-local primitives folder. Styling is the `src/components`
  tokens and stylesheet (ADR-046).
- **PWA** (`vite-plugin-pwa`, **`registerType: 'prompt'`**) — installable;
  the shell boots offline (signed out and empty: there is no data cache). It
  is `prompt` and must stay that way: `autoUpdate` force-sets `skipWaiting` +
  `clientsClaim`, which activated a new worker under a live page and dropped
  the precache entries it was still resolving chunks against. Navigations are
  **network-first** (`src/pwa.ts`): online boots the deployed shell,
  offline the precached one. A compatible build is picked up at the next page
  change (`src/lib/sw/softUpdate.ts`); a breaking one raises the build floor
  (`convex/buildFloor.ts`, by hand), which reloads stale tabs.

## Persistence and state (read before touching data)

- **Zod schemas (`packages/cantina-domain/src/schemas/`, imported as
  `cantina-domain/schemas/*`) are the source of truth** for entity shape;
  every create, update and adopted server row parses strictly
  (`src/stores/records.ts`); `ShelfSync` reports a row that does not parse and
  carries on.
- **There are no workspaces.** An entity lives in exactly one **container** — a
  shared **Game** or the owner's **Shelf** — encoded as one
  nullable `gameId` and resolved through `cantina-domain/container`. Filter with `containerOf` +
  `sameContainer`, and only when `mode === 'connected'`: signed out there is
  nothing to show, and Disconnected has no live Game list to filter against, so
  it shows what it holds whole. `Roster` shows Shelves at `/` (all you
  keep, Games too) and a Game at `/games/$gameId`.
- **Assignments** ([ADR-037](../../../../docs/ARCHITECTURE.md#decisions)):
  draw soft links only via `assignLink`; the rules are
  `cantina-domain/links/linkRules`, shared with Convex.

## Combat / rules

- Pure math: the `salvageunion-reference/rules` subpath, never the main barrel
  or a local re-export; `src/lib/rules/` is Cantina's app-local rules only. Every
  die is the UI library's `utils/dice.ts`.
- Play actions go in Play (`play/`); the one sheet-local play
  control is `CrawlerEconomyControl.tsx`.
- Destructive condition changes stay player-driven via `StatusBadge` →
  `cycleItemCondition`.
- Full picture: [dashboard §5](../../../../docs/architecture/dashboard.md),
  [combat loop](../../../../docs/ARCHITECTURE.md#combat).

## Conventions

- Choices stay persistence-agnostic in the shared library — Cantina owns the
  selections ([ADR-010](../../../../docs/ARCHITECTURE.md#decisions)).
- No error SDK in `convex/`; verify reporting by probe, see
  [convex-ops](../../../../.claude/skills/convex-ops/SKILL.md).
- **Throw `ConvexError` when the message is for a player; plain `Error` when it
  is not.** Convex redacts every non-`ConvexError` throw to
  `"[CONVEX M(fn)] […] Server Error"` before the client sees it, so a
  user-facing message thrown as a plain `Error` is written and then discarded.
  `NotAuthorized` (`convex/model/permissions.ts`) extends `ConvexError` for
  exactly this reason; parse failures and broken invariants stay plain. On the
  client, say a failed write with `useServerAction` / `failureMessage`
  (`src/lib/connection/useServerAction.ts`) — never by string-matching
  `'Server Error'` or rendering the caught error's text.
- **A caught error is either reported or explained — never just dropped.**
  Catching is what keeps an error away from the window's `error` event, so a
  `catch` must do one of three things: produce an outcome the user or caller
  sees (an error state, a 4xx/5xx, a rethrow with `cause`), report through
  `captureException` (browser) or `reportError`
  (Worker), or carry a comment saying why dropping it is correct. Biome's
  `noEmptyBlockStatements` rejects a block with none of those. Reading
  reference data that may not be preloaded goes through
  `readReference` (`src/lib/readReference.ts`), which
  stays silent for `SchemaNotLoadedError` and reports anything else once per
  source — never a bare `try { SalvageUnionReference… } catch { return [] }`.
- **Never insert into an `appId`-addressed table without checking first.**
  `pilots`, `mechs`, `crawlers`, `npcs` and `mechPatterns` are looked up by
  the client's `appId`, and `by_app_id` is an ordinary index — **not** a
  uniqueness constraint — so nothing in the database stops a second row.
  Prevention is the rule: look the app id up (`byAppId`) before any insert.

  The lookups (`oldestByAppId`, `patternByAppId`) do **not** throw on a
  duplicate: they resolve to the oldest row (write paths also `console.warn`).
- **A copy gets a new UUID; a move keeps its own.** These pull in opposite
  directions, so both matter:
  - **Copy → new id.** Importing a bundle (`mergeImport`) mints a fresh UUID
    per row and remaps the soft links onto them; copying a Starter Set template
    (`copyStarter`) mints a fresh id through `entityStore.create`. An entity id
    becomes its `appId` on the server, so a copy that kept its id would put one
    id in two accounts — and since a duplicate resolves to the oldest row, the
    second account's writes aim at the first account's entity and are refused
    by `assertMayWrite` as somebody else's. Never write a fixed or template id
    into `pilots`/`mechs`/`crawlers`/`npcs`; record provenance in `seedRef`,
    which is what it is for.
  - **Move → same id.** Shelf ↔ Game is a container change, patching `gameId`
    and nothing else. A Game is a viewport onto the same sheet, not a duplicate
    of it — never re-mint on a move, and never treat one as a fork.

## Commands

The root `AGENTS.md` list, plus `bun run e2e` (one file: `bun run e2e <name>.e2e.ts`); local Convex
setup is the convex-ops skill. Base `/build/` everywhere, dev too
(`lib/appBase.ts`); e2e opens routes via `at()`. How it builds and serves:
[ADR-050](../../../../docs/adr/050-one-app.md).

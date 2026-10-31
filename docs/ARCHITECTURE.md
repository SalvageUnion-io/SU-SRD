# Architecture

The living spec: what is true now, one Area per subject; cite an Area by its anchor (`#ci`).
An Area's headline names the ADRs folded into it; its detail is the spec doc it links. ADRs still being built keep their entry, and full text in [`docs/adr/`](adr/).
**Names:** one app, `apps/web` ([one app](architecture/one-app.md)); areas `src/reference/`, `src/build/` (**Training Bay**), `src/play/` (**The Cantina**).

## Areas

1. **Packages** <a id="packages"></a>
   `salvageunion-reference` → every app; `game-domain` → `apps/web` (app, Worker, rooms) / bot / `gates`; `gates` → `tools/`, app e2e.
   Packages never import an app (`noRestrictedImports`); deps use `workspace:*`.
2. **salvageunion-reference** · ADR-005, ADR-006, ADR-013 <a id="reference"></a>
   Private, no build, no version. Zod in `lib/schemas/` is the one source of types, JSON Schema and validation: every schema imports `z` from `lib/zod.ts` (`jitless`, for the CSP), never `zod`; `Ref*` types and JSON Schema are gitignored, rebuilt on install, typecheck, build and test (`ref-generate`).
   Rules in `lib/rules` are pure (state in, result out, callers persist; Randsum the one dice source, no RNG bound). Exports `.`, `./rules`, `./zod`, `./testing`, `./proseDeviations`, `./assetDerivatives`, `./data/*`, `./schemas/*` from the explicit barrel `lib/index.ts`; refs `schemaId::entityId`.
3. **Lazy loading** <a id="lazy-loading"></a>
   Call `preload()` before any accessor; a module-scope ORM call fails Biome (`noModuleScopeReferenceCall.grit`).
   Tests preload `salvageunion-reference/tools/testPreload.ts` from each `bunfig.toml`, never `preload('all')` per file.
4. **UI library** · ADR-011 <a id="ui-library"></a>
   `apps/web/src/components/index.ts` barrel, TypeScript source with no build; data-source agnostic, behaviour injected through slot props. Only the areas and `shared/` wire stores or the Worker; the library imports no area.
   Unused exports: [knip](#dead-code).
5. **Styling** · ADR-046 <a id="stylesheets"></a>
   Tokens in `apps/web/src/styles/theme.css`, mirrored as style objects by `apps/web/src/design/tokens.ts`; classes in one stylesheet, also for styles repeated per page; `no-tailwind` bars Tailwind. Rules: `.claude/rules/styling.md`.
   One entry, `apps/web/src/styles/entry.css` (tokens, `layer(su-reset)`, `layer(su-base)`), imported by both render modes; app stylesheets stay unlayered, so they win.
6. **One app, static pages (Astro)** · ADR-050, ADR-065 · [spec](architecture/one-app.md) <a id="ssg"></a>
   One app, one build, Worker, head, install and checks; Astro 7, its islands React (`@astrojs/react`, [DESIGN.md](../apps/web/astro/DESIGN.md)); `apps/web/astro/pages/` lists every page and endpoint, each a shell over a `.tsx` module.
   Pages link one stylesheet of their own (`astro/layouts/Page.astro`); no auth, router or Zustand.
7. **Dataset API** · ADR-014, ADR-040, ADR-043, ADR-056 · [spec](architecture/dataset-api.md) <a id="dataset-api"></a>
   The dataset's public interface: static files at `/api/v1/` from the committed data, additive only, a break is `/api/v2/`; never an npm package, no release stream.
   `/schema/*` serves the same files byte for byte, the unversioned alias; each schema's `$id` is the URL it is served at; CORS on.
8. **discord-bot** <a id="discord-bot"></a>
   A Worker answering HTTP interactions (no gateway, no `discord.js`); conventions in [its CLAUDE.md](../apps/discord-bot/CLAUDE.md).
   Imports `game-domain` types, and values only from its leaf modules (botWire, product, appAddress, entityKinds; `noRestrictedImports`); changing them is cross-package. Lookup = embed: `discordEntryCard`.
9. **game-domain** <a id="game-domain"></a>
   Zod schemas, roles, link/crew/downtime rules and bot wire types for the app, the rooms and the bot; import by subpath.
   Rules: pure → reference `lib/rules`; shared → here; client → `src/lib/rules`; `check rules-home` bars a rule in a product folder.
10. **Data flow and the sync status** <a id="data-flow"></a>
    Records store slug refs, resolved at render; the app preloads once in `GameDataReady.tsx`.
    One status, `useSync()` (`src/replica/sync.ts`): `signedOut` (read-only), `syncing`, `live`, `offline` (what is held; own pilot, mech and NPC edits wait in the outbox, the rest is blocked), plus `outdated`.
11. **The rooms, the server of record** <a id="rooms"></a>
    A SQLite Durable Object per account (`AccountRoom`, the Shelf) and per Game (`GameRoom`), wired in `src/worker/rooms.ts`, logic in `src/rooms/`; D1 `SHARED` for accounts and cross-room reads. An entity is [in a Game or on a Shelf](architecture/glossary.md); a unit's body changes only by an op (ADR-063), parsed by `applyOp`.
    Every client write goes through `src/replica/outbox.ts`, as ops or an act on the unit's room; each replica table has a `RECORD_KINDS` entry.
12. **Device copy** <a id="device-copy"></a>
    `src/replica/persist.ts` keeps every held row in IndexedDB, stamped with the session's account, so an offline boot shows what the last load held, and beside them the outbox: one op per own unit made offline, replayed to its room once `live` (ADR-063 decision 9).
    Another account's copy is dropped unread; signing out drops it; `e2e/app-offline.e2e.ts` pins the shell, the copy and the outbox.
13. **The replica** <a id="stores"></a>
    `src/replica/` is the one holder of server rows, filled by the room sockets (`RoomFeed`) as scope snapshots; newer wins by `headSeq`. `update()` diffs into an op at its `headSeq` and holds the room's answer; a refused op changes nothing.
    No TanStack Query; reads: `useUnits` and kin, `src/lib/entities/`, the Games calls (`src/replica/roomCalls.ts`). `src/stores/` is UI state only.
14. **Sharing** <a id="sharing"></a>
    The one account-free share is the public sheet `/p/:kind/:appId`, opt-in via the `publicRead` column (ADR-032).
15. **Deployments** <a id="deployments"></a>
    Production is the su-srd Worker with D1 `su-shared`; each Preview has its own rooms and the D1 `su-shared-preview`. Convex was retired and deleted (2026-10-27): its last export is in the private R2 bucket `su-archive`, and the `convex-last` tag holds its code.
    `bun run dev` runs the Worker beside the dev server with test auth; setup and rotations are the `site-ops` skill.
16. **Worker environment** <a id="worker-env"></a>
    Sign-in is the site Worker's (`src/worker/auth/`, D1 `SHARED`): `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`; the bot is reached by service binding (`BOT`), with no shared secret.
    `TEST_AUTH` never in production; `wrangler secret list` prints names only.
17. **Room conventions** <a id="room-conventions"></a>
    A room reads and writes through `RoomSql`; an act is named (`src/rooms/game/acts.ts`, `src/rooms/account/acts.ts`) and the Games calls go through `/__rooms/call`.
    A refusal the player reads is a `RoomRefusal` (`src/rooms/refusal.ts`), a `RoomDeclined` in the app; anything else a room throws is a defect, answered without its message.
18. **Surfaces and enforcement** · ADR-007, ADR-009, ADR-021 · [spec](architecture/surfaces.md) <a id="surfaces"></a>
    Enforcement follows the surface's mode: Guided Creation (Wizard), Free Edit (Live Sheet), Guided Play and Adjudicate (Play), Frozen (`/p/`). Lifecycle transactions are enforced in guided modes and bypassed in Free Edit; caps are overridable with a callout.
    The app automates bookkeeping (Heat, EP / AP, uses, SP damage) but never changes a condition or destroys without the player; conditions cycle intact → damaged → destroyed by `StatusBadge`.
19. **Live-Sheet transactions** <a id="live-sheet"></a>
    A closed list: crawler Upkeep / Upgrade / Trade, bay Repair, item repair and uses; advisory, never blocking.
    Any new transaction goes in Play.
20. **Change Log** <a id="change-log"></a>
    A unit's history is its applied ops (`transaction` / `override` / `manual`, ADR-063); `changeLog` keeps Game rows and moves.
    Read in `ChangeLogDrawer`; destruction waits for the player (ADR-007).
21. **Combat loop** <a id="combat"></a>
    A shared living sheet: no combat RPCs, turns or undo; the math is the reference package's `lib/rules/`, patches are the app's.
    Activation is a sequential write-through (ADR-008); item conditions change only by player action (ADR-009).
22. **Display system** · ADR-010, ADR-026, ADR-028, ADR-053 · [spec](architecture/entity-card.md) <a id="display"></a>
    Entity forms (Mention, Mini, Compact, index Compact, Peek; [EDL](design-system/entity-display-language.md)) come from `toEntityModel`; contentful forms and Page are `ReferenceEntityCard`, the only one, app UI layered on. `Box` is every other frame, never merged with it.
    App UI goes through `controls` and slot props, never schema props. Every design law in `docs/design-system/` names its gate (`CANON`, `bun run check canon`), or is cut.
23. **Discord bot as a Game client** <a id="bot-game-client"></a>
    Game commands ask the site Worker's `BotGateway` (`src/worker/botGateway.ts`) over the bot's `SITE` binding; the site posts Play's rolls through the bot's `Relay` (its `BOT` binding).
    Writes only channel bindings; the site unreachable: every Game command answers `unavailable`. Each interaction logs its command.
24. **SEO** <a id="seo"></a>
    One site name (`pageTitle`), one WebSite JSON-LD (`WEBSITE`), one sitemap; heads: `BaseLayout.tsx`; shared sheets: ADR-032; `/llms.txt` exact; SW: `src/pwa.ts`.
    No-JS fallback: `StaticEntityContent` and each island's stand-in, which the island swaps in over (`clientSwap`); an `<Island hydrate>` Astro renders and hydrates itself.
25. **Accessibility** <a id="a11y"></a>
    Biome's a11y rules plus axe (WCAG 2.2 AA) specs over `PAGES`, the app signed in.
    Contrast is held by `apps/web/src/design/__tests__/contrast.test.ts`; coarse-pointer touch targets are 44px.
26. **CI** <a id="ci"></a>
    `ci.yml` runs on every `pull_request` (no branch filter), path-filtered; `CI Success` must need every job.
    Static checks are `bun tools/check.ts --profile=ci`; tests are `bun run test:coverage` against per-workspace `FLOORS`.
27. **Repository settings** <a id="repo-settings"></a>
    `main` ruleset (`MAIN_RULESET` in `tools/environments.ts`): no deletion or force-push, PR only, strict `CI Success` + PR-title checks, CodeQL.
    Actions are allowlisted and SHA-pinned (zizmor); ruleset and Environments drift-checked nightly; no merge queue.
28. **Deploy** <a id="deploy"></a>
    `deploy-cloudflare.yml` on `main` push: plan → build → deploy → smoke → record (tag `deployed/cloudflare`); `tools/deploy-surfaces.ts` picks what ships, fails safe to everything; a dispatched `sha` rolls back.
    D1 migrates before the Worker ships and never back, so a migration is expand-only: a drop or rename lands once no deployed Worker reads it (`check-migrations.ts`).
29. **Preview deploys** <a id="previews"></a>
    A PR into `main` or a `su-io-*` release branch labelled `preview` gets a su-srd Preview `pr-<n>` (its own rooms) per push, linked in a comment, deleted on close.
    The label is the approval (no Environment reviewer); Previews share the D1 `su-shared-preview`.
30. **Dependencies** <a id="dependencies"></a>
    Dependabot updates Actions only; Bun deps by hand, pinned exactly, with a 3-day `bunfig.toml` cooldown.
    Declare every import; a shared runtime package is a root `catalog:` entry, a shared dev tool a root devDependency.
31. **Audit and overrides** <a id="audit"></a>
    `bun run audit` fails any advisory (PRs touching manifests, and nightly); it ignores nothing.
    `overrides`: `sharp` is a floor and `miniflare`'s `undici` and `@cloudflare/vitest-plugin`'s `zod` pins until each asks for the fix; `@randsum/roller` and `salvageunion-reference` pin one copy. `deepmerge` points at `vendor/deepmerge`, upstream 4.3.1 with GHSA-gcqx-w48m-w2h4 fixed (no fixed release exists; only the PWA build reaches it); drop both once upstream ships one. `workbox-build`'s `glob` (14) and `filelist`'s `minimatch` (11) fix GHSA-3g3m-2fjr-6pw4 and GHSA-g3hv-75wg-m249 (only the PWA build reaches them, and `filelist` only through `jake`'s CLI); drop each once its parent asks for the fix.
32. **Dead code** <a id="dead-code"></a>
    `bun run knip` with `includeEntryExports`; delete what it flags; `@public` and `@knipignore` are the only escape hatches.
33. **MCP servers** <a id="mcp"></a>
    `.mcp.json` is secret-free: `cloudflare-bindings`, `cloudflare-observability`, `context7`.
    Only `context7` is enabled; opt into the OAuth two in `.claude/settings.local.json`. `claude mcp list` proves one works.
34. **Cloud sessions** <a id="cloud"></a>
    `gh` is REST only (GraphQL gets 403): use `gh api` or `mcp__github__*`; no route means report it unread.
    Merge: `gh api -X PUT repos/{owner}/{repo}/pulls/<n>/merge -f merge_method=squash` or `mcp__github__merge_pull_request`; no `gh stack`. Environment, `su-rules`: [cloud-environment.md](ops/cloud-environment.md).
35. **Cloudflare** <a id="cloudflare"></a>
    Workers `su-srd` (`salvageunion.io`, `www.`, `intheunionnow.com` → `/build`) and `su-discord-bot`, both on workers.dev (the bot's Discord endpoint, the smoke check); D1 `su-shared`(`-preview`); R2 `su-photos`(`-preview`), `su-archive` ([room backups](ops/room-backups.md), the Convex export), `su-rules-private`, and `su-lp-assets` on `assets.salvageunion.io` (ADR-033; zone rules "artwork…" resize, cache, set headers).
    The account is shared with RANDSUM; re-derive from `apps/*/wrangler.jsonc`, `wrangler deployments list`.
36. **Error tracking** · ADR-049 <a id="errors"></a>
    Workers Issues, no SDK, browser stacks minified; browsers post to `/__errors`.
    `tools/check-observability.ts` guards it.
37. **Identifiers** <a id="identifiers"></a>
    The deleted Convex project was `alex-jarvis:susrd` (production `exuberant-porpoise-183`); its last export is `su-archive/convex/`.
    Repo `SalvageUnion-io/SU-SRD`, branch `main`; the deployed commit is the release (ADR-041).
38. **Contributions and provenance** · ADR-029 · [spec](architecture/contributions.md) <a id="contributions"></a>
    One source / op / target model in `salvageunion-reference/lib/rules/contributions.ts`; derivations return parts, so provenance shows wherever a value does.
    Duration effects are Play's and never persisted; every stated mechanical change is a contribution or a reasoned exemption.
39. **UI words** · ADR-054 · [spec](architecture/messages.md) <a id="messages"></a>
    Every word the app draws is a key in `apps/web/src/messages/`, values as `{name}` placeholders; English only.
    The `ui-strings` rule set ratchets the strings still typed at the call site.
40. **Addresses** · ADR-048, ADR-062 · [spec](architecture/addresses.md) <a id="addresses"></a>
    Reference `/`, Training Bay `/build/`, Play `/play/`, one app mapped by `appPath` / `routeInApp`; sheets `/build/<kind>s/:id`.
    Every retired address 301s once (`retiredTarget`).

## Decisions

ADRs are never renumbered: entry N is ADR-N. A new decision lands as an entry and a change to its Area; once built, it folds into that Area.
Retired (text in git): ADR-001, ADR-002, ADR-003, ADR-004, ADR-012, ADR-015, ADR-016, ADR-017, ADR-018, ADR-019, ADR-020, ADR-023, ADR-024, ADR-025, ADR-027, ADR-031, ADR-035, ADR-039, ADR-045, ADR-047.

8. **ADR-008 Sequential client-side mutations**
   No atomic transaction or rollback; affordability is checked before an action runs. Amended by ADR-063.
22. **ADR-022 Change Log and stat overrides**
    Every write appends to a per-entity log; a cap override is an absolute pin, a zero-delta pin none.
    Amended by ADR-030 and ADR-034: the log is account data on Convex; by ADR-063: the log is the op log.
30. **ADR-030 Accounts, Games, and a server of record** · [full text](adr/030-accounts-games-server-of-record.md)
    Governing: Discord-only accounts; Convex of record; Games and Shelves; roles; cross-player writes by proposal. Amends ADR-022.
    Amended by ADR-032, ADR-034, ADR-037, ADR-038, ADR-051, ADR-052, ADR-055, ADR-058, ADR-063 (§1, §4) and ADR-064.
32. **ADR-032 Public, read-only sheets** · [full text](adr/032-public-read-only-sheets.md)
    Opt-in `publicRead` per entity; the owner decides, the table runner for a Game's crawler.
    Amends ADR-030's visibility rule; amended by ADR-036, ADR-061.
33. **ADR-033 Hosting on Cloudflare** · [full text](adr/033-hosting-on-cloudflare.md)
    Workers (Static Assets, R2) serve everything; Actions builds, `wrangler` deploys. Amended by ADR-048, ADR-050, ADR-064.
34. **ADR-034 Persistence requires an account**
    Signed out is read-only, every record is Convex-backed, the app is a PWA.
    Amends ADR-022 and ADR-030; amended by ADR-058.
36. **ADR-036 Retire snapshot shares**
    The public sheet is the only account-free share; no `/api/snapshots`. Amends ADR-032.
37. **ADR-037 The assignment model**
    One-hop links `mech-to-pilot`, `pilot-to-crawler`, `mech-to-crawler`; a new link replaces conflicts; one container.
    Amends ADR-030; amended by ADR-044. Code: `packages/game-domain/src/links/linkRules.ts`.
38. **ADR-038 The Dashboard is a Game surface with shared play state** · [full text](adr/038-dashboard-game-surface.md)
    Built; ADR-051 keeps its seat, replacing Game-only, the slots and the 1280×800 canvas. As built: [play.md](architecture/play.md).
    Amends ADR-029 §4, ADR-030 §5–6 and ADR-034; amended by ADR-051.
41. **ADR-041 The deployed commit is the release**
    No app versions; one changelog, `/changelog`: `main`'s first-parent history by scope.
42. **ADR-042 Mid-tab updates**
    `apps/web/src/lib/connection/buildFloorStamp.ts` is raised by hand only for a change that breaks an open tab.
    Anything else is a soft update.
44. **ADR-044 Built NPCs and the `npc-to-crawler` link**
    Built: an `npcs` table like pilots; a slotted link authorised by the crawler's writer.
    Amends ADR-037. As built: [npc-builder.md](architecture/npc-builder.md).
51. **ADR-051 Play mode, a Cockpit** · [full text](adr/051-play-mode.md)
    Built: Play beside Reference and Build; one layout, phone first: tabs below `lg`, Units | Actions | Crew, Tables, Feed from it; solo seats.
    Supersedes ADR-038 §1, §9 and its layout, and ADR-045; amends ADR-030; amended by ADR-052. As built: [play.md](architecture/play.md).
52. **ADR-052 Build owns your assets, Play owns Games** · [full text](adr/052-build-assets-play-games.md)
    Built: Build lists all you own, a Game a chip; Play has the hub, Game pages, invites, Cockpits.
    Amends ADR-030 §6, ADR-051 §1; amended by ADR-059, ADR-062.
55. **ADR-055 Crew assets are assigned, never claimed** · [full text](adr/055-crew-assets-assign.md)
    Built: in a Game the assigned member edits, the crew reads, the table runner reassigns; Game reads answer empty to ex-members.
    Amends ADR-030 §2, §4–6.
57. **ADR-057 Usage signals and feedback** · [full text](adr/057-usage-signals-feedback.md)
    Built: daily aggregate totals and weekly counters, an admin page, feedback filed as public GitHub issues, `/roadmap`.
58. **ADR-058 A read-only device copy** · [full text](adr/058-device-copy.md)
    Built: offline, the player's own sheets come back from the device; Convex stays of record.
    Amends ADR-030 §1 and ADR-034; replaced by ADR-063 decision 9 (the outbox).
59. **ADR-059 The Mediator's prep kit** · [full text](adr/059-mediator-prep-kit.md)
    Built: encounters on the Training Bay shelf (opposition, tables, private notes), run into a Game's Opposition as a copy. §5 (flagged): groups, waves, a briefing to tell the table; encounters in the device copy.
    Amends ADR-052 §1.
60. **ADR-060 Feature flags** · [full text](adr/060-feature-flags.md)
    Built: `src/lib/flags.ts`; unfinished surfaces merge dark: off on production's origin, on in Previews, dev and test-seam builds.
61. **ADR-061 Homebrew on the SRD** · [full text](adr/061-homebrew.md)
    Built: link-shared patterns their makers opt in, at `/homebrew/` and behind a chassis page's "Show Homebrew", via the Worker; readers report, an admin hides. Built-in homebrew (credited Mech Monday patterns in the data) lists with them.
    Amends ADR-032; narrows ADR-021 and ADR-030 on homebrew.
63. **ADR-063 Typed ops are the write** · [full text](adr/063-typed-ops-are-the-write.md)
    A unit changes only by an op through the pure `applyOp`; its body is a snapshot at `headSeq`. Offline, ops on your own units wait in an outbox.
    Amends ADR-008, ADR-022 and ADR-030 §1, §4; replaces ADR-058.
64. **ADR-064 Cloudflare rooms are the server of record** · [full text](adr/064-cloudflare-rooms.md)
    A SQLite Durable Object per account and per Game, D1 for cross-room reads, R2 for art and backups; the Worker signs in. One cutover at 4.5.0.
    Supersedes ADR-030 §1's Convex sentence and ADR-033 §5.

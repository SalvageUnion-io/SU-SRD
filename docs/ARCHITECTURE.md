# Architecture

What is true now: one entry each, a headline and at most two lines. Cite an Area by its anchor (`#ci`), never its number.
The ADRs code cites by § keep their full text in [`docs/adr/`](adr/), linked from their entries; the rest of
the pre-collapse text is `git show 62d5afa:docs/ARCHITECTURE.md`.

## Areas

1. **Packages** <a id="packages"></a>
   `salvageunion-reference` → `component-lib` → `srd` / `itun`; `itun-domain` → `itun` / `discord-bot`; `component-lib/product` alone → bot, `convex/`; `gates` → `tools/`, app e2e.
   Packages never import an app (`noRestrictedImports`); deps use `workspace:*`.
2. **salvageunion-reference** <a id="reference"></a>
   Private, no build, no version. Zod in `lib/schemas/` generates JSON Schema and `SURef*` types, gitignored and rebuilt on install, typecheck, build and test (its `su-ref-generate` bin).
   Exports `.`, `./rules`, `./zod`, `./testing`, `./proseDeviations`, `./data/*`, `./schemas/*`; `lib/index.ts` is an explicit barrel; refs are `schemaId::entityId`.
3. **Lazy loading** <a id="lazy-loading"></a>
   Call `preload()` before any accessor; a module-scope ORM call fails Biome (`noModuleScopeReferenceCall.grit`).
   Tests preload through `test/reference-preload.ts` in each workspace's `bunfig.toml`, never `preload('all')` per file.
4. **component-lib** <a id="component-lib"></a>
   TypeScript source, no build; `src/index.ts` barrel; tokens in `src/styles/theme.css`, mirrored by `src/design/tokens.ts`.
   A composition one app renders lives in that app (`bun run check barrel-consumers`); an export nothing imports is knip's ([dead code](#dead-code)).
5. **Stylesheet wiring** <a id="stylesheets"></a>
   One entry, `packages/component-lib/src/styles/entry.css` (tokens, `layer(su-reset)`, `layer(su-base)`), imported by the apps.
   App stylesheets stay unlayered, so they win; rules: `.claude/rules/styling.md`.
6. **srd build** <a id="srd-build"></a>
   In-house Vite SSG with React islands ([DESIGN.md](../apps/srd/ssg/DESIGN.md)); routes and endpoints are registered, never discovered.
   No `.css` import reachable from SSR (CSS enters via `src/runtime/styles.entry.ts`); no auth, router or Zustand.
7. **Dataset API** <a id="dataset-api"></a>
   srd serves the package's `data/` and generated `schemas/` verbatim at `/schema/*` (`apps/srd/src/lib/referenceFiles.ts`), CORS on.
   Each schema's `$id` is the URL it is served at; `api.salvageunion.io/v1` is decided, not built (ADR-043, ADR-047).
8. **discord-bot** <a id="discord-bot"></a>
   A Worker answering HTTP interactions (no gateway, no `discord.js`); conventions in [its CLAUDE.md](../apps/discord-bot/CLAUDE.md).
   Imports `itun-domain` (botWire, schemas) as types only; changing them is cross-package. Lookup = embed: `discordEntryCard`.
9. **itun-domain** <a id="itun-domain"></a>
   Zod schemas, roles, link/crew/downtime rules and bot wire types for ITUN, Convex and the bot; import by subpath.
   Rules: pure → reference `lib/rules`; shared → here; client → `apps/itun/src/lib/rules`; `check rules-home` bars Convex→`src/`.
10. **Data flow and connection modes** <a id="data-flow"></a>
    Records store slug refs, resolved at render; ITUN preloads once in `GameDataReady.tsx`.
    `resolveConnectionMode()`: Solo (signed out, read-only), Connected (Convex), Disconnected (on-screen rows, writes blocked).
11. **Convex, the server of record** <a id="convex"></a>
    `apps/itun/convex/`: opaque bodies (`v.any()`), Zod-parsed per mutation; an entity is [in a Game or on a Shelf](architecture/glossary.md).
    Every store commits through a `commit*` in `apps/itun/src/stores/`; `containerParity.test.ts` asserts each has a table.
12. **No device cache** <a id="no-device-cache"></a>
    No IndexedDB: an offline reload boots the SW shell, signed out and empty. The PWA stays installable; `e2e/offline.e2e.ts` pins both offline cases.
13. **Zustand stores** <a id="stores"></a>
    `apps/itun/src/stores/` hold rows in memory, filled by `ShelfSync`; `update()` validates, awaits Convex, then logs.
    A refused write changes nothing; no TanStack Query, reads are `src/hooks/entities/` and `convex/react`.
14. **Sharing** <a id="sharing"></a>
    The one account-free share is the public sheet `/p/:kind/:appId`, opt-in via the `publicRead` column (ADR-032).
    Snapshots are retired (ADR-036).
15. **Convex deployments** <a id="deployments"></a>
    Production `exuberant-porpoise-183`; staging `perfect-donkey-72`, previews only.
    `bun run dev:itun` runs a local deployment with test auth; setup, rotations and repairs are the `convex-ops` skill.
16. **Convex environment** <a id="convex-env"></a>
    Sign-in: `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`; bot: `ITUN_BOT_SECRET`.
    `ITUN_TEST_AUTH` never in production; `convex env list` prints values, so pipe it through `cut -d= -f1`.
17. **Convex conventions** <a id="convex-conventions"></a>
    Mutations use `mutation` / `internalMutation` from `apps/itun/convex/model/entities.ts` (its triggers keep `games.summary`).
    Tell refusals from defects with `src/lib/connection/serverError.ts`; a one-off repair runs once from the dashboard, then is deleted.
18. **Surfaces and enforcement (ADR-021)** <a id="surfaces"></a>
    Guided Creation (Wizard), Free Edit (Live Sheet), Guided Play (Dashboard), Frozen (`/p/`), Adjudicate (Mediator Dashboard).
    Lifecycle transactions are enforced in guided modes and bypassed in Free Edit; caps are overridable with a callout.
19. **Live-Sheet transactions** <a id="live-sheet"></a>
    A closed list: crawler Upkeep / Upgrade / Trade, bay Repair, item repair and uses; advisory, never blocking.
    Any new transaction goes on the Dashboard.
20. **Change Log** <a id="change-log"></a>
    Every write appends a `transaction` / `override` / `manual` row to Convex `changeLog` at `entityStore.update`.
    Read in `ChangeLogDrawer`; destruction waits for the player (ADR-007).
21. **Combat loop** <a id="combat"></a>
    A shared living sheet: no combat RPCs, turns or undo; the math is the reference package's `lib/rules/`, patches are the app's.
    Activation is a sequential write-through (ADR-008); item conditions change only by player action (ADR-009).
22. **Display system** <a id="display"></a>
    Entity forms (Mention, Token, Row, Peek; [EDL](design-system/entity-display-language.md)) come from `toEntityModel`; Card and Page are `ReferenceEntityCard`.
    `Card` is the generic container, never merged with it; app UI goes through `controls` and slot props, never schema props.
23. **Discord bot as a Game client** <a id="bot-game-client"></a>
    `/su me`, `games` and `sheet` call `POST /bot/<op>` (`apps/itun/convex/botHttp.ts`) with `ITUN_BOT_SECRET`.
    Read-only; Convex unreachable means every Game command answers `unavailable`. Each interaction logs its command.
24. **SEO** <a id="seo"></a>
    srd's head is `BaseLayout.tsx` from `DocumentMeta`; JSON-LD, `ssg/sitemap.ts`, `/llms.txt` (byte for byte), PWA via `ssg/pwa.ts`.
    No-JS fallback: `StaticEntityContent`, replaced by islands mounted with `createRoot` (no hydration).
25. **Accessibility** <a id="a11y"></a>
    Biome's a11y rules plus axe (WCAG 2.2 AA) specs: each app's `PAGES`, ITUN signed in.
    Contrast is held by `design/__tests__/contrast.test.ts`; coarse-pointer touch targets are 44px.
26. **CI** <a id="ci"></a>
    `ci.yml` runs on every `pull_request` (no branch filter), path-filtered per app; `CI Success` must need every job.
    Static checks are `bun tools/check.ts --profile=ci`; tests are `bun run test:coverage` against per-workspace `FLOORS`.
27. **Repository settings** <a id="repo-settings"></a>
    `main` ruleset (`MAIN_RULESET` in `tools/environments.ts`): linear history, strict `CI Success` + PR-title checks, CodeQL.
    Actions are allowlisted and SHA-pinned (zizmor); ruleset and Environments drift-checked nightly; no merge queue.
28. **Deploy** <a id="deploy"></a>
    `deploy-cloudflare.yml` on `main` push: plan → build → `push-convex` → deploy (srd's after `og-srd`) → smoke → record (tag `deployed/cloudflare`).
    `tools/deploy-surfaces.ts` picks what ships and fails safe to everything; a dispatched `sha` rolls back. srd's OG images build at deploy; the bot leg registers its slash commands.
29. **Preview deploys** <a id="previews"></a>
    A PR into `main` labelled `preview` gets Worker Previews `pr-<n>` (srd, ITUN on staging Convex) per push, linked in a comment, deleted on close.
    The label is the approval (no Environment reviewer); staging's schema and `SITE_URL` follow the last PR shipped.
30. **Dependencies** <a id="dependencies"></a>
    Dependabot updates Actions only; Bun deps by hand, pinned exactly, with a 3-day `bunfig.toml` cooldown.
    Declare every import; a shared runtime package is a root `catalog:` entry, a shared dev tool a root devDependency.
31. **Audit and overrides** <a id="audit"></a>
    `bun run audit` fails any advisory (PRs touching manifests, and nightly); it ignores nothing.
    `overrides`: `sharp` is a floor until `miniflare` asks for the fix; `@randsum/roller` and `salvageunion-reference` pin one copy.
32. **Dead code** <a id="dead-code"></a>
    `bun run knip` with `includeEntryExports`; delete what it flags; `@public` and `@knipignore` are the only escape hatches.
33. **MCP servers** <a id="mcp"></a>
    `.mcp.json` is secret-free: `cloudflare-bindings`, `cloudflare-observability`, `sentry`, `convex` (local deployment), `context7`.
    Only `context7` and `convex` are enabled; opt into the OAuth three in `.claude/settings.local.json`. `claude mcp list` proves one works.
34. **Cloud sessions** <a id="cloud"></a>
    `gh` is REST only (GraphQL gets 403): use `gh api` or `mcp__github__*`; no route means report it unread.
    Merge: `gh api -X PUT repos/{owner}/{repo}/pulls/<n>/merge -f merge_method=squash` or `mcp__github__merge_pull_request`; no `gh stack`. Environment, `su-rules`: [cloud-environment.md](ops/cloud-environment.md).
35. **Cloudflare** <a id="cloudflare"></a>
    Workers `su-srd` (`salvageunion.io`), `su-itun` (route `/build`), `su-assets` (R2 `su-lp-assets`), `su-discord-bot`.
    The account is shared with RANDSUM; re-derive from `apps/*/wrangler.jsonc` and `wrangler deployments list`.
36. **Sentry** <a id="sentry"></a>
    Org `susrd`, EU region; projects `srd`, `itun`, `itun-convex` (a Convex dashboard toggle), `workers`.
    `tools/check-observability.ts` guards DSN gating and CSP; change an app's CSP or region in every source together.
37. **Convex and GitHub identifiers** <a id="identifiers"></a>
    Project `alex-jarvis:suref-itun`; `.convex.cloud` is the client, `.convex.site` HTTP actions (swapped, both read "unreachable").
    Repo `SalvageUnion-io/SU-SRD`, branch `main`; the deployed commit is the release (ADR-041).

## Decisions

ADRs are never deleted or renumbered: entry N is ADR-N. An entry that amends or supersedes another is named in that one.

1. **ADR-001 Local-first, no backend, no auth**
   Superseded by ADR-030, whose remaining Solo guarantee ADR-034 withdrew.
2. **ADR-002 IndexedDB via `idb`, Zod as the schema source**
   Amended by ADR-034, then superseded by [no device cache](#no-device-cache); Zod stays the schema source.
3. **ADR-003 Client state via Zustand**
   Superseded by ADR-030 and ADR-034, except that stores answer from memory.
4. **ADR-004 Snapshot sharing via Netlify Functions**
   Superseded by ADR-036.
5. **ADR-005 Game-data ORM**
   Accepted, amended: Zod is the one source of types, JSON Schema and validation; data loads lazily through a trusted `preload()`.
   Its output (`schemas/`, `lib/generated/`) is gitignored and rebuilt on install, typecheck, build and test: no `build:package` prerequisite.
6. **ADR-006 Rules logic as pure functions in `salvageunion-reference/rules`**
   Accepted: state in, result out, consumers persist. Randsum is the only dice source; the package binds no RNG.
7. **ADR-007 Automation boundary** · [full text](adr/007-automation-boundary.md)
   Accepted: automate bookkeeping (heat, EP / AP, uses, SP damage); never change a condition or destroy without the player.
8. **ADR-008 Sequential client-side mutations**
   Accepted: no atomic transaction or rollback; affordability is checked before an action runs.
9. **ADR-009 Item condition model**
   Accepted: intact → damaged → destroyed, cycled by the player through `StatusBadge`; read-only sheets render a plain badge.
10. **ADR-010 Choices in the shared display**
    Accepted: `ChoiceGroups` is uncontrolled in srd and controlled, persisted, in ITUN; `readOnly` renders static text.
11. **ADR-011 component-lib ships TypeScript source**
    Accepted: no build step; React is a peer; data-source agnostic, behaviour injected through slot props.
12. **ADR-012 srd as an Astro static site**
    Superseded by ADR-031, which keeps the static, no-backend, islands decision.
13. **ADR-013 CSP-compliant Zod**
    Accepted: every schema imports `z` from `packages/salvageunion-reference/lib/zod.ts` (`jitless: true`), never `zod`.
14. **ADR-014 The dataset's public interface is the JSON API**
    Accepted; npm publishing retired. Amended by ADR-040 (served verbatim) and ADR-043 (versioned API).
15. **ADR-015 The Dashboard is a distinct actual-play surface**
    Superseded by ADR-038, which restates what stands (separate surface, SRD display reuse, flat-and-inset, fixed canvas).
16. **ADR-016 Rotary Dial and instrument / reference split**
    Merged into ADR-015; superseded by ADR-038 (Major and Minor slots replace the Dial).
17. **ADR-017 Reuse the SRD display; instruments are bespoke**
    Merged into ADR-015; superseded by ADR-038 §7.
18. **ADR-018 Flat-and-inset instrument aesthetic**
    Merged into ADR-015; superseded by ADR-038 §8.
19. **ADR-019 Dashboard play state is ephemeral**
    Merged into ADR-015; superseded by ADR-038 (play state is a seat saved on the Game).
20. **ADR-020 Fixed 1280×800 scale-to-fit canvas**
    Merged into ADR-015; superseded by ADR-038 §9.
21. **ADR-021 ITUN surface taxonomy** · [full text](adr/021-itun-surface-taxonomy.md)
    Accepted, governing: a rule's enforcement depends on the surface's mode; the border is the lifecycle transaction.
    Wins over any earlier ADR; the live matrix is [surfaces](#surfaces).
22. **ADR-022 Change Log and stat overrides**
    Accepted, built: every write appends to a per-entity log; a cap override is an absolute pin, a zero-delta pin none.
    Amended by ADR-030 and ADR-034: the log is account data on Convex.
23. **ADR-023 Drone equipment hosts a loadout**
    Superseded by ADR-027, itself superseded by ADR-028.
24. **ADR-024 Derived per-app release changelogs**
    Superseded by ADR-041; amended by ADR-040.
25. **ADR-025 Versioned releases for `salvageunion-reference`**
    Superseded by ADR-040.
26. **ADR-026 Entity card design rules** · [full text](adr/026-entity-card-design-rules.md)
    Accepted: `ReferenceEntityCard` is the only entity renderer; app UI layers onto it, never replaces it.
    Stats have Normal and Compact modes, no pips; a modified stat wears a heavier solid ink frame.
27. **ADR-027 Partners are instances owned by a pilot or a mech**
    Superseded by ADR-028, which keeps its model. Supersedes ADR-023.
28. **ADR-028 A partner renders in place**
    Accepted: a partner is a `ReferenceEntityCard` on its host's sheet with instance state; no partner sheet or route.
    Supersedes ADR-027.
29. **ADR-029 Unified contribution model and stat provenance** · [full text](adr/029-contribution-model.md)
    Accepted, built: one source / op / target model (`packages/salvageunion-reference/lib/rules/contributions.ts`).
    Derivations return parts, so provenance shows wherever a value does; duration effects are never persisted.
30. **ADR-030 Accounts, Games, and a server of record** · [full text](adr/030-accounts-games-server-of-record.md)
    Accepted, governing: Discord-only accounts; Convex of record; Games and Shelves; roles; cross-player writes by proposal.
    Amends ADR-022; supersedes ADR-001. Amended by ADR-032, ADR-034, ADR-037 and ADR-039.
31. **ADR-031 srd builds on an in-house Vite SSG**
    Accepted; supersedes ADR-012. Registered routes, `renderToStaticMarkup`, React islands; contract `apps/srd/ssg/DESIGN.md`.
32. **ADR-032 Public, read-only sheets** · [full text](adr/032-public-read-only-sheets.md)
    Accepted: opt-in `publicRead` per entity; the owner decides, the table runner for a crawler.
    Amends ADR-030's visibility rule; amended by ADR-036.
33. **ADR-033 Hosting on Cloudflare** · [full text](adr/033-hosting-on-cloudflare.md)
    Accepted, delivered: Workers (Static Assets, R2) serve every site; Actions builds, `wrangler` deploys. Amended by ADR-047, ADR-048.
34. **ADR-034 Persistence requires an account; the local store is a cache**
    Accepted: signed out is read-only, every record is Convex-backed, both apps are PWAs; the pre-account migration is gone.
    Supersedes ADR-030's Solo guarantee; amends ADR-002 and ADR-022. [No device cache](#no-device-cache) followed.
35. **ADR-035 No isolated local-only data**
    Partly superseded, amended: anonymous visitors get the `signedOut` backend; no legacy claim.
36. **ADR-036 Retire snapshot shares**
    Accepted: the public sheet is the only account-free share; no `/api/snapshots`.
    Supersedes ADR-004; amends ADR-032.
37. **ADR-037 The assignment model**
    Accepted: one-hop links `mech-to-pilot`, `pilot-to-crawler`, `mech-to-crawler`; a new link replaces conflicts; one container.
    Amends ADR-030; amended by ADR-044. Code: `packages/itun-domain/src/links/linkRules.ts`.
38. **ADR-038 The Dashboard is a Game surface with shared play state** · [full text](adr/038-dashboard-game-surface.md)
    Accepted, built: Game-only with a Mediator; a seat on the Game; Major / Minor slots; fixed 1280×800 canvas.
    Supersedes ADR-015; amended by ADR-045. As built: [dashboard.md](architecture/dashboard.md).
39. **ADR-039 Addressed invites by Discord account** · [full text](adr/039-addressed-invites.md)
    Retired with `/su invite`: a Game joins only through its one invite URL (ADR-030), and an addressed row opens nothing.
    Amended ADR-030's invite rules (`apps/itun/convex/model/invites.ts`).
40. **ADR-040 The dataset is served verbatim with no release stream**
    Accepted, built: `/schema/*` serves the files byte for byte; `$id` is the served URL; version `0.0.0`.
    Supersedes ADR-025; amends ADR-014 and ADR-024; amended by ADR-043.
41. **ADR-041 The deployed commit is the release**
    Accepted, built: no app versions; one changelog (srd's, ITUN links it): `main`'s first-parent history by scope.
    Supersedes ADR-024.
42. **ADR-042 Mid-tab updates**
    Accepted, built: `apps/itun/convex/buildFloor.ts` is raised by hand only for a change that breaks an open tab.
    The `client-contract` gate catches argument breaks; anything else is a soft update.
43. **ADR-043 The dataset is a versioned public contract at `api.salvageunion.io`**
    Accepted, not built: a static `/v1` tree emitted from the committed files; no query Worker.
    Amends ADR-014, ADR-040; decision 1 superseded by ADR-047.
44. **ADR-044 Built NPCs and the `npc-to-crawler` link**
    Accepted, built: an `npcs` table like pilots; a slotted link authorised by the crawler's writer.
    Amends ADR-037. As built: [npc-builder.md](architecture/npc-builder.md).
45. **ADR-045 The Dashboard has a phone form** · [full text](adr/045-dashboard-phone-form.md)
    Accepted, built: below a 0.62 canvas scale the Dashboard renders a phone form over the same seat, models and enforcement.
    Amends ADR-038.
46. **ADR-046 Styling is tokens, style objects and one stylesheet**
    Accepted, built: `theme.css` tokens, `tokens.ts` objects, `index.css` classes, also for styles repeated per page; `no-tailwind` bars Tailwind.
47. **ADR-047 One salvageunion.io edge Worker**
    Accepted, not built: `su-srd` serves `api.salvageunion.io` too, from one `dist/`; `assets.` stays apart.
    Supersedes ADR-043 decision 1; amends ADR-033.
48. **ADR-048 ITUN at salvageunion.io/build**
    Accepted, built: a route ahead of srd; the old host 301s. Amends ADR-033.

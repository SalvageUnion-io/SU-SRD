# Architecture

What is true now; cite an Area by its anchor (`#ci`).
ADRs cited by § keep their full text in [`docs/adr/`](adr/).
**Names:** one app, `apps/web` (ADR-050); areas `src/reference/`, `src/build/` (**Training Bay**), `src/play/` (**The Cantina**).

## Areas

1. **Packages** <a id="packages"></a>
   `salvageunion-reference` → every app; `game-domain` → `apps/web` / bot / `convex/`; `gates` → `tools/`, app e2e.
   Packages never import an app (`noRestrictedImports`); deps use `workspace:*`.
2. **salvageunion-reference** <a id="reference"></a>
   Private, no build, no version. Zod in `lib/schemas/` generates JSON Schema and `Ref*` types, gitignored and rebuilt on install, typecheck, build and test (its `ref-generate` bin).
   Exports `.`, `./rules`, `./zod`, `./testing`, `./proseDeviations`, `./assetDerivatives`, `./data/*`, `./schemas/*`; `lib/index.ts` is an explicit barrel; refs are `schemaId::entityId`.
3. **Lazy loading** <a id="lazy-loading"></a>
   Call `preload()` before any accessor; a module-scope ORM call fails Biome (`noModuleScopeReferenceCall.grit`).
   Tests preload `salvageunion-reference/tools/testPreload.ts` from each `bunfig.toml`, never `preload('all')` per file.
4. **UI library** <a id="ui-library"></a>
   `apps/web/src/components/index.ts` barrel; tokens in `apps/web/src/styles/theme.css`, mirrored by `apps/web/src/design/tokens.ts`. Only the areas and `shared/` wire stores or Convex; the library imports no area.
   Unused exports: [knip](#dead-code).
5. **Stylesheet wiring** <a id="stylesheets"></a>
   One entry, `apps/web/src/styles/entry.css` (tokens, `layer(su-reset)`, `layer(su-base)`), imported by both render modes.
   App stylesheets stay unlayered, so they win; rules: `.claude/rules/styling.md`.
6. **Static pages (SSG)** <a id="ssg"></a>
   In-house Vite SSG with React islands ([DESIGN.md](../apps/web/ssg/DESIGN.md)); routes and endpoints are registered, never discovered.
   No `.css` import reachable from SSR (CSS enters via `src/runtime/styles.entry.ts`); no auth, router or Zustand.
7. **Dataset API** <a id="dataset-api"></a>
   srd serves the package's `data/` and generated `schemas/` verbatim at `/schema/*` (`apps/web/src/lib/referenceFiles.ts`), CORS on.
   Each schema's `$id` is the URL it is served at; `api.salvageunion.io/v1` is decided, not built (ADR-043, ADR-047).
8. **discord-bot** <a id="discord-bot"></a>
   A Worker answering HTTP interactions (no gateway, no `discord.js`); conventions in [its CLAUDE.md](../apps/discord-bot/CLAUDE.md).
   Imports `game-domain` (botWire, schemas) as types only; changing them is cross-package. Lookup = embed: `discordEntryCard`.
9. **game-domain** <a id="game-domain"></a>
   Zod schemas, roles, link/crew/downtime rules and bot wire types for the app, Convex and the bot; import by subpath.
   Rules: pure → reference `lib/rules`; shared → here; client → `src/lib/rules`; `check rules-home` bars Convex→`src/`.
10. **Data flow and connection modes** <a id="data-flow"></a>
    Records store slug refs, resolved at render; the app preloads once in `GameDataReady.tsx`.
    `resolveConnectionMode()`: Solo (signed out, read-only), Connected (Convex), Disconnected (on-screen rows, writes blocked).
11. **Convex, the server of record** <a id="convex"></a>
    `apps/web/convex/`: opaque bodies (`v.any()`), Zod-parsed per mutation; an entity is [in a Game or on a Shelf](architecture/glossary.md).
    Every store commits through a `commit*` in `src/stores/`; `containerParity.test.ts` asserts each has a table.
12. **No device cache** <a id="no-device-cache"></a>
    No IndexedDB: an offline reload boots the SW shell, signed out and empty. The PWA stays installable; `e2e/app-offline.e2e.ts` pins both.
13. **Zustand stores** <a id="stores"></a>
    `src/stores/` hold rows in memory, filled by `ShelfSync`; `update()` validates, awaits Convex, then logs; a refused write changes nothing.
    No TanStack Query; reads: `src/lib/entities/`, `convex/react`. Shared state: a store; context: what varies by placement.
14. **Sharing** <a id="sharing"></a>
    The one account-free share is the public sheet `/p/:kind/:appId`, opt-in via the `publicRead` column (ADR-032).
15. **Convex deployments** <a id="deployments"></a>
    Production `exuberant-porpoise-183`; staging `perfect-donkey-72`, previews only.
    `bun run dev` runs a local deployment with test auth; setup, rotations and repairs are the `convex-ops` skill.
16. **Convex environment** <a id="convex-env"></a>
    Sign-in: `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`; bot: `BOT_SECRET`, `BOT_URL` (Play's posts).
    `TEST_AUTH` never in production; `convex env list` prints values: pipe it through `cut -d= -f1`.
17. **Convex conventions** <a id="convex-conventions"></a>
    Mutations use `mutation` / `internalMutation` from `convex/model/entities.ts` (its triggers keep `games.summary`).
    Tell refusals from defects with `src/lib/connection/serverError.ts`; a one-off repair runs once from the dashboard, then is deleted.
18. **Surfaces and enforcement (ADR-021)** <a id="surfaces"></a>
    Guided Creation (Wizard), Free Edit (Live Sheet), Guided Play and Adjudicate (Play), Frozen (`/p/`).
    Lifecycle transactions are enforced in guided modes and bypassed in Free Edit; caps are overridable with a callout.
19. **Live-Sheet transactions** <a id="live-sheet"></a>
    A closed list: crawler Upkeep / Upgrade / Trade, bay Repair, item repair and uses; advisory, never blocking.
    Any new transaction goes in Play.
20. **Change Log** <a id="change-log"></a>
    Every write appends a `transaction` / `override` / `manual` row to Convex `changeLog` at `entityStore.update`.
    Read in `ChangeLogDrawer`; destruction waits for the player (ADR-007).
21. **Combat loop** <a id="combat"></a>
    A shared living sheet: no combat RPCs, turns or undo; the math is the reference package's `lib/rules/`, patches are the app's.
    Activation is a sequential write-through (ADR-008); item conditions change only by player action (ADR-009).
22. **Display system** <a id="display"></a>
    Entity forms (Mention, Mini, Compact, index Compact, Peek; [EDL](design-system/entity-display-language.md)) come from `toEntityModel`; contentful forms and Page are `ReferenceEntityCard`.
    `Box` is every other frame, never merged with it; app UI goes through `controls` and slot props, never schema props.
23. **Discord bot as a Game client** <a id="bot-game-client"></a>
    Game commands call `POST /bot/<op>` (`convex/botHttp.ts`) with `BOT_SECRET`.
    Writes only channel bindings; Convex unreachable: every Game command answers `unavailable`. Each interaction logs its command.
24. **SEO** <a id="seo"></a>
    One site name (`pageTitle`), one WebSite JSON-LD (`WEBSITE`), one sitemap; heads: `BaseLayout.tsx`; shared sheets: ADR-032; `/llms.txt` exact; SW: `src/pwa.ts`.
    No-JS fallback: `StaticEntityContent`, replaced by islands mounted with `createRoot`; an `<Island hydrate>` whose server markup is its own first render adopts it with `hydrateRoot`.
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
    `deploy-cloudflare.yml` on `main` push: plan → build → `push-convex` → deploy → smoke → record (tag `deployed/cloudflare`).
    `tools/deploy-surfaces.ts` picks what ships and fails safe to everything; a dispatched `sha` rolls back. srd's OG images build at deploy; the bot leg registers its slash commands.
29. **Preview deploys** <a id="previews"></a>
    A PR into `main` or a `su-io-*` release branch labelled `preview` gets a su-srd Preview `pr-<n>` (the app on staging Convex) per push, linked in a comment, deleted on close.
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
    `.mcp.json` is secret-free: `cloudflare-bindings`, `cloudflare-observability`, `convex` (local deployment), `context7`.
    Only `context7` and `convex` are enabled; opt into the OAuth two in `.claude/settings.local.json`. `claude mcp list` proves one works.
34. **Cloud sessions** <a id="cloud"></a>
    `gh` is REST only (GraphQL gets 403): use `gh api` or `mcp__github__*`; no route means report it unread.
    Merge: `gh api -X PUT repos/{owner}/{repo}/pulls/<n>/merge -f merge_method=squash` or `mcp__github__merge_pull_request`; no `gh stack`. Environment, `su-rules`: [cloud-environment.md](ops/cloud-environment.md).
35. **Cloudflare** <a id="cloudflare"></a>
    Workers `su-srd` (`salvageunion.io`, `/build`), `su-assets` (R2 `su-lp-assets`), `su-discord-bot`.
    The account is shared with RANDSUM; re-derive from `apps/*/wrangler.jsonc`, `wrangler deployments list`.
36. **Error tracking** <a id="errors"></a>
    Workers Issues (ADR-049); browsers post to `/__errors`, Convex's log stream to `/__convex-logs`.
    `tools/check-observability.ts` guards it.
37. **Convex and GitHub identifiers** <a id="identifiers"></a>
    Project `alex-jarvis:susrd`; `.convex.cloud` is the client, `.convex.site` HTTP actions (swapped, both "unreachable").
    Repo `SalvageUnion-io/SU-SRD`, branch `main`; the deployed commit is the release (ADR-041).

## Decisions

ADRs are never renumbered: entry N is ADR-N.
Retired (text in git): ADR-001, ADR-002, ADR-003, ADR-004, ADR-012, ADR-015, ADR-016, ADR-017, ADR-018, ADR-019, ADR-020, ADR-023, ADR-024, ADR-025, ADR-027, ADR-035, ADR-039.

5. **ADR-005 Game-data ORM**
   Zod is the one source of types, JSON Schema and validation; data loads lazily through a trusted `preload()`.
   Its output (`schemas/`, `lib/generated/`) is gitignored and rebuilt on install, typecheck, build and test.
6. **ADR-006 Rules logic as pure functions in `salvageunion-reference/rules`**
   State in, result out, consumers persist. Randsum is the only dice source; the package binds no RNG.
7. **ADR-007 Automation boundary** · [full text](adr/007-automation-boundary.md)
   Automate bookkeeping (heat, EP / AP, uses, SP damage); never change a condition or destroy without the player.
8. **ADR-008 Sequential client-side mutations**
   No atomic transaction or rollback; affordability is checked before an action runs.
9. **ADR-009 Item condition model**
   Intact → damaged → destroyed, cycled by the player through `StatusBadge`; read-only sheets render a plain badge.
10. **ADR-010 Choices in the shared display**
    `ChoiceGroups` is uncontrolled on reference pages and controlled, persisted, in the app; `readOnly` renders static text.
11. **ADR-011 The UI library ships TypeScript source**
    No build step; data-source agnostic, behaviour injected through slot props. Amended by ADR-050 (now `src/components`).
13. **ADR-013 CSP-compliant Zod**
    Every schema imports `z` from `packages/salvageunion-reference/lib/zod.ts` (`jitless: true`), never `zod`.
14. **ADR-014 The dataset's public interface is the JSON API**
    No npm publishing. Amended by ADR-040 (served verbatim) and ADR-043 (versioned API).
21. **ADR-021 App surface taxonomy** · [full text](adr/021-cantina-surface-taxonomy.md)
    Governing: a rule's enforcement depends on the surface's mode; the border is the lifecycle transaction.
    Wins over any earlier ADR; the live matrix is [surfaces](#surfaces). Amended by ADR-051.
22. **ADR-022 Change Log and stat overrides**
    Every write appends to a per-entity log; a cap override is an absolute pin, a zero-delta pin none.
    Amended by ADR-030 and ADR-034: the log is account data on Convex.
26. **ADR-026 Entity card design rules** · [full text](adr/026-entity-card-design-rules.md)
    `ReferenceEntityCard` is the only entity card and Page; app UI layers onto it. Stats have no pips; a modified stat wears a heavier ink frame.
28. **ADR-028 A partner renders in place**
    A partner is a `ReferenceEntityCard` on its host's sheet with instance state; no partner sheet or route.
29. **ADR-029 Unified contribution model and stat provenance** · [full text](adr/029-contribution-model.md)
    One source / op / target model; derivations return parts, so provenance shows wherever a value does; duration effects are never persisted.
    §4 amended by ADR-038.
30. **ADR-030 Accounts, Games, and a server of record** · [full text](adr/030-accounts-games-server-of-record.md)
    Governing: Discord-only accounts; Convex of record; Games and Shelves; roles; cross-player writes by proposal. Amends ADR-022.
    Amended by ADR-032, ADR-034, ADR-037, ADR-038, ADR-051, ADR-052 and ADR-055.
31. **ADR-031 Reference pages build on an in-house Vite SSG**
    Registered routes, `renderToStaticMarkup`, React islands; contract `apps/web/ssg/DESIGN.md`. Amended by ADR-050.
32. **ADR-032 Public, read-only sheets** · [full text](adr/032-public-read-only-sheets.md)
    Opt-in `publicRead` per entity; the owner decides, the table runner for a Game's crawler.
    Amends ADR-030's visibility rule; amended by ADR-036, ADR-056.
33. **ADR-033 Hosting on Cloudflare** · [full text](adr/033-hosting-on-cloudflare.md)
    Workers (Static Assets, R2) serve everything; Actions builds, `wrangler` deploys. Amended by ADR-047, ADR-048, ADR-050.
34. **ADR-034 Persistence requires an account**
    Signed out is read-only, every record is Convex-backed, the app is a PWA; then [no device cache](#no-device-cache).
    Amends ADR-022 and ADR-030.
36. **ADR-036 Retire snapshot shares**
    The public sheet is the only account-free share; no `/api/snapshots`. Amends ADR-032.
37. **ADR-037 The assignment model**
    One-hop links `mech-to-pilot`, `pilot-to-crawler`, `mech-to-crawler`; a new link replaces conflicts; one container.
    Amends ADR-030; amended by ADR-044. Code: `packages/game-domain/src/links/linkRules.ts`.
38. **ADR-038 The Dashboard is a Game surface with shared play state** · [full text](adr/038-dashboard-game-surface.md)
    Built; ADR-051 keeps its seat and 1280×800 canvas, replacing Game-only and the slots. As built: [play.md](architecture/play.md).
    Amends ADR-029 §4, ADR-030 §5–6 and ADR-034; amended by ADR-045, ADR-051.
40. **ADR-040 The dataset is served verbatim with no release stream**
    `/schema/*` serves the files byte for byte; `$id` is the served URL; version `0.0.0`. Amends ADR-014; amended by ADR-043.
41. **ADR-041 The deployed commit is the release**
    No app versions; one changelog, `/changelog`: `main`'s first-parent history by scope.
42. **ADR-042 Mid-tab updates**
    `convex/buildFloor.ts` is raised by hand only for a change that breaks an open tab.
    The `client-contract` gate catches argument breaks; anything else is a soft update.
43. **ADR-043 The dataset is a versioned public contract at `api.salvageunion.io`**
    Not built: a static `/v1` tree emitted from the committed files; no query Worker.
    Amends ADR-014, ADR-040; decision 1 superseded by ADR-047.
44. **ADR-044 Built NPCs and the `npc-to-crawler` link**
    Built: an `npcs` table like pilots; a slotted link authorised by the crawler's writer.
    Amends ADR-037. As built: [npc-builder.md](architecture/npc-builder.md).
45. **ADR-045 The Dashboard has a phone form** · [full text](adr/045-dashboard-phone-form.md)
    Built: under its 1280×800 canvas Play renders a phone form; same seat and enforcement.
    Amends ADR-038; ADR-051 replaces decisions 3–5.
46. **ADR-046 Styling is tokens, style objects and one stylesheet**
    `theme.css` tokens, `tokens.ts` objects, `index.css` classes, also for styles repeated per page; `no-tailwind` bars Tailwind.
47. **ADR-047 One salvageunion.io edge Worker**
    Not built: `su-srd` serves `api.salvageunion.io` too, from one `dist/`; `assets.` stays apart.
    Supersedes ADR-043 decision 1; amends ADR-033.
48. **ADR-048 The app at salvageunion.io/build**
    `su-srd` serves `/build`; the old host 301s by zone rule. Amends ADR-033; amended by ADR-050.
49. **ADR-049 Workers Issues, not Sentry**
    No SDK; browsers and Convex report via the Workers; browser stacks minified.
50. **ADR-050 One app** · [full text](adr/050-one-app.md)
    `apps/web` is one app: the pre-rendered reference and the client app at `/build/`; one source tree, Vite pass, Worker, CSP, head, install and changelog.
    Amends ADR-011, ADR-031, ADR-033 and ADR-048.
51. **ADR-051 Play mode, a Cockpit** · [full text](adr/051-play-mode.md)
    Built: Play beside Reference and Build; Units | Actions | Crew, Tables, Feed; solo seats.
    Supersedes ADR-038 §1 and its layout; amends ADR-030, ADR-045; amended by ADR-052. As built: [play.md](architecture/play.md).
52. **ADR-052 Build owns your assets, Play owns Games** · [full text](adr/052-build-assets-play-games.md)
    Built: Build lists all you own, a Game a chip; Play has the hub, Game pages, invites, Cockpits.
    Amends ADR-030 §6, ADR-051 §1.
53. **ADR-053 Canon as gates**
    Every law in `docs/design-system/` names the gate that holds it (`CANON`, `bun run check canon`); a law lands with its gate or is cut.
    hard-rules.md says each law as its gate checks it; the gates' workings live in the gates.
54. **ADR-054 One message catalogue** · [full text](adr/054-message-catalogue.md)
    Built: UI words are keys in `apps/web/src/messages/`, values as `{name}`; English only; the `ui-strings` gate ratchets the rest.
55. **ADR-055 Crew assets are assigned, never claimed** · [full text](adr/055-crew-assets-assign.md)
    Built: in a Game the assigned member edits, the crew reads, the table runner reassigns; Game reads answer empty to ex-members.
    Amends ADR-030 §2, §4–6.
56. **ADR-056 Homebrew on the SRD** · [full text](adr/056-homebrew.md)
    Built: link-shared patterns at `/homebrew/` and behind a chassis page's "Show Homebrew", via the Worker; readers report, an admin hides.
    Amends ADR-032; narrows ADR-021 and ADR-030 on homebrew.

# Architecture

What is true now: one entry each, a headline and at most two lines (`bun run check doc-drift` holds the shape).
The ADRs code cites by § keep their full text in [`docs/adr/`](adr/), linked from their entries; the rest of
the pre-collapse text is `git show 62d5afa:docs/ARCHITECTURE.md`.

## Areas

1. **Packages**
   `salvageunion-reference` → `component-lib` → `srd` / `itun`; `discord-bot` uses the reference package only.
   Packages never import an app (`noRestrictedImports` in [`biome.jsonc`](../biome.jsonc)); deps use `workspace:*`.
2. **salvageunion-reference**
   Private, no build, no version. Zod in `lib/schemas/` generates JSON Schema and `SURef*` types, gitignored and rebuilt on install, typecheck, build and test (`ensureGenerated.ts`).
   Exports `.`, `./rules`, `./zod`, `./testing`; `lib/index.ts` is an explicit barrel; refs are `schemaId::entityId`.
3. **Lazy loading**
   Call `preload()` before any accessor; a module-scope ORM call fails Biome (`tools/biome/noModuleScopeReferenceCall.grit`).
   Tests preload through `test/reference-preload.ts` in each workspace's `bunfig.toml`, never `preload('all')` per file.
4. **component-lib**
   TypeScript source, no build; `src/index.ts` barrel; tokens in `src/styles/theme.css`, mirrored by `src/design/tokens.ts`.
   A composition one app renders lives in that app; `bun run check barrel-consumers` enforces both halves.
5. **Tailwind wiring**
   One entry, `packages/component-lib/src/styles/tailwind.css` (`@source '..'`, `layer(su-base)`), imported by both apps.
   Styling is migrating off Tailwind: [tailwind-removal.md](design-system/tailwind-removal.md).
6. **srd build**
   In-house Vite SSG with React islands ([DESIGN.md](../apps/srd/ssg/DESIGN.md)); routes and endpoints are registered, never discovered.
   No `.css` import reachable from SSR (CSS enters via `src/runtime/styles.entry.ts`); no auth, router or Zustand.
7. **Dataset API**
   srd serves the package's committed `data/` and `schemas/` verbatim at `/schema/*` (`apps/srd/src/lib/referenceFiles.ts`), CORS on.
   Each schema's `$id` is the URL it is served at; `api.salvageunion.io/v1` is decided, not built (ADR-043).
8. **discord-bot**
   A Worker answering HTTP interactions (no gateway, no `discord.js`); conventions in [its CLAUDE.md](../apps/discord-bot/CLAUDE.md).
   Imports `apps/itun/convex/model/botWire.ts` as a type only: changing it is a cross-package change.
9. **Data flow and connection modes**
   Records store slug refs, resolved at render; ITUN preloads once in `GameDataReady.tsx`.
   `resolveConnectionMode()`: Solo (signed out, read-only), Connected (Convex), Disconnected (on-screen rows, writes blocked).
10. **Convex, the server of record**
    `apps/itun/convex/`: bodies are opaque (`v.any()`), Zod parses before every mutation; an entity is in a Game or on a Shelf.
    Every store commits through a `commit*` in `apps/itun/src/stores/`; `containerParity.test.ts` asserts each has a table.
11. **No device cache** (D9, [spike](spikes/d9-offline-cache.md))
    No IndexedDB: an offline reload boots the SW shell, signed out and empty. The PWA stays installable.
12. **Zustand stores**
    `apps/itun/src/stores/` hold rows in memory, filled by `ShelfSync`; `update()` validates, awaits Convex, then logs.
    A refused write changes nothing; no TanStack Query, reads are `src/hooks/entities/` and `convex/react`.
13. **Sharing**
    The one account-free share is the public sheet `/p/:kind/:appId`, opt-in via the `publicRead` column (ADR-032).
    Snapshots are retired (ADR-036).
14. **Convex deployments**
    Production `exuberant-porpoise-183` (frontend `https://intheunionnow.com`); staging `perfect-donkey-72`, the preview slot only.
    `bun run dev:itun` runs a local deployment with test auth; setup, rotations and repairs are the `convex-ops` skill.
15. **Convex environment**
    Sign-in: `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`; bot: `ITUN_BOT_SECRET`, `DISCORD_PUBLIC_KEY`.
    `ITUN_TEST_AUTH` never in production; `convex env list` prints values, so pipe it through `cut -d= -f1`.
16. **Convex conventions**
    Mutations use `mutation` / `internalMutation` from `apps/itun/convex/model/entities.ts` (its triggers keep `games.summary`).
    Tell refusals from defects with `src/lib/connection/serverError.ts`; a one-off repair runs once from the dashboard, then is deleted.
17. **Surfaces and enforcement (ADR-021)**
    Guided Creation (Wizard), Free Edit (Live Sheet), Guided Play (Dashboard), Frozen (`/p/`), Adjudicate (Mediator Dashboard).
    Lifecycle transactions are enforced in guided modes and bypassed in Free Edit; caps are overridable with a callout.
18. **Live-Sheet transactions**
    A closed list: crawler Upkeep / Upgrade / Trade, bay Repair, item repair and uses; advisory, never blocking.
    Any new transaction goes on the Dashboard.
19. **Change Log**
    Every write appends a `transaction` / `override` / `manual` row to Convex `changeLog` at `entityStore.update`.
    Read in `ChangeLogDrawer`; destruction waits for the player (ADR-007).
20. **Combat loop**
    A shared living sheet: no combat RPCs, turns or undo; the math is the reference package's `lib/rules/`, patches are the app's.
    Activation is a sequential write-through (ADR-008); item conditions change only by player action (ADR-009).
21. **Display system**
    Entity forms (Mention, Token, Row, Peek; [EDL](design-system/entity-display-language.md)) come from `toEntityModel`; Card and Page are `ReferenceEntityCard`.
    `Card` is the generic container, never merged with it; app UI goes through `controls` and slot props, never schema props.
22. **Component catalog**
    `bun run stories` (port 61000) serves component-lib's `catalog.tsx` over the library's and both apps' stories.
    Story rules: [component-lib's CLAUDE.md](../packages/component-lib/CLAUDE.md), enforced by `story-coverage.test.ts`.
23. **Discord bot as a Game client**
    `/su` commands call `POST /bot/<op>` (`apps/itun/convex/botHttp.ts`) with `ITUN_BOT_SECRET`; `/su invite` is Discord-signed.
    Reads widely, writes only existing mutations; Convex unreachable means every Game command answers `unavailable`.
24. **SEO**
    srd's head is `BaseLayout.tsx` from `DocumentMeta`; JSON-LD, `ssg/sitemap.ts`, `/llms.txt` (byte for byte), PWA via `ssg/pwa.ts`.
    No-JS fallback: `StaticEntityContent`, replaced by islands mounted with `createRoot` (no hydration).
25. **Accessibility**
    Biome's a11y rules plus each app's `e2e/a11y.e2e.ts` (axe, WCAG 2.2 AA) over its `PAGES`, failing on any violation.
    Contrast is held by `design/contrast.test.ts`; coarse-pointer touch targets are 44px.
26. **CI**
    `ci.yml` runs on every `pull_request` (no branch filter), path-filtered per app; `CI Success` must need every job.
    Static checks are `bun tools/check.ts --profile=ci`; tests are `bun run test:coverage` against per-workspace `FLOORS`.
27. **Repository settings**
    `main` ruleset (`MAIN_RULESET` in `tools/environments.ts`): linear history, strict `CI Success` + PR-title checks, CodeQL.
    Actions are allowlisted and SHA-pinned; both drift-checked nightly; no merge queue.
28. **Deploy**
    `deploy-cloudflare.yml` on push to `main`: plan → build → `push-convex` → deploy → smoke → record (tag `deployed/cloudflare`).
    `tools/deploy-surfaces.ts` picks what ships and fails safe to everything; a dispatched `sha` rolls back.
29. **Preview deploys**
    `gh workflow run deploy-preview.yml --ref <branch>` → `preview-su-srd` / `preview-su-itun.alxjrvs.workers.dev` on staging Convex.
    The owner approves the `preview` Environment; staging data persists across branches.
30. **Dependencies**
    Dependabot updates Actions only; Bun deps by hand, pinned exactly, with a 3-day `bunfig.toml` cooldown.
    Declare every import; a shared runtime package is a root `catalog:` entry, a shared dev tool a root devDependency.
31. **Audit and overrides**
    `bun run audit` fails any advisory (PRs touching manifests, and nightly); it ignores nothing.
    `overrides` are floors only, deleted once the dependent asks for the fixed version itself (`sharp`, until `miniflare` does).
32. **Dead code**
    `bun run knip` with `includeEntryExports`; delete what it flags; `@public` and `@knipignore` are the only escape hatches.
33. **MCP servers**
    `.mcp.json` is secret-free: `cloudflare-bindings`, `cloudflare-observability`, `sentry`, `convex` (local deployment), `context7`.
    Only `context7` and `convex` are enabled; opt into the OAuth three in `.claude/settings.local.json`. `claude mcp list` proves one works.
34. **Cloud sessions**
    `gh` is REST only (GraphQL gets 403): use `gh api` or `mcp__github__*`; no route means report it unread.
    Merge: `gh api -X PUT repos/{owner}/{repo}/pulls/<n>/merge -f merge_method=squash` or `mcp__github__merge_pull_request`; no `gh stack`. Environment, `su-rules`: [cloud-environment.md](ops/cloud-environment.md).
35. **Cloudflare**
    Workers `su-srd` (`salvageunion.io`), `su-itun` (`intheunionnow.com`), `su-assets` (R2 `su-lp-assets`), `su-discord-bot`.
    The account is shared with RANDSUM; re-derive from `apps/*/wrangler.jsonc` and `wrangler deployments list`.
36. **Sentry**
    Org `susrd`, EU region; projects `srd`, `itun`, `itun-convex` (a Convex dashboard toggle), `workers`.
    `tools/check-observability.ts` guards DSN gating and CSP; change an app's CSP or region in every source together.
37. **Convex and GitHub identifiers**
    Project `alex-jarvis:suref-itun`; `.convex.cloud` is the client, `.convex.site` HTTP actions (swapped, both read "unreachable").
    Repo `SalvageUnion-io/SU-SRD`, branch `main`; the deployed commit is the release (ADR-041).

## Decisions

ADRs are never deleted or renumbered: entry N is ADR-N. An entry that amends or supersedes another is named in that one.

1. **ADR-001 Local-first, no backend, no auth**
   Superseded by ADR-030, whose remaining Solo guarantee ADR-034 withdrew.
2. **ADR-002 IndexedDB via `idb`, Zod as the schema source**
   Amended by ADR-034, then superseded by D9 (no IndexedDB); Zod stays the schema source.
3. **ADR-003 Client state via Zustand**
   Superseded by ADR-030 and ADR-034, except that stores answer from memory.
4. **ADR-004 Snapshot sharing via Netlify Functions**
   Superseded by ADR-036.
5. **ADR-005 Game-data ORM**
   Accepted (amended 2026-10): Zod is the one source of types, JSON Schema and validation; data loads lazily through a trusted `preload()`.
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
    Wins over any earlier ADR; the live matrix is Areas 17.
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
    Accepted, delivered: every hostname is a Worker (Static Assets, R2); builds run in Actions, deploys use `wrangler`.
    Its snapshot store is history (ADR-036); cutover phases cited in code are in git.
34. **ADR-034 Persistence requires an account; the local store is a cache**
    Accepted: signed out is read-only, every record is Convex-backed, both apps are PWAs; the pre-account migration is gone.
    Supersedes ADR-030's Solo guarantee; amends ADR-002 and ADR-022. D9 removed the cache.
35. **ADR-035 No isolated local-only data**
    Partly superseded by its own 2026-10-08 amendment: anonymous visitors get the `signedOut` backend; the legacy claim is retired.
36. **ADR-036 Retire snapshot shares**
    Accepted: the public sheet is the only account-free share; no `/api/snapshots` endpoint exists.
    Supersedes ADR-004; amends ADR-032.
37. **ADR-037 The assignment model**
    Accepted: one-hop links `mech-to-pilot`, `pilot-to-crawler`, `mech-to-crawler`; a new link replaces conflicts; one container.
    Amends ADR-030; amended by ADR-044. Code: `apps/itun/src/lib/links/linkRules.ts`.
38. **ADR-038 The Dashboard is a Game surface with shared play state** · [full text](adr/038-dashboard-game-surface.md)
    Accepted, built: Game-only with a Mediator; a seat on the Game; Major / Minor slots; fixed 1280×800 canvas.
    Supersedes ADR-015; amended by ADR-045. As built: [dashboard.md](architecture/dashboard.md).
39. **ADR-039 Addressed invites by Discord account** · [full text](adr/039-addressed-invites.md)
    Accepted: an invite may carry `invites.target`; `/su invite` is Discord-signed; both doors mint through `mintInvite`.
    Amends ADR-030's invite rules (`apps/itun/convex/model/invites.ts`).
40. **ADR-040 The dataset is served verbatim with no release stream**
    Accepted, built: `/schema/*` serves the committed files byte for byte; `$id` is the served URL; version `0.0.0`.
    Supersedes ADR-025; amends ADR-014 and ADR-024; amended by ADR-043.
41. **ADR-041 The deployed commit is the release**
    Accepted, built: no app versions; each site's changelog is `main`'s first-parent history filtered by scope.
    Supersedes ADR-024.
42. **ADR-042 Mid-tab updates**
    Accepted, built: `apps/itun/convex/buildFloor.ts` is raised by hand only for a change that breaks an open tab.
    The `client-contract` gate catches argument breaks; anything else is a soft update.
43. **ADR-043 The dataset is a versioned public contract at `api.salvageunion.io`**
    Accepted, not built: a static `/v1` Worker emitted from the committed files; no query Worker.
    Amends ADR-014; amends ADR-040.
44. **ADR-044 Built NPCs and the `npc-to-crawler` link**
    Proposed, built on this branch: an `npcs` table like pilots; a slotted link authorised by the crawler's writer.
    Amends ADR-037. As built: [npc-builder.md](architecture/npc-builder.md).
45. **ADR-045 The Dashboard has a phone form** · [full text](adr/045-dashboard-phone-form.md)
    Proposed: below a 0.62 canvas scale the Dashboard renders a phone form over the same seat, models and enforcement.
    Amends ADR-038.
46. **ADR-046 Styling is tokens, style objects and one stylesheet**
    Accepted: `theme.css` tokens, `tokens.ts` style objects, `index.css` `.su-*` classes; Tailwind is removed by TW7.
    Plan and phases: [tailwind-removal.md](design-system/tailwind-removal.md).

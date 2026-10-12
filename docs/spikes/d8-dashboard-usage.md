# D8 spike — is the Dashboard and Mediator Dashboard use worth the next styling phase?

**Status:** decided 2026-10-12. **The owner is keeping both the Dashboard
and the Mediator Dashboard for now.** Tailwind-removal P5 stays on the plan,
and no cut is scheduled. The decision was made without the production
numbers, which were out of reach from the cloud session that wrote this doc.
The queries and thresholds below remain the way to revisit it. No code was
deleted.

Measured on `design-refresh` at 2026-10-12.

## The question

The Dashboard ([ADR-038](../ARCHITECTURE.md#adr-038),
[dashboard.md](../architecture/dashboard.md)) and the Mediator Dashboard
([mediator-dashboard.md](../architecture/mediator-dashboard.md)) are ITUN's two
largest features. The next styling phase,
[Tailwind-removal P5](../design-system/tailwind-removal.md),
exists only to port their `.pc-*` stylesheet. Before that work starts: do
enough people use them to justify the port? Or should one or both be frozen or
cut?

## What it costs: measured from the repo

Counted with `wc -l` over `apps/itun` on this branch. "Source" means
`.ts`/`.tsx` files that are not tests or stories.

| | Dashboard (`components/dashboard/`) | Mediator (`components/mediator/`) |
| --- | --- | --- |
| Source | 10,702 lines, 47 files | 2,413 lines, 18 files |
| Unit/component tests (`__tests__/`) | 5,691 lines, 28 files | 689 lines, 4 files |
| Stories | 1,423 lines, 13 files | 129 lines, 1 file |
| Architecture doc | 380 lines (`dashboard.md`) | 330 lines (`mediator-dashboard.md`) |

Shared by both:

- **Convex backend:** `convex/{seats,mediator,proposals,downtime}.ts` total
  1,025 lines. Their tests in `test/convex/` (`seats`, `mediator`,
  `mediatorDashboard`, `proposals`, `downtime`, `downtimeSteps`) total
  1,428 lines.
- **e2e:** `dashboard-delete`, `dashboard-phone` and `mediator-propose` total
  400 lines.
- **ADR-038:** 237 lines of `docs/ARCHITECTURE.md`.
- **Styling debt** (`bun tools/check-styling.ts --report`):
  - `pc-class-defined` is **102**. All 102 classes live in
    `src/styles/dashboard.css` and `src/styles/dashboard/*.css` (1,161 lines).
  - About 100 distinct `pc-*` names are used from `components/dashboard/`
    (31 source files). The Mediator uses only 3.
  - 13 of the 279 files in `tailwind-utility-file` are under
    `components/dashboard/`. None are under `components/mediator/`.

**Total:** about 13.1k source lines, 9.5k test lines (component, Convex and
e2e), 1.6k story lines, 1.2k CSS lines and 0.95k doc lines. That is the
largest single block of ITUN.

**Where the styling cost falls:** almost all of P5 is the Dashboard's.
Freezing or cutting the Mediator Dashboard on its own barely changes P5.
Only a decision about the Dashboard does.

## What it is used for: not measured

**Production usage could not be read from this session.** The `convex` MCP
server's `status` call returned `Not Authorized: Run npx convex dev`. It is
declared for the local deployment (see `.mcp.json`), the cloud container has
no `CONVEX_DEPLOYMENT` and no deploy key, and nothing here may touch the
production deployment. No usage numbers in this doc are estimates. Every one
of them is still to be measured.

### What the data can and cannot say

ITUN has no analytics events, so the signals come from rows the features
write and from Convex function-call counts:

| Signal | Where it lives | What it shows | Caveat |
| --- | --- | --- | --- |
| Active players | distinct `changeLog.actorId` in the window | accounts that changed anything | misses accounts that only read |
| Sign-ins | `authSessions._creationTime` | new sessions | one sign-in covers a long session, so this is a floor |
| Games run | Games with any `changeLog` row or seat write in the window | Games in play | a Game whose members only read looks idle |
| Dashboard use | `seats.updatedAt` in the window; `changeLog` with `source: 'dashboard'` | pilots who boarded, rolled or set range | opening the Dashboard without acting writes nothing |
| Mediator use | `changeLog` with `source` `'mediator-proposal'` / `'mediator-alert'`; `downtime.startedAt` (only `requireMediator` callers start Downtime) | Mediators who acted | opening without acting writes nothing |
| Mediator opens | calls to `mediator:amMediator` | each mount of `MediatorGate`, its only caller | counts reactive re-runs too; a ceiling |
| Dashboard opens | calls to `seats:forGame` | Dashboard and Mediator Dashboard mounts together | the two surfaces share it |

The comparison that matters is between surfaces: Dashboard writes against
`live-sheet` and `discord-bot` writes, in the same Games over the same window.

## What the owner needs to run

The window is the **last 90 days**. Everything is read-only.

1. **Query the rows.** Use the Convex dashboard for `suref-itun` prod, under
   Functions → *Run custom query*, or the `convex` MCP `runOneoffQuery`
   signed in with a prod selector. First set `EXCLUDE_USERS` to the `users`
   `_id`s of your own and your test accounts, so the result isn't just your
   own testing. Then run:

   ```js
   import { query } from "convex:/_system/repl/wrappers.js";

   const DAYS = 90;
   const EXCLUDE_USERS = []; // owner + test account users._id strings
   const SOURCES = ["dashboard", "mediator-proposal", "mediator-alert", "live-sheet", "discord-bot"];

   export default query({
     handler: async (ctx) => {
       const since = Date.now() - DAYS * 86400000;
       const excluded = new Set(EXCLUDE_USERS);

       const signInUsers = new Set();
       let signIns = 0;
       for await (const s of ctx.db.query("authSessions").order("desc")) {
         if (s._creationTime < since) break;
         if (excluded.has(s.userId)) continue;
         signIns++;
         signInUsers.add(s.userId);
       }

       const writes = {}, actors = {}, gamesBySource = {};
       for (const s of SOURCES) { writes[s] = 0; actors[s] = new Set(); gamesBySource[s] = 0; }
       const allActors = new Set();
       let games = 0, activeGames = 0, dashboardGames = 0, mediatorGames = 0;
       let seatsTouched = 0, downtimesStarted = 0;

       for (const g of await ctx.db.query("games").collect()) {
         const members = await ctx.db.query("memberships")
           .withIndex("by_game", (q) => q.eq("gameId", g._id)).collect();
         if (members.length === 0 || members.every((m) => excluded.has(m.userId))) continue;
         games++;
         let active = false;
         for (const s of SOURCES) {
           const rows = (await ctx.db.query("changeLog")
             .withIndex("by_game_source_ts", (q) => q.eq("gameId", g._id).eq("source", s).gte("ts", since))
             .collect()).filter((r) => !excluded.has(r.actorId));
           if (rows.length === 0) continue;
           active = true;
           writes[s] += rows.length;
           gamesBySource[s]++;
           for (const r of rows) { actors[s].add(r.actorId); allActors.add(r.actorId); }
         }
         const seats = (await ctx.db.query("seats")
           .withIndex("by_game_pilot", (q) => q.eq("gameId", g._id)).collect())
           .filter((x) => x.updatedAt >= since);
         seatsTouched += seats.length;
         const dt = await ctx.db.query("downtime")
           .withIndex("by_game", (q) => q.eq("gameId", g._id)).first();
         const downtime = dt !== null && dt.startedAt !== null && dt.startedAt >= since;
         if (downtime) downtimesStarted++;
         const dash = seats.length > 0 || (await ctx.db.query("changeLog")
           .withIndex("by_game_source_ts", (q) => q.eq("gameId", g._id).eq("source", "dashboard").gte("ts", since))
           .first()) !== null;
         const med = downtime || (await ctx.db.query("changeLog")
           .withIndex("by_game_source_ts", (q) => q.eq("gameId", g._id).eq("source", "mediator-proposal").gte("ts", since))
           .first()) !== null;
         if (active || dash || med) activeGames++;
         if (dash) dashboardGames++;
         if (med) mediatorGames++;
       }

       return {
         windowDays: DAYS, signIns, signInUsers: signInUsers.size, activePlayers: allActors.size,
         games, activeGames, dashboardGames, mediatorGames, seatsTouched, downtimesStarted,
         writes, gamesBySource,
         actors: Object.fromEntries(SOURCES.map((s) => [s, actors[s].size])),
       };
     },
   });
   ```

   If it hits a read limit, lower `DAYS` to 30 and run it once per month.

2. **Count opens.** In the Convex dashboard, open Functions and select
   `mediator:amMediator`, then `seats:forGame`. Read their call counts over
   the longest window the charts offer, and write down that window next to
   the counts.
3. **Get page views, if wanted.** Cloudflare Web Analytics or Workers
   analytics for the ITUN Worker can show views of `/dashboard/*` and
   `/mediator/*` paths. That would be a fourth signal; nothing in the repo
   wires it up today.

Record the three outputs at the end of this doc and pick an option.

## Decision thresholds

Measure everything over 90 days, with your own and your test accounts
excluded. Define

- `D = dashboardGames / activeGames`
- `M = mediatorGames / activeGames`

| | Keep and port (P5 as planned) | Freeze (no new features; port only) | Cut (delete in its own PR) |
| --- | --- | --- | --- |
| Dashboard | `D ≥ 0.30` **and** `dashboardGames ≥ 3` **and** `writes.dashboard` is at least ¼ of `writes.live-sheet` | in between | `dashboardGames ≤ 1`, or `D < 0.10` |
| Mediator Dashboard | `mediatorGames ≥ 3` **and** `writes.mediator-proposal ≥ 20` | in between | `mediatorGames = 0`, or only one Game, which is yours |

Two rules apply on top of the table:

- **Too little data.** If `activeGames < 3`, the ratios mean nothing. Freeze
  both rather than cut, and measure again in 90 days.
- **Cut is reversible.** A cut keeps its history in git. The ADR records why,
  and a revert brings the feature back.

## Options and their costs

**A. Keep both and run P5 in full.** Port 102 `.pc-*` classes (1,161 CSS
lines across 31 Dashboard files) to style objects, and keep about 9.5k test
lines green through it. Pick this if both features clear their keep line.

**B. Keep the Dashboard, freeze the Mediator Dashboard.** This saves almost no
P5 work, because the Mediator uses only 3 `pc-*` names. It saves future
features and the 330-line doc's upkeep. Pick this if the Dashboard clears its
keep line and the Mediator lands in freeze.

**C. Freeze both, then do a minimal P5.** Port the CSS mechanically, with no
redesign of either surface, and stop all feature work. P5's line count stays
the same, but it needs much less design effort. Pick this when the data is
thin (`activeGames < 3`) or both land in freeze.

**D. Cut one or both.** Delete the surface, its route, tests, stories, docs
and CSS. Cutting the Dashboard removes almost all of P5 (`pc-class-defined`
goes to 0) and about 10.7k source lines.

The blast radius is larger than the folder:

- The ITUN `CLAUDE.md` says play actions such as activation and heat check
  live **only** on the Dashboard (`dashboardRules.ts`, `useActionsDeck.ts`).
  A cut has to move them back to the Live Sheet or drop them. That needs its
  own ADR superseding ADR-038, and a call on what replaces the play surface
  under ADR-021 and ADR-007.
- `seats` and `downtime` are shared with the Discord bot's Game client, so
  check its use of them before deleting any Convex function.

Pick D only if a feature lands under its cut line.

## Recommendation

**Run the measurements before P5 starts. Until they're in, pick C (freeze
both).**

- P5 is almost entirely the Dashboard's cost, so the decision that matters is
  about the Dashboard. The Mediator Dashboard is cheap to keep for styling
  purposes either way.
- Do not cut on code size alone. The Dashboard is ITUN's only play surface
  (see the blast radius under option D), so a cut is an ADR-level change,
  not a cleanup.
- If the numbers clear the Dashboard's keep line, go to A or B. If they fall
  under its cut line, write the superseding ADR first, then the cut, as its
  own wave.

## Results

| Measure | Value | Window |
| --- | --- | --- |
| activePlayers / signInUsers | | |
| games / activeGames | | |
| dashboardGames (D) | | |
| mediatorGames (M) | | |
| writes: dashboard / live-sheet / discord-bot / mediator-proposal | | |
| `mediator:amMediator` calls | | |
| `seats:forGame` calls | | |
| Decision | Keep both the Dashboard and the Mediator Dashboard for now (owner, without usage numbers) | 2026-10-12 |

# ADR-062: Play at /play, one URL grammar

Decided and built for 4.2.2, from the URL audit of 2026-10-23. Amends
[ADR-048](../ARCHITECTURE.md) (the app is no longer only under `/build`),
[ADR-050](050-one-app.md) and [ADR-052](052-build-assets-play-games.md) §4–5
(Play's addresses).

1. **Three roots, one per mode.** The site's tabs are Reference, Build and
   Play, so each has its own root: Reference at `/`, the Training Bay at
   `/build/`, Play at `/play/`. Play is no longer `/build/play/`.
2. **One app, two roots.** `apps/web` stays one client app (ADR-050). Its
   routes keep their in-app strings, and Play's routes are spelled as their
   site paths (`/play/…`), so one pair of functions maps both ways:
   `appPath(route)` (a Play route as it is, anything else under `/build`) and
   `routeInApp(pathname)` (`game-domain/appAddress.ts`). The router's
   `rewrite`, the Worker, the service worker's navigation rule, e2e and the
   Discord bot all read that pair; none spells `/build` itself.
3. **Play's addresses.** `/play/` (the hub), `/play/games/:id` (a Game's
   page), `/play/games/:id/mediate` (its Mediator's Cockpit),
   `/play/pilots/:id` (a pilot's Cockpit), `/play/invite/:token`. Every path
   names a collection, then an id, then an action.
4. **Build's addresses.** A unit's sheet is the plural of its kind and its id,
   as the wizards (`/build/pilots/new`) and the reference (`/chassis/mule/`)
   are: `/build/pilots/:id`, `/build/mechs/:id`, `/build/crawlers/:id`,
   `/build/npcs/:id` (`sheetPath`). Saved patterns are `/build/patterns/`.
5. **Nothing old breaks.** Every retired address 301s in one hop, query kept
   (`retiredTarget`, `lib/redirects.ts`): `/build/play/…`,
   `/build/play/game/:id`, `/build/play/:pilotId`, `/build/invite/:token`,
   `/build/sheet/:kind/:id`, `/build/mechs/patterns`, and the older
   `/build/games…`, `/build/join/:code`, `/build/dashboard/:id`,
   `/build/mediator/:id`. Retirement is read only under `/build`.

## Consequences

- The Worker runs first for `/play` and `/play/*` as for `/build`
  (`wrangler.jsonc`), and serves the one shell for both.
- Convex Auth's `SITE_URL` stays `…/build`, so signing in from an invite
  costs one extra hop back to `/play/invite/…`.
- The Discord bot's links follow the same grammar; its `/sheet` command still
  reads the old `/sheet/<kind>/<id>` links already posted.

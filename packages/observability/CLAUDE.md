# observability

Sentry and platform wiring shared by every surface. Ships TypeScript source (no
build step), like the other packages. Three subpaths, each imported by name —
there is no root export:

| Subpath | Consumers | What it is |
| --- | --- | --- |
| `observability/cloudflare` | the three Workers (`apps/itun/src/worker`, `apps/su-assets`, `apps/discord-bot/src/http`) | `withObservability` wraps a Worker's default export for Sentry; `reportError`; `startCheckIn` / `finishCheckIn` for cron monitors |
| `observability/browser` | `apps/srd` and `apps/itun` (`src/lib/observability.ts`) | `createBrowserObservability` and `buildCaptureHint` — the half of the browser shim that imports **no** Sentry code |
| `observability/worker-http` | the two asset-serving Workers | `edgeCache`, `IMMUTABLE_CACHE_CONTROL`, `BASE_SECURITY_HEADERS` |

## Rules that are easy to break

- **No module-scope Sentry initialisation in a Worker.** Workers forbid I/O and
  timers at module scope (ADR-033), so the wrapper builds its options per
  request from `env`. Never add a top-level `Sentry.init()`.
- **The browser DSN guard stays in each app.** `browser.ts` takes a *loader*,
  not the SDK, so the app's `if (!dsn) return` still guards its dynamic
  `import('@sentry/browser')` and Vite drops the SDK from a build with no DSN.
  Hoisting the guard in here would ship the SDK to every visitor.
- **A new Worker must wrap its export and grant `nodejs_als`.**
  `tools/check-observability.ts` (the `observability` check) fails otherwise — that
  gate is also where the CSP half lives, so change a Sentry region or CSP in
  every source for that app together.
- `@sentry/cloudflare` is a runtime `dependency` here, not a devDependency: the
  Workers get it through this package.

Tests are in `src/__tests__/` and drive the real SDK with `fetch` replaced, so
they assert what actually leaves the Worker: `bun --filter observability test`.

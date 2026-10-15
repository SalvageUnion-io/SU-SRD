# observability

Error reporting shared by every surface: Workers Issues is the error tracker
(ADR-049). Ships TypeScript source (no build step), like the other packages.
Two subpaths, each imported by name — there is no root export, and no
third-party SDK:

| Subpath | Consumers | What it is |
| --- | --- | --- |
| `observability/cloudflare` | the four Workers (`apps/srd/src/worker`, `apps/cantina/src/worker`, `apps/su-assets/src/worker`, `apps/discord-bot/src/worker`) | `reportError` logs a handled error with `console.error`, which Issues records; `handleErrorReport` answers a browser's report at `ERROR_REPORT_PATH`; `handleConvexLogStream` answers the Convex log stream at `CONVEX_LOG_STREAM_PATH` (The Cantina only) |
| `observability/browser` | `apps/srd` and `apps/cantina` (`src/lib/observability.ts`) | `createBrowserObservability` (init, which hears the window's `error` and `unhandledrejection`; `captureException`; `installChunkRecovery`) |

## Rules that are easy to break

- **Issues needs the Worker config, not code.** Every `wrangler.jsonc` keeps
  `observability.issues.enabled` and `upload_source_maps`;
  `tools/check-observability.ts` fails a Worker without them.
- **A handled error is reported with `reportError`, never swallowed.** Issues
  sees only an uncaught throw, a `5xx` and `console.error`.
- **The report endpoints never answer `5xx` for a bad report.** Issues would
  record it as this endpoint failing. A malformed report is a `4xx`.
- **The browser gate is `import.meta.env.PROD`, in each app.** The dev servers
  have no Worker to post to.
- Browser stacks stay minified: Cloudflare applies source maps to a Worker's
  own code only.

Tests are in `src/__tests__/`: `bun --filter observability test`.

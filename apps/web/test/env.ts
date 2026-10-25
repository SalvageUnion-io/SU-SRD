/**
 * Test-only environment, preloaded via `bunfig.toml` **before happy-dom**.
 */

/**
 * The runtime's own fetch classes, captured before the happy-dom preload
 * replaces them with a browser's — which drop `Set-Cookie` and `Cookie`, and
 * fail `oauth4webapi`'s `instanceof URL`. Convex runs on these, so a test that
 * drives a Convex HTTP action through cookies swaps them back in for its file.
 */
export const NATIVE_FETCH_GLOBALS = { URL, Headers, Request, Response }

/**
 * The runtime's own `fetch`, and the abort signal it accepts, captured for the
 * same reason: happy-dom's runs a browser's CORS preflight, which a
 * deployment's outbound call never does, and the runtime's fetch refuses
 * happy-dom's `AbortSignal`. A test whose Convex action calls out over a real
 * socket (`playDiscordRelay.test.ts`) swaps them back in for its file.
 */
export const NATIVE_OUTBOUND = { fetch: globalThis.fetch, AbortController, AbortSignal }

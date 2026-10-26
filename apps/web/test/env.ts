/**
 * Test-only environment, preloaded via `bunfig.toml` **before happy-dom**.
 */

/**
 * The runtime's own fetch classes, captured before the happy-dom preload
 * replaces them with a browser's — which drop `Set-Cookie` and `Cookie`, and
 * fail `oauth4webapi`'s `instanceof URL`. The Worker runs on these, so a test
 * that drives a Worker route through cookies swaps them back in for its file.
 */
export const NATIVE_FETCH_GLOBALS = { URL, Headers, Request, Response }

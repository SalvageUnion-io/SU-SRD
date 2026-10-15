/**
 * Test-only environment, preloaded via `bunfig.toml` **before happy-dom**.
 *
 * `convexAuth()` reads `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` once, when
 * `convex/auth.ts` is first imported, and bakes them into the provider. Test
 * files share one module cache, so whichever imports it first decides — setting
 * them inside a test file is too late. `discordSignIn.test.ts` drives the real
 * OAuth callback, which refuses a client without an id.
 *
 * `??=` rather than `=` so a real local environment is never clobbered.
 */
process.env.AUTH_DISCORD_ID ??= 'test-discord-client-id'
process.env.AUTH_DISCORD_SECRET ??= 'test-discord-client-secret'

/**
 * The runtime's own fetch classes, captured before the happy-dom preload
 * replaces them with a browser's — which drop `Set-Cookie` and `Cookie`, and
 * fail `oauth4webapi`'s `instanceof URL`. Convex runs on these, so a test that
 * drives a Convex HTTP action through cookies swaps them back in for its file.
 */
export const NATIVE_FETCH_GLOBALS = { URL, Headers, Request, Response }

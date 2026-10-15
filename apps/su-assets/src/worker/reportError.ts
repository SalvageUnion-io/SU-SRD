/**
 * Report a handled error — one the Worker caught and turned into a response.
 *
 * Workers Issues records an uncaught throw, a `5xx` and any `console.error`
 * (`observability.issues` in `wrangler.jsonc`). This Worker catches nearly
 * everything (a storage failure becomes a 503), so logging the error at error
 * level is what makes Issues record it. Its own module, so tests can spy on it.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error(error, context ?? {})
}

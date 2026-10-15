/**
 * Report a handled error — one the bot caught and turned into a reply.
 *
 * Workers Issues records an uncaught throw, a `5xx` and any `console.error`
 * (`observability.issues` in `wrangler.jsonc`), so logging the error at error
 * level is what makes Issues record it. Safe under Bun, so shared code and its
 * tests call it directly.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error(error, context ?? {})
}

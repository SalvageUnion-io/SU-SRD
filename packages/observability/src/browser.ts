/**
 * The part of the two browser Sentry shims that genuinely duplicated.
 *
 * This module imports NO Sentry code, deliberately. `apps/itun` and `apps/srd`
 * each keep their own `initBrowserObservability`, because each reads its own
 * `import.meta.env` DSN (`VITE_SENTRY_DSN` / `PUBLIC_SENTRY_DSN`) and Vite
 * inlines that statically at build. The resulting `if (!dsn) return` is what
 * makes the `@sentry/browser` dynamic import unreachable, so Rollup drops the
 * SDK entirely from a build with no DSN provisioned. Hoisting the guard into a
 * shared function would take a constant Vite can fold and turn it into a
 * runtime argument it cannot — shipping the SDK to every visitor to remove ~15
 * lines of duplication.
 *
 * So what moves here is the piece that had no such constraint and had already
 * diverged: how a caught error's grouping and labelling is assembled.
 */

/**
 * Grouping and labelling for a captured event.
 *
 * Both fields exist for the same reason: a Sentry issue is only useful if all
 * the events of one condition land in it and its title says what the condition
 * is. Convex's redacted errors satisfy neither by default — the message is
 * `"[CONVEX M(fn)] [Request ID: 1b66…] Server Error"`, so the request id makes
 * every event's message unique and the rest of it says nothing. In production
 * that produced two separate issues titled with request ids, for one condition,
 * with the actual cause nowhere in either.
 */
export type CaptureOptions = {
  /**
   * Stable grouping key. Overrides Sentry's default fingerprint entirely, so
   * pass the things that identify the *condition* and nothing that varies per
   * event (never a request id, an entity id, or a bundle hash).
   */
  fingerprint?: string[]
  /** Searchable, aggregatable labels. Sentry indexes these; `extra` it does not. */
  tags?: Record<string, string>
}

/** The subset of Sentry's event hint this repo uses. */
export type CaptureHint = {
  extra?: Record<string, unknown>
  tags?: Record<string, string>
  fingerprint?: string[]
}

/**
 * Build the hint object for `Sentry.captureException`, or `undefined` when
 * there is nothing to attach.
 *
 * Spelled out rather than derived from
 * `Parameters<typeof Sentry.captureException>[1]`. That compiles, but it pins
 * the shape to Sentry's `ExclusiveEventHintOrCaptureContext` union — three
 * overlapping shapes whose members are mutually `never` — so the day the SDK
 * reshapes that union the breakage lands here rather than at the call site.
 * These three fields are the whole contract we use; naming them is both clearer
 * and stabler. (Keeping that reasoning is the point of moving this: it was
 * written once, in itun, and the srd copy simply lacked the capability.)
 */
export function buildCaptureHint(
  context?: Record<string, unknown>,
  options?: CaptureOptions
): CaptureHint | undefined {
  const hint: CaptureHint = {}
  if (context) hint.extra = context
  if (options?.tags) hint.tags = options.tags
  if (options?.fingerprint) hint.fingerprint = options.fingerprint
  return Object.keys(hint).length > 0 ? hint : undefined
}

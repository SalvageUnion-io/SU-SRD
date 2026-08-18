/**
 * Transport-neutral ITUN settings, for code shared by both bot transports.
 *
 * ## The bug this exists to fix
 *
 * `config.ts` calls `requireEnv('DISCORD_TOKEN')` at MODULE SCOPE, deliberately
 * — a bot that starts without a Discord token is a bot that fails silently in
 * production, and that strictness is correct for the Render worker.
 *
 * It is fatal on Cloudflare. Four ITUN command modules import `config.js`, all
 * reachable from `su.ts`, so the Worker's module graph evaluates `requireEnv`
 * at isolate startup. There is no `process.env` on workerd — configuration
 * arrives as the `env` argument to `fetch` — so the isolate throws before it
 * ever serves a request.
 *
 * The unit tests did NOT catch this: `test/env.ts` is preloaded via
 * `bunfig.toml` and sets those variables, so `config.ts` loads happily under
 * Bun. It surfaced only when the Worker was driven without that preload, which
 * is why `__tests__/workerEnv.test.ts` now asserts the property directly rather
 * than relying on a graph that happens to be clean.
 *
 * ## The shape
 *
 * Same pattern as `report.ts`: shared code names no transport, and each
 * entrypoint installs what it knows. `index.ts` installs from `config`;
 * `http/worker.ts` installs from its `env`.
 *
 * Solo mode remains the default and is the important half: with `siteUrl` or
 * `botSecret` missing, reference commands behave exactly as they always have
 * and Game commands report themselves not connected. An uninstalled settings
 * object is therefore Solo, which is the correct behaviour for a deploy that
 * has not been given credentials — degrade, never crash.
 */

/** The canonical web origin, used when none is configured or one is malformed. */
export const DEFAULT_ITUN_WEB_URL = 'https://intheunionnow.com'

export type ItunSettings = {
  /**
   * The Convex HTTP-actions origin (`*.convex.site`) — NOT the client URL
   * (`*.convex.cloud`) and NOT the web origin. Getting this wrong presents as
   * every Game command reporting the deployment unreachable.
   */
  siteUrl?: string
  botSecret?: string
  /**
   * Where embeds link back to. Only ever used to build a URL, never called.
   * Always absolute: `EmbedBuilder.setURL` THROWS on a relative or malformed
   * URL, so a blank value would not degrade — it would break every Game command
   * with a generic error.
   */
  webUrl: string
}

let current: ItunSettings = { webUrl: DEFAULT_ITUN_WEB_URL }

/** An absolute http(s) URL, or the canonical origin. */
export function normaliseWebUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_ITUN_WEB_URL
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? trimmed
      : DEFAULT_ITUN_WEB_URL
  } catch {
    return DEFAULT_ITUN_WEB_URL
  }
}

/** Install this process/isolate's settings. Called once by each entrypoint. */
export function setItunSettings(next: ItunSettings): void {
  current = next
}

export function itunSettings(): ItunSettings {
  return current
}

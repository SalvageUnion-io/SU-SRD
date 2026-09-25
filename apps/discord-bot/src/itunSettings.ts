/**
 * ITUN settings, installed by the entrypoint rather than read from `config.ts`.
 *
 * ## Why not `config.ts`
 *
 * `config.ts` (used by the `deploy-commands` CLI) calls
 * `requireEnv('DISCORD_TOKEN')` at MODULE SCOPE. That is fatal on Cloudflare: a
 * command module importing it would make the Worker's module graph evaluate
 * `requireEnv` at isolate startup. There is no `process.env` on workerd — configuration
 * arrives as the `env` argument to `fetch` — so the isolate throws before it
 * ever serves a request.
 *
 * The unit tests cannot catch this: `test/env.ts` is preloaded via
 * `bunfig.toml` and sets those variables, so `config.ts` loads happily under
 * Bun. `http/__tests__/workerEnv.test.ts` asserts the property directly.
 *
 * ## The shape
 *
 * Same pattern as `report.ts`: shared code reads nothing from the environment,
 * and `http/worker.ts` installs the settings from its `env`.
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
    // Not a URL at all: use the default rather than link somewhere broken.
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

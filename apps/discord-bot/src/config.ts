function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function optionalEnv(key: string): string | undefined {
  return process.env[key]
}

/** An absolute http(s) URL from the environment, or `fallback`. */
function absoluteUrlOr(key: string, fallback: string): string {
  const value = process.env[key]?.trim()
  if (!value) return fallback
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : fallback
  } catch {
    return fallback
  }
}

export const config = {
  discordToken: requireEnv('DISCORD_TOKEN'),
  discordClientId: requireEnv('DISCORD_CLIENT_ID'),
  discordGuildId: optionalEnv('DISCORD_GUILD_ID'),
  // Optional error tracking. When SENTRY_DSN is unset, observability is a no-op.
  sentryDsn: optionalEnv('SENTRY_DSN'),
  nodeEnv: optionalEnv('NODE_ENV'),
  // In The Union Now (ADR-030 Phase 6). BOTH optional and BOTH required
  // together: with either missing the bot runs in Solo mode — reference
  // commands work exactly as they always have, and the Game commands say they
  // are not connected. That is the deliberate default, so a deploy that has
  // not been given credentials degrades rather than crashing at startup.
  //
  // `itunSiteUrl` is the Convex HTTP-actions origin (`*.convex.site`), NOT the
  // client URL (`*.convex.cloud`) and NOT the web origin. Getting this wrong
  // presents as every Game command reporting the deployment unreachable.
  itunSiteUrl: optionalEnv('ITUN_CONVEX_SITE_URL'),
  itunBotSecret: optionalEnv('ITUN_BOT_SECRET'),
  // Where embeds link back to. Only ever used to build a URL, never called.
  //
  // Validated rather than merely defaulted: `EmbedBuilder.setURL` THROWS on a
  // relative or malformed URL, so a blank or scheme-less value here would not
  // degrade — it would break every Game command with a generic error. A bad
  // value falls back to the canonical origin, which is always better than
  // taking the whole surface down over a typo in an env var.
  itunWebUrl: absoluteUrlOr('ITUN_WEB_URL', 'https://intheunionnow.com'),
} as const

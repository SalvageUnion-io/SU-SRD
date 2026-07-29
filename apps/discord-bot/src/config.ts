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

export const config = {
  discordToken: requireEnv('DISCORD_TOKEN'),
  discordClientId: requireEnv('DISCORD_CLIENT_ID'),
  discordGuildId: optionalEnv('DISCORD_GUILD_ID'),
  // Optional error tracking. When SENTRY_DSN is unset, observability is a no-op.
  sentryDsn: optionalEnv('SENTRY_DSN'),
  nodeEnv: optionalEnv('NODE_ENV'),
  // Render auto-populates this for every service/worker (no provisioning
  // needed) — the deployed commit SHA, used to tag Sentry events with a
  // release so an error maps back to the exact deploy that produced it.
  releaseSha: optionalEnv('RENDER_GIT_COMMIT'),

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
  itunWebUrl: optionalEnv('ITUN_WEB_URL') ?? 'https://intheunionnow.com',
} as const

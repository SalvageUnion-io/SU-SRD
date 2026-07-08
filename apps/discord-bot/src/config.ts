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
} as const

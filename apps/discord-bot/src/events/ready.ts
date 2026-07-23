import { ActivityType, type PresenceData } from 'discord.js'
import { captureMessage } from '../observability.js'

/**
 * The NARROW client surface handleReady actually reads — interface
 * segregation over `Client<true>`, which always satisfies it structurally.
 * Lets tests build a minimal recording client with no forced casts.
 */
export type ReadyClient = {
  user: { tag: string; setPresence(presence: PresenceData): void }
  guilds: { cache: { size: number } }
}

export function handleReady(client: ReadyClient): void {
  console.log(`Logged in as ${client.user.tag}`)
  console.log(`Serving ${client.guilds.cache.size} guild(s)`)
  // A steady presence so the bot reads as a live, first-class app rather than
  // an idle script — renders as "Playing Salvage Union".
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'Salvage Union', type: ActivityType.Playing }],
  })
  // Liveness signal (no-op unless SENTRY_DSN is set): a Render worker has no
  // HTTP port to health-probe, so a Sentry info event on every successful
  // login/reconnect is the basic "process is alive" alert path — an unusual
  // gap between these (e.g. Sentry's own alerting on event absence) signals
  // the worker went dark.
  captureMessage('discord-bot ready', {
    guildCount: client.guilds.cache.size,
  })
}

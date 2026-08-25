import type { PresenceData } from 'discord.js'
import { ActivityType } from 'discord.js'
import { startLivenessHeartbeat } from '../observability.js'

/**
 * The NARROW client surface handleReady actually reads — interface
 * segregation over `Client<true>`, which always satisfies it structurally.
 * Lets tests build a minimal recording client with no forced casts.
 */
export type ReadyClient = {
  user: { tag: string; setPresence(presence: PresenceData): void }
  guilds: { cache: { size: number } }
  /**
   * Discord.js's own connection state, read on every heartbeat tick rather than
   * once here — see `startLivenessHeartbeat`. `Client` satisfies this
   * structurally, so nothing at the call site changes.
   */
  isReady(): boolean
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
  // Liveness (no-op unless SENTRY_DSN is set). Started here rather than at
  // process start because "alive" for this worker means logged in and serving
  // guilds, which is exactly what reaching this handler proves.
  //
  // This replaced a `captureMessage('discord-bot ready')` that was described as
  // an alert path but could not be one — Sentry alerts on events arriving, not
  // on their absence, so a worker going dark raised nothing. It is now a cron
  // monitor, where a MISSED check-in is the alert. See `startLivenessHeartbeat`.
  //
  // The predicate is what makes that true beyond the first tick: reaching this
  // handler proves the bot connected once, and `isReady()` is what proves it is
  // still connected each time it checks in.
  startLivenessHeartbeat(() => client.isReady())
}

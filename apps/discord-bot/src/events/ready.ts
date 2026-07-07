import { ActivityType, type Client } from 'discord.js'

export function handleReady(client: Client<true>): void {
  console.log(`Logged in as ${client.user.tag}`)
  console.log(`Serving ${client.guilds.cache.size} guild(s)`)
  // A steady presence so the bot reads as a live, first-class app rather than
  // an idle script — renders as "Playing Salvage Union".
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'Salvage Union', type: ActivityType.Playing }],
  })
}

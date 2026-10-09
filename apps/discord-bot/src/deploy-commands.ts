import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import { commands } from './commands/index.js'

/**
 * Register the slash commands with Discord. A local CLI (`bun run
 * deploy-commands`), never imported by the Worker, so it is the one place in
 * the bot that reads `process.env`.
 */

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    console.error(`Missing required environment variable: ${key}`)
    process.exit(1)
  }
  return value
}

const token = requireEnv('DISCORD_TOKEN')
const clientId = requireEnv('DISCORD_CLIENT_ID')
const guildId = process.env.DISCORD_GUILD_ID

const commandData = Array.from(commands.values()).map((cmd) => cmd.data.toJSON())

const rest = new REST({ version: '10' }).setToken(token)

async function deployCommands(): Promise<void> {
  try {
    console.log(`Started refreshing ${commandData.length} application (/) commands.`)

    const deployGlobal = process.env.DEPLOY_GLOBAL === 'true'

    if (deployGlobal) {
      // Deploy globally (takes up to 1 hour to propagate)
      const data = await rest.put(Routes.applicationCommands(clientId), {
        body: commandData,
      })
      const count = Array.isArray(data) ? data.length : 0
      console.log(`Successfully reloaded ${count} global commands.`)
    } else if (guildId) {
      // Deploy to specific guild (instant)
      const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandData,
      })
      const count = Array.isArray(data) ? data.length : 0
      console.log(`Successfully reloaded ${count} guild commands.`)
    } else {
      console.error(
        'No DISCORD_GUILD_ID set for development. Use DEPLOY_GLOBAL=true for production.'
      )
      process.exit(1)
    }
  } catch (error) {
    console.error('Error deploying commands:', error)
    process.exit(1)
  }
}

deployCommands()

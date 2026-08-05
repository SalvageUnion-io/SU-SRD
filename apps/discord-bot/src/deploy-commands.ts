import { REST, Routes } from 'discord.js'
import { commands } from './commands/index.js'
import { config } from './config.js'

const commandData = Array.from(commands.values()).map((cmd) => cmd.data.toJSON())

const rest = new REST().setToken(config.discordToken)

async function deployCommands(): Promise<void> {
  try {
    console.log(`Started refreshing ${commandData.length} application (/) commands.`)

    const deployGlobal = process.env.DEPLOY_GLOBAL === 'true'

    if (deployGlobal) {
      // Deploy globally (takes up to 1 hour to propagate)
      const data = await rest.put(Routes.applicationCommands(config.discordClientId), {
        body: commandData,
      })
      const count = Array.isArray(data) ? data.length : 0
      console.log(`Successfully reloaded ${count} global commands.`)
    } else if (config.discordGuildId) {
      // Deploy to specific guild (instant)
      const data = await rest.put(
        Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
        { body: commandData }
      )
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

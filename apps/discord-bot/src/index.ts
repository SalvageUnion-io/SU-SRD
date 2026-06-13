import { Client, GatewayIntentBits, Events } from 'discord.js'
import { SalvageUnionReference } from 'salvageunion-reference'
import { config } from './config.js'
import { commands } from './commands/index.js'
import { handleReady } from './events/ready.js'
import { handleInteractionCreate } from './events/interactionCreate.js'

// Create client with minimal intents (only Guilds needed for slash commands)
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
})

// Attach commands collection to client
client.commands = commands

// Register event handlers
client.once(Events.ClientReady, handleReady)
client.on(Events.InteractionCreate, (interaction) => {
  void handleInteractionCreate(interaction)
})

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  process.exit(1)
})

// Login
console.log('Starting Salvage Union Discord Bot...')

// Load reference data before handling any interactions (models throw until preloaded).
await SalvageUnionReference.preload('all')

await client.login(config.discordToken)

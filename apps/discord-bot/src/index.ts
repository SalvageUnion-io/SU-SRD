import { Client, Events, GatewayIntentBits } from 'discord.js'
import { SalvageUnionReference } from 'salvageunion-reference'
import { commands } from './commands/index.js'
import { config } from './config.js'
import { handleInteractionCreate } from './events/interactionCreate.js'
import { handleReady } from './events/ready.js'
import { setItunSettings } from './itunSettings.js'
import {
  captureException,
  flushObservability,
  initObservability,
  stopLivenessHeartbeat,
} from './observability.js'
import { setReporter } from './report.js'

// Initialize error tracking as early as possible (no-op without SENTRY_DSN).
initObservability()

// Shared command/button code reports through `report.ts`, which names no
// transport — that is what keeps `@sentry/node` (and the OpenTelemetry and
// `node:path` it drags in) out of the Workers bundle. The gateway installs the
// Node reporter here; `http/worker.ts` installs its own. Without this call the
// gateway would silently stop reporting roll-attribution failures.
setReporter(captureException)

// The ITUN commands read configuration through `itunSettings.ts`, which names
// no transport — `config.ts` calls `requireEnv` at module scope and there is no
// `process.env` on workerd, so the Worker cannot import it. The gateway installs
// from `config`; `http/worker.ts` installs from its `env`.
setItunSettings({
  siteUrl: config.itunSiteUrl,
  botSecret: config.itunBotSecret,
  webUrl: config.itunWebUrl,
})

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
  captureException(error, { source: 'discord-client' })
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error)
  captureException(error, { source: 'unhandledRejection' })
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  captureException(error, { source: 'uncaughtException' })
  // Stop claiming to be alive on the way out, before the flush: a heartbeat tick
  // landing mid-drain would add an event to the buffer being drained, and a
  // process that is exiting is not one the monitor should hear from.
  stopLivenessHeartbeat()
  // Flush before exiting — the Sentry transport is async and a synchronous
  // exit would drop the very crash event Render restarts the worker for.
  void flushObservability().finally(() => process.exit(1))
})

// Login
console.log('Starting Salvage Union Discord Bot...')

// Load reference data before handling any interactions (models throw until preloaded).
await SalvageUnionReference.preload('all')

await client.login(config.discordToken)

import type { Interaction } from 'discord.js'
import type { Command } from '../commands/index.js'

// Extend Client type to include commands
declare module 'discord.js' {
  interface Client {
    commands: Map<string, Command>
  }
}

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName)

    if (!command?.autocomplete) {
      console.error(`No autocomplete handler for command: ${interaction.commandName}`)
      return
    }

    try {
      await command.autocomplete(interaction)
    } catch (error) {
      console.error(`Error in autocomplete for ${interaction.commandName}:`, error)
    }
    return
  }

  // Handle slash command interactions
  if (!interaction.isChatInputCommand()) return

  const command = interaction.client.commands.get(interaction.commandName)

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`)
    return
  }

  try {
    await command.execute(interaction)
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error)

    const reply = {
      content: 'There was an error while executing this command!',
      ephemeral: true,
    }

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply)
    } else {
      await interaction.reply(reply)
    }
  }
}

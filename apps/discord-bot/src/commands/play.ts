import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import type { CommandExecuteInteraction } from './interactions'

/**
 * `/su play`: open Play, the app's Activity, where the command ran (ADR-068).
 *
 * Discord answers with its own launch, so the bot sends no message: the
 * Activity signs the player in and finds the Game bound to the channel. The
 * same launch is the app's Entry Point command (`entryPoint.ts`), Discord's
 * Activity button.
 */
export const playCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('play').setDescription('Open Play, the SalvageUnion.io Activity, here')
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    await interaction.launchActivity()
  },
}

import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord-api-types/v10'
import type { CommandExecuteInteraction } from './interactions'
import { site } from './siteReply'

/**
 * `/su feedback`: suggest an idea or report a problem (ADR-053).
 *
 * The note goes to the app, which files it as a labelled issue on the public
 * SU-SRD repository without the sender's name; the description says so before
 * anybody types. Anybody may send one, linked or not. Every reply is
 * ephemeral: a note, and how it went, are the sender's business.
 */

/** The bounds the app holds a note to (`convex/feedback.ts`), so Discord refuses early. */
const MIN_LENGTH = 10
const MAX_LENGTH = 2000

export const feedbackCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('feedback')
      .setDescription(
        'Suggest an idea or report a problem (filed publicly on GitHub, without your name)'
      )
      .addStringOption((option) =>
        option
          .setName('kind')
          .setDescription('An idea, or something broken')
          .setRequired(true)
          .addChoices(
            { name: 'Suggestion', value: 'suggestion' },
            { name: 'Report a problem', value: 'report' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('text')
          .setDescription('What you would like, or what went wrong and where')
          .setRequired(true)
          .setMinLength(MIN_LENGTH)
          .setMaxLength(MAX_LENGTH)
      )
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const kind = interaction.options.getString('kind', true) === 'report' ? 'report' : 'suggestion'
    const text = interaction.options.getString('text', true)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const result = await site().feedback(interaction.user.id, kind, text)
    await interaction.editReply({
      content: result.kind === 'ok' ? result.value.message : result.message,
    })
  },
}

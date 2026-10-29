import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord-api-types/v10'
import { BIND_NEEDS_MANAGE_CHANNELS } from 'game-domain/botWire'
import { boundContainer, unboundContainer } from '../bindingContainer'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions'
import { respondWithSite, site } from './siteReply'

/**
 * `/su bind` and `/su unbind`: which channel Play's rolls post to.
 *
 * `/su bind game:<Game>` binds the channel it runs in (its id, and its name
 * so Play can show `#salvage-run`) to one of your Games
 * (its Mediator or Organiser only); `/su bind` with no Game binds it to your
 * solo play. A Game posts to one channel and so does a person, so binding
 * again moves it. In a server, binding takes Manage Channels in the channel;
 * `/su unbind` releases it for whoever bound it, anyone with Manage Channels
 * there, or the Game's Mediator or Organiser, and rolls stop posting there.
 * The site decides who may do what (`worker/shared/channelBindings.ts`) from
 * the permission the bot reads off the interaction; the bot refuses a bind
 * without it before asking, and otherwise only says what the site decided.
 *
 * Both replies are ephemeral, like every app reply that is about a person's
 * standing (`siteReply.ts`): a refusal names a role, and the confirmation
 * is for whoever ran it.
 */

/** Said when Discord sent no channel to bind, which a slash command in a channel always has. */
const NO_CHANNEL = 'Run this in the channel you want rolls posted to.'

export const bindCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('bind')
      .setDescription('Post Play’s rolls to this channel: a Game’s, or yours when solo')
      .addStringOption((option) =>
        option
          .setName('game')
          .setDescription('A Game you run (Mediator or Organiser); leave empty for solo play')
          .setRequired(false)
          .setAutocomplete(true)
      )
  },

  /**
   * The Games the caller may bind: those they mediate or organise. Every
   * failure is an empty list, as in `/su sheet`: an autocomplete cannot
   * explain itself.
   */
  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    const result = await site().gamesForAutocomplete(interaction.user.id)
    if (result.kind !== 'ok') {
      await interaction.respond([])
      return
    }
    const focused = interaction.options.getFocused().toLowerCase()
    const choices = result.value.games
      .filter((game) => game.mediator || game.organizer)
      .filter((game) => game.name.toLowerCase().includes(focused))
      .slice(0, 25) // Discord's hard cap on choices.
      .map((game) => ({ name: game.name.slice(0, 100), value: game.gameId }))
    await interaction.respond(choices)
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const channelId = interaction.channelId
    if (channelId === null) {
      await interaction.reply({ content: NO_CHANNEL, flags: MessageFlags.Ephemeral })
      return
    }
    if (interaction.manageChannels === false) {
      await interaction.reply({
        content: BIND_NEEDS_MANAGE_CHANNELS,
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    const game = interaction.options.getString('game')?.trim() || null
    await respondWithSite(interaction, {
      call: (client) =>
        client.bindChannel(
          interaction.user.id,
          channelId,
          game,
          interaction.channelName,
          interaction.manageChannels
        ),
      render: (value) => boundContainer(value),
    })
  },
}

export const unbindCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('unbind').setDescription('Stop posting Play’s rolls to this channel')
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const channelId = interaction.channelId
    if (channelId === null) {
      await interaction.reply({ content: NO_CHANNEL, flags: MessageFlags.Ephemeral })
      return
    }
    await respondWithSite(interaction, {
      call: (client) =>
        client.unbindChannel(interaction.user.id, channelId, interaction.manageChannels),
      render: (value) => unboundContainer(value, channelId),
    })
  },
}

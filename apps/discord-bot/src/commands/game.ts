import { MessageFlags, type SlashCommandSubcommandGroupBuilder } from 'discord.js'

import { config } from '../config.js'
import { buildChannelEmbed, denialMessage } from '../gameEmbed.js'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'
import { SOLO_NOTICE, itun, respondWithItun } from './itunReply.js'

/**
 * `/su game bind | unbind | info` — the channel↔Game link (ADR-030 Phase 6).
 *
 * The first **subcommand group** on `/su`; Discord allows a command's options
 * to mix plain subcommands and groups, so `/su roll` and `/su game bind` coexist
 * under one top-level command.
 *
 * Binding is administrative, so the server enforces Organizer — and enforces it
 * against the *Discord user*, not against the bot. Holding the bot credential
 * does not make you an Organizer of anything.
 */

const NO_CHANNEL = 'This command has to be run in a channel.'

async function requireChannel(interaction: CommandExecuteInteraction): Promise<string | null> {
  if (interaction.channelId !== null) return interaction.channelId
  await interaction.reply({ content: NO_CHANNEL, flags: MessageFlags.Ephemeral })
  return null
}

export const gameCommand = {
  /** Options for the `/su game` subcommand group (registered by su.ts). */
  group(group: SlashCommandSubcommandGroupBuilder): SlashCommandSubcommandGroupBuilder {
    return group
      .setName('game')
      .setDescription('Connect this channel to an In The Union Now game')
      .addSubcommand((sub) =>
        sub
          .setName('bind')
          .setDescription('Bind this channel to one of your games (Organizer only)')
          .addStringOption((option) =>
            option
              .setName('game')
              .setDescription('Which game this channel speaks for')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName('unbind').setDescription('Unbind this channel (Organizer only)')
      )
      .addSubcommand((sub) =>
        sub.setName('info').setDescription('What game this channel is bound to')
      )
  },

  /** Autocomplete over the caller's own games — never anybody else's. */
  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    const client = itun()
    if (client === null) {
      await interaction.respond([])
      return
    }

    const result = await client.games(interaction.user.id)
    if (result.kind !== 'ok') {
      await interaction.respond([])
      return
    }

    const focused = interaction.options.getFocused().toLowerCase()
    await interaction.respond(
      result.value.games
        .filter((game) => game.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map((game) => ({ name: game.name, value: game.gameId }))
    )
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'bind':
        return bind(interaction)
      case 'unbind':
        return unbind(interaction)
      case 'info':
        return info(interaction)
      default:
        throw new Error(`Unknown /su game subcommand: ${interaction.options.getSubcommand()}`)
    }
  },
}

/**
 * Bind, then announce it in the channel.
 *
 * The confirmation is deliberately **public** even though the command's own
 * reply is not: binding changes what the channel means for everyone in it —
 * from here on, rolls made here land in somebody's campaign history — and a
 * change of that kind should not happen invisibly.
 */
async function bind(interaction: CommandExecuteInteraction): Promise<void> {
  const channelId = await requireChannel(interaction)
  if (channelId === null) return

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  const client = itun()
  if (client === null) {
    await interaction.editReply({ content: SOLO_NOTICE })
    return
  }

  const gameId = interaction.options.getString('game', true)
  const result = await client.bind(interaction.user.id, channelId, gameId)

  if (result.kind === 'denied') {
    await interaction.editReply({
      content: denialMessage(result.reason, config.itunWebUrl, result.message),
    })
    return
  }
  if (result.kind === 'unavailable') {
    await interaction.editReply({ content: result.message })
    return
  }

  await interaction.editReply({ content: `Bound to **${result.value.name}**.` })
  await interaction.followUp({
    content: `This channel is now the table for **${result.value.name}**. Rolls made here are recorded to its history.`,
  })
}

async function unbind(interaction: CommandExecuteInteraction): Promise<void> {
  const channelId = await requireChannel(interaction)
  if (channelId === null) return

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  const client = itun()
  if (client === null) {
    await interaction.editReply({ content: SOLO_NOTICE })
    return
  }

  const result = await client.unbind(interaction.user.id, channelId)
  if (result.kind === 'denied') {
    await interaction.editReply({
      content: denialMessage(result.reason, config.itunWebUrl, result.message),
    })
    return
  }
  if (result.kind === 'unavailable') {
    await interaction.editReply({ content: result.message })
    return
  }
  await interaction.editReply({ content: 'This channel is no longer bound to a game.' })
}

async function info(interaction: CommandExecuteInteraction): Promise<void> {
  const channelId = await requireChannel(interaction)
  if (channelId === null) return

  await respondWithItun(interaction, {
    visibility: 'public',
    call: (client) => client.channel(interaction.user.id, channelId),
    render: (value) => buildChannelEmbed(value, config.itunWebUrl),
  })
}

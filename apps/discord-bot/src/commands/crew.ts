import { MessageFlags, type SlashCommandSubcommandBuilder } from 'discord.js'

import { config } from '../config.js'
import { buildCrewEmbed, buildSheetEmbed } from '../gameEmbed.js'
import type { EntityBody } from '../itun/types.js'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'
import { itun, respondWithItun } from './itunReply.js'

/**
 * `/su crew` and `/su sheet` — the table's read surfaces (ADR-030 Phase 6).
 *
 * `/su crew` is **public**: a crew board only pays for itself if the table sees
 * it, which is the whole reason to render vitals in chat rather than ask
 * everyone to alt-tab. `/su sheet` is **ephemeral**, because reading somebody
 * else's sheet is "lean over and look", not "show everyone".
 *
 * Neither writes anything. ADR-030 §4 forbids a Mediator writing another
 * player's sheet on any surface, so there is deliberately no `/su damage` here
 * — that becomes a proposal or it does not exist.
 */

/** A channel is what decides which Game a command speaks for. */
const NO_CHANNEL = 'This command has to be run in a channel.'

export const crewCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('crew').setDescription('This channel’s game, at a glance')
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const channelId = interaction.channelId
    if (channelId === null) {
      await interaction.reply({ content: NO_CHANNEL, flags: MessageFlags.Ephemeral })
      return
    }

    await respondWithItun(interaction, {
      visibility: 'public',
      call: (client) => client.crew(interaction.user.id, channelId),
      render: (value) => buildCrewEmbed(value, config.itunWebUrl),
    })
  },
}

/** Name an entity for the autocomplete list, tolerating an opaque body. */
function entityLabel(body: EntityBody, keys: string[]): string {
  for (const key of keys) {
    const value = body[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return 'Unnamed'
}

export const sheetCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('sheet')
      .setDescription('Read a crewmate’s sheet (read-only)')
      .addStringOption((option) =>
        option
          .setName('entity')
          .setDescription('Whose sheet to read')
          .setRequired(true)
          .setAutocomplete(true)
      )
  },

  /**
   * Autocomplete over what is actually in this channel's Game.
   *
   * Sourced from the same `crew` call the board uses, so the picker can only
   * ever offer entities the caller is already entitled to read — the
   * authorization is not re-implemented here, it is inherited by construction.
   * Every failure yields an empty list: an autocomplete has no way to explain
   * itself, and Discord renders "no options" perfectly well.
   */
  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    const channelId = interaction.channelId
    const client = itun()
    if (client === null || channelId === null) {
      await interaction.respond([])
      return
    }

    const result = await client.crew(interaction.user.id, channelId)
    if (result.kind !== 'ok') {
      await interaction.respond([])
      return
    }

    const focused = interaction.options.getFocused().toLowerCase()
    const choices = [
      ...result.value.pilots.map((p) => ({
        name: `${entityLabel(p.body, ['callsign', 'name'])} — pilot`,
        value: `pilots:${p.id}`,
      })),
      ...result.value.mechs.map((m) => ({
        name: `${entityLabel(m.body, ['name'])} — mech`,
        value: `mechs:${m.id}`,
      })),
    ]
      .filter((choice) => choice.name.toLowerCase().includes(focused))
      .slice(0, 25) // Discord's hard cap on choices.

    await interaction.respond(choices)
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const channelId = interaction.channelId
    if (channelId === null) {
      await interaction.reply({ content: NO_CHANNEL, flags: MessageFlags.Ephemeral })
      return
    }

    // The autocomplete value is `<table>:<id>`, but a user may type anything
    // into an autocomplete field, so this is parsed rather than trusted.
    const raw = interaction.options.getString('entity', true)
    const separator = raw.indexOf(':')
    const table = raw.slice(0, separator)
    const entityId = raw.slice(separator + 1)
    if ((table !== 'pilots' && table !== 'mechs') || entityId.length === 0) {
      await interaction.reply({
        content: 'Pick an entity from the list rather than typing a name.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    await respondWithItun(interaction, {
      call: (client) => client.sheet(interaction.user.id, channelId, table, entityId),
      render: (value) => buildSheetEmbed(value, config.itunWebUrl),
    })
  },
}

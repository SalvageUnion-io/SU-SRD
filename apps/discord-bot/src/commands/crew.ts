import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord-api-types/v10'
import { bodyName, crewCard, sheetCard } from '../gameCards'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions'
import { itun, requireChannel, respondWithItun } from './itunReply'

/**
 * `/su crew` and `/su sheet` — the table's read surfaces (ADR-030).
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

export const crewCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return (
      sub
        .setName('crew')
        .setDescription('This channel’s Game, at a glance')
        // Bars are a glance for sighted readers and ten announcements for a
        // screen reader, so the numbers-and-words form is one option away.
        .addBooleanOption((option) =>
          option
            .setName('text-only')
            .setDescription('Numbers and words only, without bar glyphs')
            .setRequired(false)
        )
    )
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const channelId = await requireChannel(interaction)
    if (channelId === null) return

    const style = interaction.options.getBoolean('text-only') === true ? 'text' : 'bars'
    await respondWithItun(interaction, {
      visibility: 'public',
      call: (client) => client.crew(interaction.user.id, channelId),
      render: (value) => crewCard(value, style),
    })
  },
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
    if (channelId === null) {
      await interaction.respond([])
      return
    }

    const result = await itun().crewForAutocomplete(interaction.user.id, channelId)
    if (result.kind !== 'ok') {
      await interaction.respond([])
      return
    }

    const focused = interaction.options.getFocused().toLowerCase()
    const choices = [
      ...result.value.pilots.map((p) => ({
        name: `${bodyName(p.body, ['callsign', 'name'])} — pilot`,
        value: `pilots:${p.id}`,
      })),
      ...result.value.mechs.map((m) => ({
        name: `${bodyName(m.body, ['name'])} — mech`,
        value: `mechs:${m.id}`,
      })),
      // The crawler is communal: at most one, owned by nobody.
      ...(result.value.crawler === null
        ? []
        : [
            {
              name: `${bodyName(result.value.crawler.body, ['name'])} — crawler`,
              value: `crawlers:${result.value.crawler.id}`,
            },
          ]),
    ]
      .filter((choice) => choice.name.toLowerCase().includes(focused))
      .slice(0, 25) // Discord's hard cap on choices.

    await interaction.respond(choices)
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const channelId = await requireChannel(interaction)
    if (channelId === null) return

    // The autocomplete value is `<table>:<id>`, but a user may type anything
    // into an autocomplete field, so this is parsed rather than trusted.
    const raw = interaction.options.getString('entity', true)
    const separator = raw.indexOf(':')
    // Checked, not assumed: `indexOf` returns -1 with no colon, and slicing on
    // that silently yields `raw.slice(0, -1)` — so `mechsX` would parse as
    // table `mechs` and be sent to the server, surfacing a typo as "In The
    // Union Now could not be reached" rather than as "pick from the list".
    const table = separator === -1 ? '' : raw.slice(0, separator)
    const entityId = separator === -1 ? '' : raw.slice(separator + 1)
    if (
      (table !== 'pilots' && table !== 'mechs' && table !== 'crawlers') ||
      entityId.length === 0
    ) {
      await interaction.reply({
        content: 'Pick an entity from the list rather than typing a name.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    // EPHEMERAL, ALWAYS — never `visibility: 'public'`.
    //
    // Most sheets are private (ADR-032 makes a public URL opt-in and off by
    // default), so a public reply would post a sheet into the channel that has
    // no shareable page behind it: readers would see somebody's build, and any
    // link they tried to follow would 404. Reading is private; publishing is
    // the owner's separate, deliberate act.
    //
    // The default here is ephemeral, so this is a comment rather than a flag —
    // and `sheetVisibility.test.ts` holds it, because "someone adds
    // visibility: 'public' to make sharing easier" is exactly the plausible
    // future change that would break it silently.
    await respondWithItun(interaction, {
      call: (client) => client.sheet(interaction.user.id, channelId, table, entityId),
      render: (value) => sheetCard(value),
    })
  },
}

import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { v2Reply } from '../container'
import { buildScreenData } from '../screenContainer'
import type { CommandExecuteInteraction } from './interactions'

/**
 * `/su screen` — the Mediator Screen: the d20 tables the Quick Reference Sheet
 * gathers on its first page, each by its bands and a button that rolls it.
 * The SRD's `/screen/` is the same screen on one page, with Heat, the
 * distances and the Downtime procedure beside the tables.
 *
 * The screen answers only to whoever asked: it sits behind the Mediator's
 * screen. Its buttons roll in the channel, as `/su roll` does, unless the
 * screen was asked for `private`, when they answer privately too, each with
 * its `Post to channel`. Every button is the asker's alone
 * (`encodeRollRequest`).
 */

export const screenCommand = {
  /** Options for the `/su screen` subcommand (registered by su.ts). */
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('screen')
      .setDescription('The Mediator Screen: the at-the-table tables, each a button to roll')
      .addBooleanOption((option) =>
        option
          .setName('private')
          .setDescription('Roll behind the screen: results only to you, with a button to post them')
          .setRequired(false)
      )
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const isPrivate = interaction.options.getBoolean('private') === true
    const data = buildScreenData(interaction.user.id, isPrivate)
    await interaction.reply(v2Reply(data, true))
  },
}

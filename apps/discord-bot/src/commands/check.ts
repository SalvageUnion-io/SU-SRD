/**
 * `/su check` — free-form dice rolling. The single most-used feature of any
 * RPG dice bot: `2d6+3`, `1d20+5`, `4d6L`, exploding dice, advantage, etc.
 *
 * The bot is already built on @randsum/roller, so we pass the user's raw
 * notation string STRAIGHT into `roll()` and let randsum be the source of truth
 * for what's valid — the full RANDSUM grammar (drop/keep, reroll, explode,
 * arithmetic, Fate, percentile…), not a hand-rolled allowlist. `roll()` throws
 * on anything it can't parse; we catch that and reply with an ephemeral error
 * rather than crashing.
 */

import {
  type ActionRowBuilder,
  type ButtonBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type SlashCommandSubcommandBuilder,
} from 'discord.js'
import { roll } from '@randsum/roller'
import type { DiceNotation, RollerRollResult } from '@randsum/roller'

import { rollAgainRow } from '../customId.js'
import { BRAND_NAME, ROLL_EMBED_FOOTER, buildCheckEmbedData } from '../format.js'

/** A message payload ready for `interaction.reply`, or a user-facing error. */
export type CheckMessage =
  | { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }
  | { error: string }

/**
 * Parse + roll a free-form notation string and shape the result into a reply.
 * Shared by the slash `/su check` handler and the "Roll again" button router.
 * Randsum owns validity — a throw becomes a clean, user-facing error string.
 */
export function buildCheckMessage(notation: string, iconURL?: string): CheckMessage {
  let result: RollerRollResult<unknown>
  try {
    // Randsum's parameter type is the DiceNotation template literal, but the
    // whole point is to accept arbitrary user input and let randsum validate it
    // at runtime — so we hand it the raw string and cast. An unparseable string
    // throws, caught below; we never pre-validate with our own grammar.
    result = roll(notation as DiceNotation)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'not valid dice notation'
    return {
      error: `Could not roll \`${notation}\`: ${reason}\nTry standard notation like \`2d6+3\`, \`1d20+5\`, or \`4d6L\`.`,
    }
  }

  const data = buildCheckEmbedData(notation, result)
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setColor(data.color)
    .addFields(data.fields)
    .setFooter({ text: ROLL_EMBED_FOOTER })
    .setTimestamp()
  if (data.description) {
    embed.setDescription(data.description)
  }
  if (iconURL) embed.setAuthor({ name: BRAND_NAME, iconURL })

  const row = rollAgainRow('check', notation, 'Roll again')
  return { embeds: [embed], components: row ? [row] : [] }
}

export const checkCommand = {
  /** Options for the `/su check` subcommand (registered by su.ts). */
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('check')
      .setDescription('Roll dice with RANDSUM notation (e.g. 2d6+3, 1d20+5, 4d6L)')
      .addStringOption((option) =>
        option
          .setName('dice')
          .setDescription(
            'Dice notation, e.g. 2d6+3, 1d20+5, 4d6L (drop lowest), 2d20H (advantage)'
          )
          .setRequired(true)
      )
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const notation = interaction.options.getString('dice', true)
    const message = buildCheckMessage(notation, interaction.client.user?.displayAvatarURL())
    if ('error' in message) {
      await interaction.reply({ content: message.error, flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.reply(message)
  },
}

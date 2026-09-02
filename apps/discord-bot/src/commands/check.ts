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

import type { ContainerBuilder } from '@discordjs/builders'
import type { DiceNotation, RollerRollResult } from '@randsum/roller'
import { roll } from '@randsum/roller'
import type { SlashCommandSubcommandBuilder } from 'discord.js'
import { ButtonStyle, MessageFlags } from 'discord-api-types/v10'
import type { ContainerData } from '../container.js'
import { toContainer } from '../container.js'
import { makeCustomId } from '../customId.js'
import { buildCheckContainerData } from '../rollContainer.js'
import type { CommandExecuteInteraction } from './interactions.js'
import { attributeRoll } from './rollAttribution.js'

/** A message payload ready for `interaction.reply`, or a user-facing error. */
export type CheckMessage =
  | { flags: MessageFlags.IsComponentsV2; components: [ContainerBuilder]; data: ContainerData }
  | { error: string }

/**
 * Parse + roll a free-form notation string and shape the result into a reply.
 * Shared by the slash `/su check` handler and the "Roll again" button router.
 * Randsum owns validity — a throw becomes a clean, user-facing error string.
 */
export function buildCheckMessage(notation: string, roller?: string): CheckMessage {
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

  const data = buildCheckContainerData(notation, result, { roller })
  const rerollId = makeCustomId('check', notation)
  if (rerollId) {
    data.blocks.push({
      kind: 'buttons',
      buttons: [
        { kind: 'action', customId: rerollId, label: '↻ Roll again', style: ButtonStyle.Primary },
      ],
    })
  }
  return { flags: MessageFlags.IsComponentsV2, components: [toContainer(data)], data }
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

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const notation = interaction.options.getString('dice', true)
    const message = buildCheckMessage(notation, interaction.user.displayName)
    if ('error' in message) {
      await interaction.reply({ content: message.error, flags: MessageFlags.Ephemeral })
      return
    }
    const { data, ...payload } = message
    await interaction.reply(payload)
    // See rollAttribution.ts — after the reply, silent on failure.
    await attributeRoll(interaction, data, `Rolled ${notation}`, { notation })
  },
}

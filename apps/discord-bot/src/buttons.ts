/**
 * Button interaction router. `interactionCreate` dispatches every `isButton()`
 * component here; we parse the namespaced customId (see customId.ts) and
 * re-invoke the matching roll, replying with a fresh message that carries its
 * own "Roll again" button so the chain continues indefinitely.
 *
 * Stateless: every button re-rolls from the payload alone, so an old message's
 * button keeps working with no backend. A reply — not an update — keeps each
 * roll in the channel history, matching how a dice bot is expected to behave.
 */

import { MessageFlags } from 'discord.js'
import { buildCheckMessage } from './commands/check.js'
import type { CommandButtonInteraction } from './commands/interactions.js'
import { buildTableLookupMessage } from './commands/lookup.js'
import { buildRollMessage } from './commands/roll.js'
import { attributeRoll } from './commands/rollAttribution.js'
import { parseCustomId } from './customId.js'

export async function handleButtonInteraction(
  interaction: CommandButtonInteraction
): Promise<void> {
  const parsed = parseCustomId(interaction.customId)
  if (!parsed) {
    // Not one of our buttons, or a malformed id — nothing we can act on.
    await interaction.reply({
      content: 'This button is no longer supported.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  // Brand re-rolled / looked-up embeds with the bot's own avatar, same as the
  // slash-command replies.
  const iconURL = interaction.client.user?.displayAvatarURL()
  const message =
    parsed.action === 'roll'
      ? buildRollMessage(parsed.payload, iconURL)
      : parsed.action === 'check'
        ? buildCheckMessage(parsed.payload, iconURL)
        : buildTableLookupMessage(parsed.payload, iconURL)

  if ('error' in message) {
    await interaction.reply({ content: message.error, flags: MessageFlags.Ephemeral })
    return
  }

  await interaction.reply(message)

  // A re-roll is a roll. Recording only the slash-command form would mean the
  // Change Log quietly disagreed with the channel about what happened at the
  // table — and "why is my re-roll missing?" is a worse question than any this
  // saves. `lookup` is not a roll and is deliberately excluded.
  if (parsed.action === 'roll' || parsed.action === 'check') {
    const description =
      parsed.action === 'roll' ? `Rolled on ${parsed.payload}` : `Rolled ${parsed.payload}`
    await attributeRoll(interaction, message.embeds, description, { rerolled: parsed.payload })
  }
}

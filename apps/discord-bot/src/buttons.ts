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

import { MessageFlags, type ButtonInteraction } from 'discord.js'

import { buildCheckMessage } from './commands/check.js'
import { buildRollMessage } from './commands/roll.js'
import { parseCustomId } from './customId.js'

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId)
  if (!parsed) {
    // Not one of our buttons, or a malformed id — nothing we can act on.
    await interaction.reply({
      content: 'This button is no longer supported.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const message =
    parsed.action === 'roll' ? buildRollMessage(parsed.payload) : buildCheckMessage(parsed.payload)

  if ('error' in message) {
    await interaction.reply({ content: message.error, flags: MessageFlags.Ephemeral })
    return
  }

  await interaction.reply(message)
}

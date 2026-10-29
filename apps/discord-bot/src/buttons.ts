/**
 * Button interaction router. The Worker (`worker/index.ts`) dispatches every
 * message-component interaction here; we parse the namespaced customId (see customId.ts) and
 * re-invoke the matching roll, replying with a fresh message that carries its
 * own "Roll again" button so the chain continues indefinitely.
 *
 * Stateless: every button re-rolls from the payload alone, so an old message's
 * button keeps working with no backend. A reply — not an update — keeps each
 * roll in the channel history, matching how a dice bot is expected to behave.
 */

import { MessageFlags } from 'discord-api-types/v10'
import type { CommandButtonInteraction } from './commands/interactions'
import type { LookupMessage } from './commands/lookup'
import { buildLookupMessage, buildTableLookupMessage } from './commands/lookup'
import { buildPostedRollMessage, buildRollMessage, buildSeeTableMessage } from './commands/roll'
import { v2Reply } from './container'
import { decodeRollRequest, parseCustomId } from './customId'
import { dieForTable } from './dice'
import { entityFromKey, openCard, readCard } from './lookupCard'

/**
 * A `su:lookup` payload: an entry key (`schemaName::slug`, from "Post to
 * channel" on a found term) or, as every older button carries, a table name.
 */
function lookupFromPayload(payload: string): LookupMessage {
  if (!payload.includes('::')) return buildTableLookupMessage(payload)
  const hit = entityFromKey(payload)
  return hit ? buildLookupMessage(hit) : { error: 'That entry is no longer in the reference.' }
}

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

  // Name the roller on the re-roll, same as the slash-command replies. This is
  // the interaction where it matters most: Discord's own "used /su roll" header
  // attributes a component reply far more weakly than a slash command.
  const roller = interaction.user.displayName

  // `post` re-renders a private roll publicly. It replays the ENCODED result
  // rather than rolling again, so what reaches the channel is provably the
  // outcome the player was looking at when they pressed the button.
  if (parsed.action === 'post') {
    const posted = buildPostedRollMessage(parsed.payload, roller, interaction.user.id)
    if ('error' in posted) {
      await interaction.reply({ content: posted.error, flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.reply(posted)
    return
  }

  // A long card's Read button: that one action, privately, so the channel
  // keeps the short card. Anyone may press it; nothing is recorded.
  if (parsed.action === 'read') {
    const read = readCard(parsed.payload)
    if (!read) {
      await interaction.reply({
        content: 'That entry is no longer in the reference.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    await interaction.reply(v2Reply(read, true))
    return
  }

  // A lookup card's linked-entries menu: the picked entry's card, privately,
  // so the channel keeps the one card. Anyone may pick; nothing is recorded.
  if (parsed.action === 'open') {
    const picked = interaction.values[0]
    const open = picked ? openCard(picked) : null
    if (!open) {
      await interaction.reply({
        content: 'That entry is no longer in the reference.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    await interaction.reply(v2Reply(open, true))
    return
  }

  // `table` answers privately and is not a roll: nothing to record.
  if (parsed.action === 'table') {
    const seen = buildSeeTableMessage(parsed.payload, roller)
    if ('error' in seen) {
      await interaction.reply({ content: seen.error, flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.reply(seen)
    return
  }

  // A re-roll belongs to whoever rolled: anyone else is told, privately, how
  // to roll it themselves. A button with no owner (one posted before this, or
  // the lookup card's "Roll the Die", a first roll) is open to anyone.
  const request = parsed.action === 'roll' ? decodeRollRequest(parsed.payload) : null
  if (request?.ownerId !== undefined && request.ownerId !== interaction.user.id) {
    await interaction.reply({
      content: `Only the person who rolled can roll this again. Roll it yourself with \`/su roll table: ${request.tableName}\`.`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  // Always a NEW message: a roll is never redrawn in place, so every roll
  // stays in the channel's history (and in the Game's log).
  const message = request
    ? buildRollMessage(
        request.tableName,
        roller,
        await dieForTable(request.tableName),
        // A re-roll shares its first roll's status: private stays private.
        request.isPrivate,
        interaction.user.id
      )
    : lookupFromPayload(parsed.payload)

  if ('error' in message) {
    await interaction.reply({ content: message.error, flags: MessageFlags.Ephemeral })
    return
  }

  await interaction.reply(message)
}

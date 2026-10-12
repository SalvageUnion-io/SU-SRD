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
import { attributeRoll } from './commands/rollAttribution'
import type { ContainerData } from './container'
import { toContainer } from './container'
import { decodeRollRequest, parseCustomId } from './customId'
import { dieForTable } from './dice'
import { entityCard, entityFromKey, patternOf, viewPayloadKey } from './lookupCard'

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
    const { data, ...payload } = posted
    await interaction.reply(payload)
    await attributeRoll(interaction, data, `Rolled on ${data.tableName}`, {
      table: data.tableName,
      posted: true,
    })
    return
  }

  // An older message's tab or page: the lookup has no tabs now, so it redraws
  // the entry's one card, for everyone who sees it. Nothing new is posted.
  if (parsed.action === 'view') {
    const key = viewPayloadKey(parsed.payload)
    const hit = key ? entityFromKey(key) : null
    if (!hit) {
      await interaction.reply({
        content: 'That entry is no longer in the reference.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    const { data: _data, ...payload } = buildLookupMessage(hit)
    await interaction.update(payload)
    return
  }

  // An older message's pattern picker: the picked pattern's own card, privately
  // — read-only and terminal, so it carries no controls of its own.
  if (parsed.action === 'peek') {
    const hit = entityFromKey(parsed.payload)
    const pattern =
      hit && interaction.values[0] ? patternOf(hit.entity, interaction.values[0]) : null
    const peek = hit && pattern ? entityCard({ ...hit, pattern }) : null
    if (!peek) {
      await interaction.reply({
        content: 'That pattern is no longer in the reference.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    await interaction.reply({
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      components: [toContainer(peek)],
    })
    return
  }

  // `table` answers privately and is not a roll: nothing to record.
  if (parsed.action === 'table') {
    const seen = buildSeeTableMessage(parsed.payload, roller)
    if ('error' in seen) {
      await interaction.reply({ content: seen.error, flags: MessageFlags.Ephemeral })
      return
    }
    const { data: _data, ...payload } = seen
    await interaction.reply(payload)
    return
  }

  // A re-roll belongs to whoever rolled: anyone else is told, privately, how
  // to roll it themselves. A button with no owner (one posted before this, or
  // the lookup card's "Roll on this table", a first roll) is open to anyone.
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

  // `data` rides along on every V2 payload so attributeRoll can rebuild the
  // container; a lookup is not a roll, so its copy is simply unused.
  // `ephemeral` is ours, not Discord's: the flags already carry it.
  const {
    data,
    ephemeral: _ephemeral,
    ...payload
  } = message as typeof message & { data?: ContainerData; ephemeral?: true }
  await interaction.reply(payload)

  // A re-roll is a roll. Recording only the slash-command form would mean the
  // Change Log quietly disagreed with the channel about what happened at the
  // table — and "why is my re-roll missing?" is a worse question than any this
  // saves. `lookup` is not a roll and is deliberately excluded.
  // A private roll has not happened at the table until it is posted, so,
  // like `/su roll private`, its re-roll records nothing yet.
  if (request && !request.isPrivate && data !== undefined) {
    await attributeRoll(interaction, data, `Rolled on ${request.tableName}`, {
      rerolled: request.tableName,
    })
  }
}

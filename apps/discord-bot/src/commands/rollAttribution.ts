import type { EmbedBuilder } from 'discord.js'

import { ROLL_EMBED_FOOTER } from '../format.js'
import { captureException } from '../observability.js'
import { itun } from './itunReply.js'

/**
 * Recording a Discord roll against the bound Game (ADR-030 Phase 6).
 *
 * This is issue #623's exit criterion — *"a roll in Discord appears on the
 * table's Dashboard, attributed to the right player"* — and it is deliberately
 * **not a command**. `/su roll` and `/su check` gain no option and no flag; in
 * a bound channel their footer simply grows ` · recorded to Tenacity`. A
 * separate `/su gameroll` would be a worse product and a second thing to teach.
 *
 * ## Why the reply is not deferred
 *
 * A dice bot must feel instant, and the reference commands have to behave
 * identically whether or not accounts exist. So the roll is replied to first,
 * exactly as it always was, and the recording happens afterwards — editing the
 * footer only once it has actually landed. A slow or dead deployment therefore
 * costs a rolling player nothing at all, which is the property that matters:
 * the reference bot is the thing people already use.
 *
 * ## Why failure is silent
 *
 * `resolveActor` cannot distinguish "no account", "not bound" and "not a
 * member" *to the channel* without announcing who has an account. For a roll
 * nobody asked to have recorded, the honest response to all three is to say
 * nothing: the roll still rolled. Commands the user explicitly invoked
 * (`/su crew`) explain themselves ephemerally instead — see `itunReply.ts`.
 */

/** The minimum an interaction must offer to attribute a roll from it. */
export type AttributableInteraction = {
  user: { id: string }
  channelId: string | null
  editReply(payload: { embeds: EmbedBuilder[] }): Promise<unknown>
}

/**
 * Record a roll, and on success re-stamp the embed footer to say so.
 *
 * Never throws and never rejects: it is called after the user already has their
 * roll, so there is no failure here worth surfacing to them. A genuine fault
 * still reaches Sentry.
 */
export async function attributeRoll(
  interaction: AttributableInteraction,
  embeds: EmbedBuilder[],
  description: string,
  result: unknown
): Promise<void> {
  const channelId = interaction.channelId
  const embed = embeds[0]
  if (itun === null || channelId === null || embed === undefined) return

  try {
    const recorded = await itun.recordRoll(interaction.user.id, channelId, description, result)
    if (recorded.kind !== 'ok') return

    embed.setFooter({ text: `${ROLL_EMBED_FOOTER} · recorded to ${recorded.value.game}` })
    await interaction.editReply({ embeds })
  } catch (error) {
    captureException(error, { source: 'roll-attribution' })
  }
}

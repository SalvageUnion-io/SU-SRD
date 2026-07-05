/**
 * Stateless button plumbing for the bot's interactive "Roll again" / "Roll on
 * this table" buttons.
 *
 * Discord message components carry no server state — everything the button
 * handler needs to re-run a roll must ride in the `customId` string (capped at
 * 100 chars by Discord). We namespace every id `su:<action>:<payload>` so it
 * never collides with another bot's components, and parse it back on click.
 *
 * This is a LEAF module: it imports discord.js only. Command handlers import it
 * to attach rows; the button router (`buttons.ts`) imports it to parse ids.
 * Keeping it dependency-free of the command modules avoids an import cycle.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

/** Namespace prefix for every one of this bot's component ids. */
export const CUSTOM_ID_NS = 'su'

/** Discord caps a component customId at 100 characters. */
const CUSTOM_ID_MAX = 100

/**
 * The actions a button can re-invoke. `roll` re-rolls a named Salvage Union
 * table (shared by the roll subcommand's result and the lookup embed's
 * "Roll on this table" button); `check` re-rolls a free-form dice notation.
 */
export type ButtonAction = 'roll' | 'check'

export type ParsedCustomId = { action: ButtonAction; payload: string }

/** Build a namespaced customId, or null if the payload would exceed the cap. */
export function makeCustomId(action: ButtonAction, payload: string): string | null {
  const id = `${CUSTOM_ID_NS}:${action}:${payload}`
  return id.length <= CUSTOM_ID_MAX ? id : null
}

/**
 * Parse a namespaced customId back into its action + payload. Returns null for
 * anything that isn't one of our ids (other bots' components, malformed input).
 * The payload may itself contain `:`, so we split off only the first two
 * segments and re-join the rest.
 */
export function parseCustomId(customId: string): ParsedCustomId | null {
  const parts = customId.split(':')
  if (parts.length < 3 || parts[0] !== CUSTOM_ID_NS) return null
  const action = parts[1]
  if (action !== 'roll' && action !== 'check') return null
  return { action, payload: parts.slice(2).join(':') }
}

/**
 * A single-button action row that re-invokes `action` with `payload` on click.
 * Returns null when the payload can't fit in a customId — the caller then omits
 * the button rather than emitting an invalid component.
 */
export function rollAgainRow(
  action: ButtonAction,
  payload: string,
  label: string
): ActionRowBuilder<ButtonBuilder> | null {
  const customId = makeCustomId(action, payload)
  if (!customId) return null
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🎲')
  return new ActionRowBuilder<ButtonBuilder>().addComponents(button)
}

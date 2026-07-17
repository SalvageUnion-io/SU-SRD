/**
 * Pure embed-shaping helpers for the bot's commands — no discord.js
 * interaction objects, so everything here is unit-testable.
 */

import type { RollerRollResult } from '@randsum/roller'
import type { RollOnTableOutcome } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'

const SUREF_WEB_BASE_URL = 'https://salvageunion.io'

/**
 * Author name stamped on every embed (paired with the bot's own avatar as the
 * icon, resolved at runtime). Consistent branding so replies read as one
 * official app rather than ad-hoc bot output.
 */
export const BRAND_NAME = 'Salvage Union'

/** Neutral SU rust tone for embeds without pass/fail semantics. */
const NEUTRAL_EMBED_COLOR = 0xb7410e

/**
 * Core Mechanic tier color for a d20 roll (20 crit → 1 cascade failure).
 */
export function getColor(roll: number): number {
  if (roll === 20) return 0x00ff00 // Green - Critical success
  if (roll >= 11) return 0x228b22 // Dark green - Success
  if (roll >= 6) return 0xffd700 // Gold - Partial success
  if (roll >= 2) return 0xff4500 // Orange-red - Failure
  return 0x8b0000 // Dark red - Critical failure
}

/** Truncate to Discord's limits without splitting mid-word when possible. */
export function truncate(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max - 1)}…`
}

type EmbedData = {
  title: string
  color: number
  description?: string
  url?: string
  fields: { name: string; value: string; inline: boolean }[]
}

/**
 * Footer for /su roll embeds. Rolls are powered by @randsum/roller, so the
 * roll output carries a "Powered by Randsum.dev" attribution (Discord embed
 * footers are plain text — not clickable — so the URL reads as bare text).
 */
export const ROLL_EMBED_FOOTER = 'Salvage Union Reference · Powered by Randsum.dev'

/** Shape a /roll outcome into embed data (works for flat + columns tables). */
export function buildRollEmbedData(tableName: string, outcome: RollOnTableOutcome): EmbedData {
  if (!outcome.success) {
    return {
      title: `Error rolling on "${tableName}"`,
      color: NEUTRAL_EMBED_COLOR,
      description: outcome.error,
      fields: [],
    }
  }
  if (outcome.kind === 'columns') {
    return {
      title: truncate(outcome.value, 256),
      color: getColor(outcome.entryRoll),
      fields: [
        { name: 'Table', value: tableName, inline: true },
        {
          name: 'Column Roll',
          value: `${outcome.columnRoll} (${outcome.columnKey})`,
          inline: true,
        },
        { name: 'Entry Roll', value: `${outcome.entryRoll} (#${outcome.entryKey})`, inline: true },
      ],
    }
  }
  return {
    title: truncate(outcome.label ?? `Roll: ${outcome.roll}`, 256),
    color: getColor(outcome.roll),
    description: outcome.value ? truncate(outcome.value, 4096) : undefined,
    fields: [
      { name: 'Table', value: tableName, inline: true },
      { name: 'Roll', value: String(outcome.roll), inline: true },
      { name: 'Range', value: outcome.key, inline: true },
    ],
  }
}

/**
 * The most individual dice we spell out in a `/su check` embed. Randsum is the
 * source of truth for what notation is *valid* (it parsed the string fine), but
 * `999d20` is valid and would blow past Discord's field limits — so we cap the
 * rendered dice list, not the roll itself. The total stays exact.
 */
const CHECK_MAX_SHOWN_DICE = 100

/**
 * Shape a free-form `/su check` roll (raw notation passed straight to
 * @randsum/roller) into embed data: echo the parsed notation, list the
 * individual dice, and show the total. Pure — takes the roller result, no
 * discord.js. Uses the neutral tone (2d6 has no d20 pass/fail semantics).
 */
export function buildCheckEmbedData(input: string, result: RollerRollResult<unknown>): EmbedData {
  const notation = result.rolls.map((r) => r.notation).join(', ') || input
  const values = result.values.map((v) => String(v))
  const shown = values.slice(0, CHECK_MAX_SHOWN_DICE)
  const overflow = values.length - shown.length
  const diceLine = shown.length
    ? `${shown.join(', ')}${overflow > 0 ? `, …(+${overflow} more)` : ''}`
    : '—'
  const descriptions = result.rolls.flatMap((r) => r.description)
  return {
    title: truncate(`🎲 ${input}`, 256),
    color: NEUTRAL_EMBED_COLOR,
    description: descriptions.length ? truncate(descriptions.join('\n'), 4096) : undefined,
    fields: [
      { name: 'Notation', value: truncate(notation, 1024), inline: true },
      { name: 'Total', value: String(result.total), inline: true },
      { name: 'Dice', value: truncate(diceLine, 1024), inline: false },
    ],
  }
}

/** Item-page URL on the reference site (matches srd staticPaths). */
export function entityUrl(schemaName: string, entity: SURefEntity): string {
  return `${SUREF_WEB_BASE_URL}/schema/${schemaName}/item/${getEntitySlug(entity)}`
}

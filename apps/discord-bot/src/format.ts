/**
 * Pure embed-shaping helpers for the bot's commands — no discord.js
 * interaction objects, so everything here is unit-testable.
 */

import type { RollOnTableOutcome } from 'salvageunion-reference'
import { SchemaToDisplayName, getEntitySlug } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'

export const SUREF_WEB_BASE_URL = 'https://salvageunion.io'

/** Neutral SU rust tone for embeds without pass/fail semantics. */
export const NEUTRAL_EMBED_COLOR = 0xb7410e

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
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max - 1)}…`
}

export type EmbedData = {
  title: string
  color: number
  description?: string
  url?: string
  fields: { name: string; value: string; inline: boolean }[]
}

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
        { name: 'Column Roll', value: `${outcome.columnRoll} (${outcome.columnKey})`, inline: true },
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

/** Item-page URL on the reference site (matches suref-web staticPaths). */
export function entityUrl(schemaName: string, entity: SURefEntity): string {
  return `${SUREF_WEB_BASE_URL}/schema/${schemaName}/item/${getEntitySlug(entity)}`
}

/** Shape a /lookup hit into embed data. */
export function buildLookupEmbedData(
  entity: SURefEntity & { schemaName: SURefEnumSchemaName },
  schemaName: SURefEnumSchemaName
): EmbedData {
  const raw = entity as unknown as Record<string, unknown>
  const displayName =
    (SchemaToDisplayName as Record<string, string>)[schemaName] ?? schemaName
  const fields: EmbedData['fields'] = [{ name: 'Type', value: displayName, inline: true }]

  const techLevel = raw['techLevel']
  if (typeof techLevel === 'number' || typeof techLevel === 'string') {
    fields.push({ name: 'Tech Level', value: String(techLevel), inline: true })
  }
  const salvageValue = raw['salvageValue']
  if (typeof salvageValue === 'number') {
    fields.push({ name: 'Salvage Value', value: String(salvageValue), inline: true })
  }
  const slots = raw['slotsRequired']
  if (typeof slots === 'number') {
    fields.push({ name: 'Slots', value: String(slots), inline: true })
  }

  const description =
    typeof raw['description'] === 'string' && raw['description']
      ? raw['description']
      : typeof raw['effect'] === 'string'
        ? raw['effect']
        : ''

  const name = typeof raw['name'] === 'string' ? (raw['name'] as string) : entity.id
  return {
    title: truncate(name, 256),
    color: NEUTRAL_EMBED_COLOR,
    description: description ? truncate(description, 2048) : undefined,
    url: entityUrl(schemaName, entity),
    fields,
  }
}

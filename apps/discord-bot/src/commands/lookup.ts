import type { ActionRowBuilder, ButtonBuilder, SlashCommandSubcommandBuilder } from 'discord.js'
import { EmbedBuilder, MessageFlags } from 'discord.js'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import {
  findEntityBySlug,
  getEntitySlug,
  isSchemaName,
  nameToSlug,
  search,
} from 'salvageunion-reference'
import { rollAgainRow } from '../customId.js'
import { BRAND_NAME } from '../format.js'
import { buildLookupEmbed } from '../lookupEmbed.js'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'

type Hit = {
  schemaName: SURefEnumSchemaName
  entity: SURefEntity & { schemaName: SURefEnumSchemaName }
}

/** A `/su lookup` reply ready for `interaction.reply`, or a user-facing error. */
export type LookupMessage =
  | { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }
  | { error: string }

/**
 * Build the lookup reply for a resolved entity: the rich embed, plus a "Roll on
 * this table" button when the entity is itself a roll-table. Shared by the
 * `/su lookup` slash handler and the roll result's "See table" button.
 */
export function buildLookupMessage(
  entity: SURefEntity & { schemaName: SURefEnumSchemaName },
  schemaName: SURefEnumSchemaName,
  iconURL?: string
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const data = buildLookupEmbed(entity, schemaName)
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setColor(data.color)
    .setFooter({ text: data.footer })
    .setTimestamp()
  if (data.fields.length) embed.addFields(data.fields)
  if (data.url) embed.setURL(data.url)
  if (data.description) embed.setDescription(data.description)
  if (iconURL) embed.setAuthor({ name: BRAND_NAME, iconURL })

  // A roll-table entity IS a rollable table — offer a one-click roll instead of
  // making the user retype `/su roll table: <name>`. Reuses the same stateless
  // `su:roll:<name>` button the roll results carry.
  const tableName = 'name' in entity && entity.name ? String(entity.name) : null
  const row =
    schemaName === 'roll-tables' && tableName
      ? rollAgainRow('roll', tableName, 'Roll on this table')
      : null
  return { embeds: [embed], components: row ? [row] : [] }
}

/**
 * Build the lookup reply for a roll-table addressed by name — what the "See
 * table" button on a `/su roll` result invokes. Resolves the table via its slug
 * (the button carries the exact table name); returns an error if it's gone.
 */
export function buildTableLookupMessage(tableName: string, iconURL?: string): LookupMessage {
  const slug = nameToSlug(tableName)
  const entity = slug ? findEntityBySlug('roll-tables', slug) : null
  if (!entity) {
    return { error: `Could not find table: "${tableName}".` }
  }
  return buildLookupMessage({ ...entity, schemaName: 'roll-tables' }, 'roll-tables', iconURL)
}

/**
 * Stable autocomplete choice value: `schemaName::slug` (well under Discord's
 * 100-char value cap — the longest entity slug in the dataset is 44 chars).
 * search() indexes only non-meta schemas, so every hit has a live page on
 * salvageunion.io to deep-link.
 */
function choiceValue(hit: Hit): string {
  return `${hit.schemaName}::${getEntitySlug(hit.entity)}`
}

function findByChoiceValue(value: string): Hit | null {
  const separator = value.indexOf('::')
  if (separator === -1) return null
  // The choice value round-trips through the Discord client, so validate the
  // schema-name half at runtime rather than asserting — an unknown schema
  // resolves to null exactly as findEntityBySlug would have returned.
  const schemaName = value.slice(0, separator)
  if (!isSchemaName(schemaName)) return null
  const slug = value.slice(separator + 2)
  const entity = findEntityBySlug(schemaName, slug)
  if (!entity) return null
  return { schemaName, entity: { ...entity, schemaName } }
}

export const lookupCommand = {
  /** Options for the `/su lookup` subcommand (registered by su.ts). */
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('lookup')
      .setDescription('Look up any Salvage Union entity (equipment, chassis, systems, keywords, …)')
      .addStringOption((option) =>
        option
          .setName('entity')
          .setDescription('What to look up')
          .setRequired(true)
          .setAutocomplete(true)
      )
  },

  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused()
    if (!focusedValue.trim()) {
      await interaction.respond([])
      return
    }
    const results = search({ query: focusedValue, limit: 25 })
    await interaction.respond(
      results.slice(0, 25).map((hit) => {
        const name =
          'name' in hit.entity && hit.entity.name ? String(hit.entity.name) : hit.entity.id
        return {
          name: name.slice(0, 100),
          value: choiceValue({ schemaName: hit.schemaName, entity: hit.entity }),
        }
      })
    )
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const input = interaction.options.getString('entity', true)

    // Autocomplete selections arrive as `schemaName::slug`; free-typed text
    // falls back to the top search hit.
    let hit = findByChoiceValue(input)
    if (!hit) {
      const [top] = search({ query: input, limit: 1 })
      if (top) hit = { schemaName: top.schemaName, entity: top.entity }
    }

    if (!hit) {
      await interaction.reply({
        content: `No entity found for "${input}". Try the autocomplete suggestions.`,
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    await interaction.reply(
      buildLookupMessage(hit.entity, hit.schemaName, interaction.client.user?.displayAvatarURL())
    )
  },
}

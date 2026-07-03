import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js'
import { search, getEntitySlug, findEntityBySlug } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'

import { buildLookupEmbedData } from '../format.js'

type Hit = { schemaName: SURefEnumSchemaName; entity: SURefEntity & { schemaName: SURefEnumSchemaName } }

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
  const schemaName = value.slice(0, separator) as SURefEnumSchemaName
  const slug = value.slice(separator + 2)
  const entity = findEntityBySlug(schemaName, slug)
  if (!entity) return null
  return { schemaName, entity: { ...entity, schemaName } as Hit['entity'] }
}

export const lookupCommand = {
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('Look up any Salvage Union entity (equipment, chassis, systems, keywords, …)')
    .addStringOption((option) =>
      option
        .setName('entity')
        .setDescription('What to look up')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused()
    if (!focusedValue.trim()) {
      await interaction.respond([])
      return
    }
    const results = search({ query: focusedValue, limit: 25 })
    await interaction.respond(
      results.slice(0, 25).map((hit) => {
        const name = 'name' in hit.entity && hit.entity.name ? String(hit.entity.name) : hit.entity.id
        return {
          name: name.slice(0, 100),
          value: choiceValue({ schemaName: hit.schemaName, entity: hit.entity }),
        }
      })
    )
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
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

    const data = buildLookupEmbedData(hit.entity, hit.schemaName)
    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .setColor(data.color)
      .addFields(data.fields)
      .setFooter({ text: 'Salvage Union Reference' })
      .setTimestamp()
    if (data.url) embed.setURL(data.url)
    if (data.description) embed.setDescription(data.description)

    await interaction.reply({ embeds: [embed] })
  },
}

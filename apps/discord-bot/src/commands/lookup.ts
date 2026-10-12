import type { ContainerBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord-api-types/v10'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { findEntityBySlug, nameToSlug, search } from 'salvageunion-reference'
import type { ContainerData } from '../container.js'
import { toContainer } from '../container.js'
import { noEntryContainer } from '../errorContainer.js'
import type { LookupHit, LookupView } from '../lookupCard.js'
import { entityFromKey, lookupCard, lookupKey } from '../lookupCard.js'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'

/** A `/su lookup` reply ready for `interaction.reply`, or a user-facing error. */
export type LookupMessage =
  | { flags: number; components: [ContainerBuilder]; data: ContainerData }
  | { error: string }

/**
 * Build the lookup reply for a resolved entity, on a tab and page. Shared by
 * the `/su lookup` slash handler, the tab and page buttons (which redraw it),
 * the older "See table" buttons and the message context menu.
 */
export function buildLookupMessage(
  entity: LookupHit['entity'],
  schemaName: SURefEnumSchemaName,
  view?: LookupView
): { flags: number; components: [ContainerBuilder]; data: ContainerData } {
  const data = lookupCard(entity, schemaName, view)
  return { flags: MessageFlags.IsComponentsV2, components: [toContainer(data)], data }
}

/**
 * Build the lookup reply for a roll-table addressed by name — what the "See
 * table" button on a `/su roll` result invokes. Resolves the table via its slug
 * (the button carries the exact table name); returns an error if it's gone.
 */
export function buildTableLookupMessage(tableName: string): LookupMessage {
  const slug = nameToSlug(tableName)
  const entity = slug ? findEntityBySlug('roll-tables', slug) : null
  if (!entity) {
    return { error: `Could not find table: "${tableName}".` }
  }
  return buildLookupMessage({ ...entity, schemaName: 'roll-tables' }, 'roll-tables')
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
          value: lookupKey({
            schemaName: hit.schemaName,
            entity: { ...hit.entity, schemaName: hit.schemaName },
          }),
        }
      })
    )
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const input = interaction.options.getString('entity', true)

    // Autocomplete selections arrive as `schemaName::slug`; free-typed text
    // falls back to the top search hit.
    let hit = entityFromKey(input)
    if (!hit) {
      const [top] = search({ query: input, limit: 1 })
      if (top)
        hit = { schemaName: top.schemaName, entity: { ...top.entity, schemaName: top.schemaName } }
    }

    if (!hit) {
      // An in-system container with the closest entries as buttons, the same
      // way back an unknown roll table offers. Errors are always ephemeral.
      const data = noEntryContainer(input)
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [toContainer(data)],
      })
      return
    }

    const { data: _data, ...payload } = buildLookupMessage(hit.entity, hit.schemaName)
    await interaction.reply(payload)
  },
}

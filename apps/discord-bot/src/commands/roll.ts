import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  type SlashCommandSubcommandBuilder,
} from 'discord.js'
import { roll as rollDie } from '@randsum/roller'
import { SalvageUnionReference, rollOnTable } from 'salvageunion-reference'

import { rollResultRow } from '../customId.js'
import { ROLL_EMBED_FOOTER, buildRollEmbedData } from '../format.js'

// Roll tables load lazily once SalvageUnionReference.preload() has run at startup.
// Accessing them at module load would throw before preload completes, so defer to first use.
let cachedRollTables: ReturnType<typeof SalvageUnionReference.RollTables.all> | null = null
function getRollTables(): ReturnType<typeof SalvageUnionReference.RollTables.all> {
  if (cachedRollTables === null) {
    cachedRollTables = SalvageUnionReference.RollTables.all()
  }
  return cachedRollTables
}

/**
 * Roll a d20
 */
function rollD20(): number {
  return rollDie('1d20').total
}

/** A message payload ready for `interaction.reply`, or a user-facing error. */
export type RollMessage =
  { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } | { error: string }

/**
 * Roll on a named table and shape the result into a reply. Shared by the slash
 * `/su roll` handler and the "Roll again" button router so both produce an
 * identical embed carrying its own re-roll button.
 */
export function buildRollMessage(tableName: string): RollMessage {
  const table = getRollTables().find((t) => t.name.toLowerCase() === tableName.toLowerCase())
  if (!table) {
    return {
      error: `Could not find table: "${tableName}". Use autocomplete to see available tables.`,
    }
  }

  // rollOnTable (salvageunion-reference, ADR-006) owns the flat-vs-columns
  // branch — shared with ITUN's pilot-identity roll buttons.
  const outcome = rollOnTable(table.table, rollD20)
  if (!outcome.success) {
    return { error: `Error rolling on table "${table.name}": ${outcome.error}` }
  }

  const data = buildRollEmbedData(table.name, outcome)
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setColor(data.color)
    .addFields(data.fields)
    .setFooter({ text: ROLL_EMBED_FOOTER })
    .setTimestamp()
  if (data.description) {
    embed.setDescription(data.description)
  }

  const row = rollResultRow(table.name)
  return { embeds: [embed], components: row ? [row] : [] }
}

export const rollCommand = {
  /** Options for the `/su roll` subcommand (registered by su.ts). */
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('roll')
      .setDescription('Roll on a Salvage Union table')
      .addStringOption((option) =>
        option
          .setName('table')
          .setDescription('The table to roll on (defaults to Core Mechanic)')
          .setRequired(false)
          .setAutocomplete(true)
      )
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase()

    const filtered = getRollTables()
      .map((t) => t.name)
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25) // Discord limits to 25 choices

    await interaction.respond(filtered.map((name) => ({ name, value: name })))
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const tableName = interaction.options.getString('table') ?? 'Core Mechanic'
    const message = buildRollMessage(tableName)
    if ('error' in message) {
      await interaction.reply({ content: message.error, flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.reply(message)
  },
}

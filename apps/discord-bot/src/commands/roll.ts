import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js'
import {
  SalvageUnionReference,
  resultForTable,
  resultForColumnsTable,
  isColumnsTable,
} from 'salvageunion-reference'

// Get all roll table names for autocomplete
const rollTables = SalvageUnionReference.RollTables.all()
const rollTableNames = rollTables.map((t) => t.name)

/**
 * Get embed color based on roll result (d20)
 */
function getColor(roll: number): number {
  if (roll === 20) return 0x00ff00 // Green - Critical success
  if (roll >= 11) return 0x228b22 // Dark green - Success
  if (roll >= 6) return 0xffd700 // Gold - Partial success
  if (roll >= 2) return 0xff4500 // Orange-red - Failure
  return 0x8b0000 // Dark red - Critical failure
}

/**
 * Roll a d20
 */
function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

export const rollCommand = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll on a Salvage Union table')
    .addStringOption((option) =>
      option
        .setName('table')
        .setDescription('The table to roll on (defaults to Core Mechanic)')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase()

    const filtered = rollTableNames
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25) // Discord limits to 25 choices

    await interaction.respond(filtered.map((name) => ({ name, value: name })))
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const tableName = interaction.options.getString('table') ?? 'Core Mechanic'

    // Find the table
    const table = rollTables.find((t) => t.name.toLowerCase() === tableName.toLowerCase())

    if (!table) {
      await interaction.reply({
        content: `Could not find table: "${tableName}". Use autocomplete to see available tables.`,
        ephemeral: true,
      })
      return
    }

    // Handle columns-type tables (two d20 rolls)
    if (isColumnsTable(table.table)) {
      const columnRoll = rollD20()
      const entryRoll = rollD20()
      const { success, result, columnKey, entryKey } = resultForColumnsTable(
        table.table,
        columnRoll,
        entryRoll
      )

      if (!success) {
        await interaction.reply({
          content: `Error rolling on table "${table.name}": ${result.value}`,
          ephemeral: true,
        })
        return
      }

      const embed = new EmbedBuilder()
        .setTitle(result.value)
        .setColor(getColor(entryRoll))
        .addFields(
          { name: 'Table', value: table.name, inline: true },
          { name: 'Column Roll', value: `${columnRoll} (${columnKey})`, inline: true },
          { name: 'Entry Roll', value: `${entryRoll} (#${entryKey})`, inline: true }
        )
        .setFooter({ text: 'Salvage Union Reference' })
        .setTimestamp()

      await interaction.reply({ embeds: [embed] })
      return
    }

    // Roll the dice
    const roll = rollD20()

    // Get the result
    const { success, result, key } = resultForTable(table.table, roll)

    if (!success) {
      await interaction.reply({
        content: `Error rolling on table "${table.name}": ${result.value}`,
        ephemeral: true,
      })
      return
    }

    // Build the embed
    const embed = new EmbedBuilder()
      .setTitle(result.label ?? `Roll: ${roll}`)
      .setColor(getColor(roll))
      .addFields(
        { name: 'Table', value: table.name, inline: true },
        { name: 'Roll', value: roll.toString(), inline: true },
        { name: 'Range', value: key, inline: true }
      )

    if (result.value) {
      embed.setDescription(result.value)
    }

    embed.setFooter({ text: 'Salvage Union Reference' })
    embed.setTimestamp()

    await interaction.reply({ embeds: [embed] })
  },
}

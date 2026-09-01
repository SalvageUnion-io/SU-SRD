import type { ContainerBuilder } from '@discordjs/builders'
import { roll as rollDie } from '@randsum/roller'
import type { SlashCommandSubcommandBuilder } from 'discord.js'
import { ButtonStyle, MessageFlags } from 'discord-api-types/v10'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import type { ContainerData } from '../container.js'
import { toContainer } from '../container.js'
import { makeCustomId } from '../customId.js'
import { buildRollContainerData, rollTableUrl } from '../rollContainer.js'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'
import { attributeRoll } from './rollAttribution.js'

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

/**
 * A Components V2 payload ready for `interaction.reply`, or a user-facing
 * error. `data` rides along so `attributeRoll` can rebuild the container with
 * one more line rather than mutating a sent message — see rollAttribution.ts.
 */
export type RollMessage =
  | { flags: MessageFlags.IsComponentsV2; components: [ContainerBuilder]; data: ContainerData }
  | { error: string }

/**
 * Roll on a named table and shape the result into a reply. Shared by the slash
 * `/su roll` handler and the "Roll again" button router so both produce an
 * identical container carrying its own re-roll button.
 */
export function buildRollMessage(tableName: string, roller?: string): RollMessage {
  // Exact name first, through the model's name index; the case-insensitive
  // scan is only the fallback for a hand-typed name that skipped autocomplete.
  const table =
    SalvageUnionReference.RollTables.getByName(tableName) ??
    getRollTables().find((t) => t.name.toLowerCase() === tableName.toLowerCase())
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

  const data = buildRollContainerData(table, outcome, { roller })

  // `Roll again` is Primary now: it is the action people take. `See table` was
  // Primary, which put Discord's loudest, most off-brand colour on the least
  // used control — and it is a Link button now, so it costs no customId at all.
  const rerollId = makeCustomId('roll', table.name)
  data.blocks.push({
    kind: 'buttons',
    buttons: [
      ...(rerollId
        ? [
            {
              kind: 'action' as const,
              customId: rerollId,
              label: '↻ Roll again',
              style: ButtonStyle.Primary,
            },
          ]
        : []),
      { kind: 'link' as const, url: rollTableUrl(table), label: 'See table' },
    ],
  })

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [toContainer(data)],
    data,
  }
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

  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase()

    const filtered = getRollTables()
      .map((t) => t.name)
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25) // Discord limits to 25 choices

    await interaction.respond(filtered.map((name) => ({ name, value: name })))
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const tableName = interaction.options.getString('table') ?? 'Core Mechanic'
    const message = buildRollMessage(tableName, interaction.user.displayName)
    if ('error' in message) {
      await interaction.reply({ content: message.error, flags: MessageFlags.Ephemeral })
      return
    }
    const { data, ...payload } = message
    await interaction.reply(payload)
    // After the reply, never before it: a bound channel adds a footer line, an
    // unbound one costs the roller nothing. See rollAttribution.ts.
    await attributeRoll(interaction, data, `Rolled on ${tableName}`, {
      table: tableName,
    })
  },
}

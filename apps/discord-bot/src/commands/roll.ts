import type { ContainerBuilder } from '@discordjs/builders'
import { roll as rollDie } from '@randsum/roller'
import type { SlashCommandSubcommandBuilder } from 'discord.js'
import { ButtonStyle, MessageFlags } from 'discord-api-types/v10'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import type { ContainerData } from '../container.js'
import { toContainer } from '../container.js'
import { decodeRollResult, encodeRollResult, makeCustomId } from '../customId.js'
import { noEffectContainer, unknownTableContainer } from '../errorContainer.js'
import { buildRollContainerData, rollTableUrl } from '../rollContainer.js'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'
import { attributeRoll } from './rollAttribution.js'

/**
 * An error container, ephemeral. A typo is the asker's problem, not the
 * channel's — the old plain-text errors were ephemeral for the same reason, and
 * that half of them was right.
 */
function ephemeralContainer(data: ContainerData): {
  flags: number
  components: [ContainerBuilder]
  data: ContainerData
} {
  return {
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [toContainer(data)],
    data,
  }
}

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
  | { flags: number; components: [ContainerBuilder]; data: ContainerData; ephemeral?: true }
  | { error: string }

/**
 * Roll on a named table and shape the result into a reply. Shared by the slash
 * `/su roll` handler and the "Roll again" button router so both produce an
 * identical container carrying its own re-roll button.
 */
export function buildRollMessage(
  tableName: string,
  roller?: string,
  /** Injectable for tests; production always uses the real d20. */
  d20: () => number = rollD20,
  /** Render only to the asker, with a button to share the same result. */
  isPrivate = false
): RollMessage {
  // Exact name first, through the model's name index; the case-insensitive
  // scan is only the fallback for a hand-typed name that skipped autocomplete.
  const table =
    SalvageUnionReference.RollTables.getByName(tableName) ??
    getRollTables().find((t) => t.name.toLowerCase() === tableName.toLowerCase())
  if (!table) {
    // An in-system container with tapped recovery, not a dead-end string.
    const data = unknownTableContainer(tableName, getRollTables().length)
    return { ...ephemeralContainer(data), ephemeral: true }
  }

  // rollOnTable (salvageunion-reference, ADR-006) owns the flat-vs-columns
  // branch — shared with ITUN's pilot-identity roll buttons. Capture what was
  // rolled so a miss can be told apart from a malformed table.
  let rolled: number | null = null
  const outcome = rollOnTable(table.table, () => {
    const value = d20()
    rolled ??= value
    return value
  })
  if (!outcome.success) {
    // A `dramatic` table carries only a `20` key, so 19 of every 20 rolls land
    // here. That is not an error — it is "nothing happens", which is what the
    // book means. Only a table with no entries at all is a genuine fault.
    if (rolled !== null && Object.keys(table.table).length > 1) {
      // A miss is a RESULT, so it stays public like any other roll.
      const data = noEffectContainer(table, rolled, roller)
      return { flags: MessageFlags.IsComponentsV2, components: [toContainer(data)], data }
    }
    return { error: `Error rolling on table "${table.name}": ${outcome.error}` }
  }

  const data = buildRollContainerData(table, outcome, { roller })

  // `Roll again` is Primary now: it is the action people take. `See table` was
  // Primary, which put Discord's loudest, most off-brand colour on the least
  // used control — and it is a Link button now, so it costs no customId at all.
  const rerollId = makeCustomId('roll', table.name)
  // The RESULT, not the request. A "post this" button that re-rolled would
  // share a different outcome from the one on screen — silently. See
  // customId.ts. Omitted when the encoded result overflows the 100-char id,
  // which is the rule every other button here already follows.
  const rolls =
    outcome.kind === 'columns' ? [outcome.columnRoll, outcome.entryRoll] : [outcome.roll]
  const postId = isPrivate ? makeCustomId('post', encodeRollResult(table.name, rolls)) : null

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
      ...(postId ? [{ kind: 'action' as const, customId: postId, label: 'Post to channel' }] : []),
      { kind: 'link' as const, url: rollTableUrl(table), label: 'See table' },
    ],
  })

  return {
    flags: isPrivate
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2,
    components: [toContainer(data)],
    data,
    ...(isPrivate ? { ephemeral: true as const } : {}),
  }
}

/**
 * Re-render a private roll publicly, from the result encoded in its button.
 *
 * Replays rather than re-rolls: `resultForTable` is pure, so feeding the same
 * table the same die gives the same entry forever. That is what makes the
 * shared result provably the one the player saw — a button that rolled again
 * would quietly share a different outcome, which is worse than not offering
 * the button at all.
 *
 * Carries no `Post to channel` button of its own; it is already in the channel.
 */
export function buildPostedRollMessage(
  payload: string,
  roller?: string
): (RollMessage & { data: ContainerData & { tableName: string } }) | { error: string } {
  const decoded = decodeRollResult(payload)
  if (decoded === null) return { error: 'That button is no longer readable.' }

  const table =
    SalvageUnionReference.RollTables.getByName(decoded.tableName) ??
    getRollTables().find((t) => t.name.toLowerCase() === decoded.tableName.toLowerCase())
  if (!table) return { error: `Could not find table: "${decoded.tableName}".` }

  // Replay the recorded dice in order — one for a flat table, two for columns.
  const queue = [...decoded.rolls]
  const outcome = rollOnTable(table.table, () => queue.shift() ?? 1)
  if (!outcome.success) return { error: 'That roll can no longer be rendered.' }

  const data = buildRollContainerData(table, outcome, { roller })
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
    data: { ...data, tableName: table.name },
  }
}

export const rollCommand = {
  /** Options for the `/su roll` subcommand (registered by su.ts). */
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return (
      sub
        .setName('roll')
        .setDescription('Roll on a Salvage Union table')
        .addStringOption((option) =>
          option
            .setName('table')
            .setDescription('The table to roll on (defaults to Core Mechanic)')
            .setRequired(false)
            .setAutocomplete(true)
        )
        // Mediator rolls behind the screen, and solo prep. Off by default: a die
        // roll is a social act, and hiding it by default would break the table.
        .addBooleanOption((option) =>
          option
            .setName('private')
            .setDescription('Show the result only to you, with a button to post it')
            .setRequired(false)
        )
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
    const isPrivate = interaction.options.getBoolean?.('private') === true
    const message = buildRollMessage(tableName, interaction.user.displayName, rollD20, isPrivate)
    if ('error' in message) {
      await interaction.reply({ content: message.error, flags: MessageFlags.Ephemeral })
      return
    }
    const { data, ephemeral, ...payload } = message
    await interaction.reply(payload)
    // Nothing to record for an error container, and nothing YET for a private
    // roll — it has not happened at the table until it is posted. The Post to
    // channel button records it then.
    if (ephemeral === true) return
    // After the reply, never before it: a bound channel adds a footer line, an
    // unbound one costs the roller nothing. See rollAttribution.ts.
    await attributeRoll(interaction, data, `Rolled on ${tableName}`, {
      table: tableName,
    })
  },
}

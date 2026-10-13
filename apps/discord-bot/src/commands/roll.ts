import type { ContainerBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { ButtonStyle, MessageFlags } from 'discord-api-types/v10'
import {
  discordAccent,
  discordCard,
  discordCardParts,
  rollOnTable,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerData } from '../container'
import { containerTextLength, V2_LIMIT, v2Reply } from '../container'
import { decodeRollResult, encodeRollRequest, encodeRollResult, makeCustomId } from '../customId'
import { dieForTable, rollD20 } from '../dice'
import { noEffectContainer, unknownTableContainer } from '../errorContainer'
import { buildRollContainerData } from '../rollContainer'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions'
import { attributeRoll } from './rollAttribution'

type RollTable = ReturnType<typeof SalvageUnionReference.RollTables.all>[number]

/**
 * A roll table by name. Exact name first, through the model's name index; the
 * case-insensitive scan is only the fallback for a hand-typed name that skipped
 * autocomplete.
 */
function findRollTable(name: string): RollTable | undefined {
  return (
    SalvageUnionReference.RollTables.getByName(name) ??
    SalvageUnionReference.RollTables.all().find((t) => t.name.toLowerCase() === name.toLowerCase())
  )
}

/**
 * Decode a roll result from a button and replay its recorded dice in order —
 * one for a flat table, two for columns. The outcome is returned unfiltered:
 * each caller decides what a failed or no-effect replay means for it.
 */
function replayResult(payload: string):
  | {
      table: RollTable
      outcome: ReturnType<typeof rollOnTable>
      decoded: NonNullable<ReturnType<typeof decodeRollResult>>
    }
  | { error: string } {
  const decoded = decodeRollResult(payload)
  if (decoded === null) return { error: 'That button is no longer readable.' }
  const table = findRollTable(decoded.tableName)
  if (!table) return { error: `Could not find table: "${decoded.tableName}".` }
  const queue = [...decoded.rolls]
  const outcome = rollOnTable(table.table, () => queue.shift() ?? 1)
  return { table, outcome, decoded }
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
 * The one row every roll result carries: `↻ Roll again` (Primary: it is the
 * action people take) and `See table`, which answers privately with the whole
 * table and this roll's row marked. Both are stateless. `Roll again` carries
 * its roller's id, so only they can press it (`encodeRollRequest`); `See
 * table` carries the RESULT (`encodeRollResult`), so it marks the row on
 * screen, never a new one. A table name too long for either id falls back to
 * the lookup card. Every roll posts a NEW message; none is ever redrawn.
 */
function rollButtons(
  tableName: string,
  result: string,
  /** Who rolled, and whether privately: a re-roll shares the roll's status. */
  owner: { id: string | undefined; isPrivate: boolean },
  between: ButtonSpec[] = []
): ButtonSpec[] {
  const rerollId = makeCustomId('roll', encodeRollRequest(tableName, owner.id, owner.isPrivate))
  const tableId = makeCustomId('table', result) ?? makeCustomId('lookup', tableName)
  return [
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
    ...between,
    ...(tableId ? [{ kind: 'action' as const, customId: tableId, label: 'See table' }] : []),
  ]
}

/**
 * Roll on a named table and shape the result into a reply. Shared by the slash
 * `/su roll` handler and the "Roll again" button router so both produce an
 * identical container carrying its own re-roll button.
 */
export function buildRollMessage(
  tableName: string,
  roller?: string,
  /**
   * The die. Injectable for tests; production passes `dieForTable(tableName)`,
   * which is @randsum/salvageunion's `rollTable` for a named table.
   */
  d20: () => number = rollD20,
  /** Render only to the asker, with a button to share the same result. */
  isPrivate = false,
  /** The roller's Discord id: the only person whose `Roll again` works. */
  ownerId?: string
): RollMessage {
  const table = findRollTable(tableName)
  if (!table) {
    // An in-system container with tapped recovery, not a dead-end string. A
    // typo is the asker's problem, not the channel's, so it is ephemeral.
    const data = unknownTableContainer(tableName, SalvageUnionReference.RollTables.all().length)
    return { ...v2Reply(data, true), data, ephemeral: true }
  }

  // rollOnTable (salvageunion-reference, ADR-006) owns the flat-vs-columns
  // branch and what counts as "no effect" — shared with the SRD and ITUN.
  const outcome = rollOnTable(table.table, d20)
  if (!outcome.success) return { error: `Error rolling on table "${table.name}": ${outcome.error}` }
  if (outcome.kind === 'no-effect') {
    // A `dramatic` table carries only a `20` key, so 19 of every 20 rolls land
    // here. That is not an error — it is "nothing happens", which is what the
    // book means. A miss is a RESULT, so it is as public, or as private, as
    // any roll.
    const data = noEffectContainer(table, outcome.roll, roller, ownerId, isPrivate)
    return { ...v2Reply(data, isPrivate), data, ...(isPrivate ? { ephemeral: true as const } : {}) }
  }

  const data = buildRollContainerData(table, outcome, { roller })

  // The RESULT, not the request. A "post this" button that re-rolled would
  // share a different outcome from the one on screen — silently. See
  // customId.ts. Omitted when the encoded result overflows the 100-char id,
  // which is the rule every other button here already follows.
  const rolls =
    outcome.kind === 'columns' ? [outcome.columnRoll, outcome.entryRoll] : [outcome.roll]
  const result = encodeRollResult(table.name, rolls)
  const postId = isPrivate ? makeCustomId('post', result) : null

  data.blocks.push({
    kind: 'buttons',
    buttons: rollButtons(
      table.name,
      result,
      { id: ownerId, isPrivate },
      postId ? [{ kind: 'action', customId: postId, label: 'Post to channel' }] : []
    ),
  })

  return { ...v2Reply(data, isPrivate), data, ...(isPrivate ? { ephemeral: true as const } : {}) }
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
  roller?: string,
  /** Who posted it: the roller, since only they could see the private roll. */
  ownerId?: string
): (RollMessage & { data: ContainerData & { tableName: string } }) | { error: string } {
  const replayed = replayResult(payload)
  if ('error' in replayed) return replayed
  const { table, outcome } = replayed
  // Only a row is ever posted: a no-effect roll carries no Post button.
  if (!outcome.success || outcome.kind === 'no-effect')
    return { error: 'That roll can no longer be rendered.' }

  const data = buildRollContainerData(table, outcome, { roller })
  // Posted, so public: its re-roll is public too.
  data.blocks.push({
    kind: 'buttons',
    buttons: rollButtons(table.name, payload, { id: ownerId, isPrivate: false }),
  })

  return { ...v2Reply(data), data: { ...data, tableName: table.name } }
}

/**
 * The `See table` answer: the whole table, privately, with the encoded roll's
 * row marked ("ROLLED 14 · Alex") — the d20 map the book prints beside every
 * result. Rendered by the shared Discord card (`discordCardParts`), so it is
 * the same table a `/su lookup` or a pasted salvageunion.io link shows. A table
 * too long for one message sheds whole rows, never the marked one, and links
 * the page.
 */
export function buildSeeTableMessage(
  payload: string,
  roller?: string
): { flags: number; components: [ContainerBuilder]; data: ContainerData } | { error: string } {
  const replayed = replayResult(payload)
  if ('error' in replayed) return replayed
  const { table, outcome, decoded } = replayed
  const markedRow = outcome.success && outcome.kind === 'flat' ? outcome.key : undefined
  const die = decoded.rolls.join('·')
  const rollId = makeCustomId('roll', table.name)
  const buttons: ButtonSpec[] = rollId
    ? [{ kind: 'action', customId: rollId, label: 'Roll on this table' }]
    : []

  const parts = discordCardParts(toEntityModel(table))
  const card = discordCard(parts, {
    ...(markedRow ? { markedRow } : {}),
    markedNote: roller ? `ROLLED ${die} · ${roller}` : `ROLLED ${die}`,
    fits: (candidate) =>
      containerTextLength({ accent: 0, blocks: candidate.blocks }) <= V2_LIMIT.totalText,
  })
  const data: ContainerData = {
    accent: discordAccent(card.tone),
    blocks: [
      ...card.blocks,
      ...(buttons.length > 0 ? [{ kind: 'buttons' as const, buttons }] : []),
    ],
  }
  return { ...v2Reply(data, true), data }
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

    const filtered = SalvageUnionReference.RollTables.all()
      .map((t) => t.name)
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25) // Discord limits to 25 choices

    await interaction.respond(filtered.map((name) => ({ name, value: name })))
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const tableName = interaction.options.getString('table') ?? 'Core Mechanic'
    const isPrivate = interaction.options.getBoolean?.('private') === true
    const message = buildRollMessage(
      tableName,
      interaction.user.displayName,
      await dieForTable(tableName),
      isPrivate,
      interaction.user.id
    )
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

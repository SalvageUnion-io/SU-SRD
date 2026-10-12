/**
 * Error surfaces for the roll commands.
 *
 * These render in the same system as a result, and offer the way out: a bare
 * ephemeral string such as `Could not find table: "criticl damage". Use
 * autocomplete to see available tables.` would be a dead end, telling you to
 * use a feature you have to re-invoke the whole command to reach.
 *
 * ## Errors are rust, never cascade red
 *
 * `--color-roll-cascade` means *you rolled a 1 and the fiction went wrong*.
 * Reusing it for *you typed it wrong* conflates a game event with an input
 * event, and this repo holds colour to one meaning. Rust is the bot's neutral
 * system tone; a typo is a system event.
 */

import { ButtonStyle } from 'discord-api-types/v10'
import type { SURefRollTable } from 'salvageunion-reference'
import { searchIn } from 'salvageunion-reference'
import type { ButtonSpec, ContainerData } from './container.js'
import { encodeRollRequest, makeCustomId } from './customId.js'
import { NEUTRAL_ACCENT } from './format.js'
import { rollHeadline } from './rollContainer.js'

/** How many recovery buttons to offer. Three fits one row without crowding. */
const SUGGESTIONS = 3

/**
 * Buttons that re-run the command with a table the user probably meant.
 *
 * Reuses the existing `su:roll:<name>` custom id and the search index that
 * already backs autocomplete, so a dead end becomes one tap with no new
 * plumbing.
 */
function suggestionButtons(query: string): ButtonSpec[] {
  const hits = searchIn<SURefRollTable>('roll-tables', query, { limit: SUGGESTIONS })
  return hits.flatMap((hit) => {
    const customId = makeCustomId('roll', hit.name)
    return customId ? [{ kind: 'action' as const, customId, label: hit.name }] : []
  })
}

/** `/su roll` could not resolve the table name. */
export function unknownTableContainer(query: string, indexed: number): ContainerData {
  const buttons = suggestionButtons(query)
  return {
    accent: NEUTRAL_ACCENT,
    blocks: [
      { kind: 'text', content: '-# NO SUCH TABLE' },
      { kind: 'text', content: `## ${query.toUpperCase()}` },
      {
        kind: 'text',
        content:
          buttons.length > 0
            ? 'Nothing in the index matches that name. Closest matches:'
            : 'Nothing in the index matches that name.',
      },
      { kind: 'separator' },
      {
        kind: 'text',
        content: `-# ${indexed} tables indexed · start typing in the \`table:\` option for autocomplete`,
      },
      ...(buttons.length > 0 ? [{ kind: 'buttons' as const, buttons }] : []),
    ],
  }
}

/**
 * A roll that matched no entry on a well-formed table.
 *
 * The two `dramatic` tables — Blinding Blue Laser Rifle and Bio-Talon — carry
 * only a `20` key, so `resultForTable` reports failure on **19 of every 20
 * rolls**, with an internal diagnostic ("No result found for roll 7") that is
 * never shown to the user.
 *
 * That is not an error. It is what the book means: the effect triggers on a 20
 * and otherwise nothing happens. Rendered as a result, in neutral rust, because
 * no outcome tier applies to "nothing happened".
 */
export function noEffectContainer(
  table: SURefRollTable,
  roll: number,
  roller?: string,
  /** The roller's Discord id: only they can roll again. */
  ownerId?: string,
  /** A private roll's re-roll is private too. */
  isPrivate = false
): ContainerData {
  const name = table.name.toUpperCase()
  const rerollId = makeCustomId('roll', encodeRollRequest(table.name, ownerId, isPrivate))
  const buttons: ButtonSpec[] = rerollId
    ? [{ kind: 'action', customId: rerollId, label: '↻ Roll again', style: ButtonStyle.Primary }]
    : []

  return {
    accent: NEUTRAL_ACCENT,
    blocks: [
      { kind: 'text', content: roller ? `-# ${name} · rolled by ${roller}` : `-# ${name}` },
      { kind: 'text', content: rollHeadline(String(roll), 'NO EFFECT') },
      { kind: 'separator' },
      { kind: 'text', content: '-# this table only triggers on a 20' },
      ...(buttons.length > 0 ? [{ kind: 'buttons' as const, buttons }] : []),
    ],
  }
}

/**
 * `/su lookup` found nothing. In the same system as a result, as the roll's
 * unknown table is, and pointing at the way in that works. No suggestion
 * buttons: the lookup already falls back to the top search hit, so reaching
 * here means search had nothing to suggest.
 */
export function noEntryContainer(query: string): ContainerData {
  return {
    accent: NEUTRAL_ACCENT,
    blocks: [
      { kind: 'text', content: '-# NO SUCH ENTRY' },
      { kind: 'text', content: `## ${query.toUpperCase()}` },
      { kind: 'text', content: 'Nothing in the reference matches that name.' },
      { kind: 'separator' },
      {
        kind: 'text',
        content: '-# start typing in the `entity:` option for autocomplete',
      },
    ],
  }
}

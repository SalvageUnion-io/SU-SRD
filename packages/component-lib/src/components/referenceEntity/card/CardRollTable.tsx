import type { SURefObjectTable } from 'salvageunion-reference'
import { RollTable } from '../../shared/RollTable'

/**
 * ROLL TABLE — a roll-tables entity's `table` IS the entity: its prose is a
 * one-paragraph preamble and the table is everything the reader came for. The
 * card had been rendering only that preamble, so every roll-table page showed a
 * description and no table at all.
 *
 * A CATALOG tile and any NESTED card get it `collapsible` (header + Roll
 * button, rows behind a Show toggle) so a 20-row table can't swallow a listing
 * tile; a full card renders the whole table open.
 *
 * The table may be INLINE (`table`) or BY REFERENCE (`tableName` -> the
 * `roll-tables` schema), and it may belong to the entity itself or to the
 * action that FOLDS into it — an ability like "System and Software Hacker"
 * keeps its d20 outcomes on its self-named action, by name (`resolveCardTable`).
 * Only the FOLDED action is consulted, never a sibling action: a sibling renders
 * as its own nested card and resolves its own table there, so pulling it up
 * here would print it twice.
 *
 * `showCommand` keeps the header band (and its Roll button) on every rung — the
 * legacy renderer passed it unconditionally, and it is the affordance that makes
 * a roll table a table you can USE. No `tableName`: the card it sits in already
 * carries that name in its header.
 */
export function CardRollTable({
  table,
  compact,
  collapsible,
  disabled,
}: {
  table: SURefObjectTable
  compact: boolean
  collapsible: boolean
  disabled: boolean
}) {
  return (
    <RollTable
      table={table}
      showCommand
      size={compact ? 'compact' : 'full'}
      collapsible={collapsible}
      disabled={disabled}
    />
  )
}

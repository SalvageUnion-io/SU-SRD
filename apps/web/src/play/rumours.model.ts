/**
 * Gather Cantina Rumours' table (r6 D8): solo, and for the Mediator, the roll
 * lands on the Rumour table and says its row, with a link to the table. The
 * book's Rumour table is an adventure's (False Flag p.8); it is the one table
 * the reference names plainly "Rumour". Pure apart from the reference lookup.
 */

import { nameToSlug, resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import { hasPage, itemHref } from '../lib/entityHref'

/** The roll table Cantina Rumours rolls on, by its reference name. */
export const RUMOUR_TABLE = 'Rumour'

/** The Rumour table's row for a d20, verbatim; empty when the table is missing. */
export function rumourRowText(d20: number): string {
  const table = SalvageUnionReference.RollTables.getByName(RUMOUR_TABLE)?.table
  const row = resultForTable(table, d20)
  return row.success ? row.result.value : ''
}

/** Where the Rumour table reads in full, or null where the site has no page for it. */
export function rumourTableHref(): string | null {
  return hasPage('roll-tables') ? itemHref('roll-tables', nameToSlug(RUMOUR_TABLE)) : null
}

import { digestColumnsTable } from 'component-lib'
import type { SURefObjectTable } from 'salvageunion-reference'
import { extractStaticEntitySummary, SalvageUnionReference } from 'salvageunion-reference'
import type { ColumnsTablePageData } from '../lib/columnsTablePage'
import { ColumnsTableView } from './ColumnsTableView'
import { ColumnsTableIsland } from './islands/ColumnsTableIsland'

export default {
  title: 'Compositions/Entity/Columns Table View',
}

/** The Callsign Table, as its page digests it (`columnsTablePageData`). */
function callsigns(): ColumnsTablePageData | null {
  const table = SalvageUnionReference.RollTables.getByName('Callsign Table')
  if (!table) return null
  return {
    name: table.name,
    description: extractStaticEntitySummary(table).contentParagraphs,
    columns: digestColumnsTable(table.table as SURefObjectTable),
  }
}

/**
 * A two-roll table's page before the first roll: the columns' ranges across
 * the head, the entry numbers down both edges. What the server renders.
 */
export const BeforeRolling = () => {
  const data = callsigns()
  return data ? <ColumnsTableView data={data} roll={null} /> : null
}

/** Rolled 11 then 7: column 9–12, entry 7, Silverback, its cell marked. */
export const Rolled = () => {
  const data = callsigns()
  return data ? (
    <ColumnsTableView data={data} roll={{ column: 11, entry: 7 }} onRoll={() => {}} />
  ) : null
}

/** Live: Roll rolls the column's d20, then the entry's; the result is a toast. */
export const Live = () => {
  const data = callsigns()
  return data ? <ColumnsTableIsland data={data} /> : null
}

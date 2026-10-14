import { digestRollTable } from 'component-lib'
import type { SURefObjectTable } from 'salvageunion-reference'
import { extractStaticEntitySummary, SalvageUnionReference } from 'salvageunion-reference'
import type { RollTablePageData } from '../lib/rollTablePage'
import { refText } from '../lib/rollTablePage'
import { RollTableIsland } from './islands/RollTableIsland'
import { RollTableView } from './RollTableView'

export default {
  title: 'Compositions/Entity/Roll Table View',
}

/** The Core Mechanic, as its page digests it (`rollTablePageData`). */
function coreMechanic(): RollTablePageData | null {
  const table = SalvageUnionReference.RollTables.getByName('Core Mechanic')
  if (!table) return null
  const data = table.table as SURefObjectTable
  return {
    name: table.name,
    description: extractStaticEntitySummary(table).contentParagraphs,
    rows: digestRollTable(data).map(({ key, label, value }) => ({
      key,
      label,
      value: refText(value, () => undefined),
    })),
    table: data,
  }
}

/**
 * A roll table's own page (board 08b), before the first roll: the banded d20
 * table with its "ROLL THE DIE:" stamp at the bar's right.
 * This is also what the server renders for a crawler or a no-JS reader.
 */
export const BeforeRolling = () => {
  const data = coreMechanic()
  return data ? <RollTableView data={data} roll={null} /> : null
}

/**
 * Rolled: the matching row in ink with its "Rolled 14" tag at its unrolled
 * height, and the Randsum credit under the table. The result itself is a
 * toast (see Live).
 */
export const Rolled = () => {
  const data = coreMechanic()
  return data ? <RollTableView data={data} roll={14} onRoll={() => {}} /> : null
}

/** Live: Roll rolls a d20 with Randsum, and the result is a toast. */
export const Live = () => {
  const data = coreMechanic()
  return data ? <RollTableIsland data={data} /> : null
}

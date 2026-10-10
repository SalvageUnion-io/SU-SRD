import { digestRollTable } from 'component-lib'
import type { SURefObjectTable } from 'salvageunion-reference'
import { extractStaticEntitySummary, SalvageUnionReference } from 'salvageunion-reference'
import type { RollTablePageData } from '../lib/rollTablePage'
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
    rows: digestRollTable(data).map(({ key, label, value }) => ({ key, label, value })),
    table: data,
  }
}

/**
 * A roll table's own page (board 08b), before the first roll: the banded d20
 * table under its "ROLL THE DIE:" stamp, and the "You rolled" panel waiting.
 * This is also what the server renders for a crawler or a no-JS reader.
 */
export const BeforeRolling = () => {
  const data = coreMechanic()
  return data ? <RollTableView data={data} state={{ roll: null, history: [] }} /> : null
}

/**
 * Rolled, with earlier rolls: the readout (number, the range it lands on, the
 * outcome and its text), the matching row in ink with its "Rolled 14" tag,
 * and the earlier rolls under the Randsum credit. Board 08b's own state.
 */
export const Rolled = () => {
  const data = coreMechanic()
  return data ? (
    <RollTableView
      data={data}
      state={{ roll: 14, history: [7, 20, 3] }}
      onRoll={() => {}}
      typed="14"
    />
  ) : null
}

/** Live: Roll rolls a d20 with Randsum; "Rolled real dice?" records a physical roll. */
export const Live = () => {
  const data = coreMechanic()
  return data ? <RollTableIsland data={data} /> : null
}

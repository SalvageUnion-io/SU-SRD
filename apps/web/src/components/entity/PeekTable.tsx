import type { RefObjectTable } from 'salvageunion-reference'
import { plainTraitText } from 'salvageunion-reference'
import { digestColumnsTable, digestRollTable } from '../compositions/digestRollTable'
import { RollTableInstrument } from '../compositions/RollTableInstrument'
import { InsidePeekContext } from './peekContext'

/**
 * The PEEK of a roll table a record carries (`<schema>:<id>/table`, a folded
 * roll Mini's trigger): the table instrument, its rows open, read-only and
 * terminal (E16). No roll and no toggle, so its bar reads the roll stamp; the
 * Mini it Peeks holds the Roll. Its text is plain: nothing in a Peek links.
 */
export function PeekTable({ name, table }: { name: string; table: RefObjectTable }) {
  return (
    <InsidePeekContext.Provider value={true}>
      <RollTableInstrument
        name={name}
        title={name}
        size="mini"
        frame="box"
        stamp={table.type === 'columns' ? 'Roll the Dice:' : undefined}
        table={
          table.type === 'columns'
            ? { kind: 'columns', columns: digestColumnsTable(table) }
            : {
                kind: 'bands',
                rows: digestRollTable(table).map((row) => ({
                  ...row,
                  value: plainTraitText(row.value),
                })),
              }
        }
      />
    </InsidePeekContext.Provider>
  )
}

import type { RollTablePageData } from '../lib/rollTablePage'
import { rollTableDensity, rowForRoll, splitRows } from '../lib/rollTablePage'
import { RollTableInstrument } from '../ui/index'
import { MentionProse } from './MentionProse'
import { RollPageFrame } from './RollPageFrame'

/**
 * RollTableView — a roll table's page, rolled and read (board 08b).
 *
 * The table is the shared `RollTableInstrument`, the same one every card and
 * guide step draws: its ink head (d20 and Result over the columns, the Roll the
 * Die button at its right), then the bands, banded in the page's tone. A roll
 * marks its row; its result (the number, the range it lands on, the outcome
 * and its text) is a toast, as every roll's is (`RollTableIsland`). The die is
 * not named: it is always a d20. A long or wordy table (`splitRows`) sets its
 * bands in two halves on a wide screen, the ranges on the outer edges, and a
 * wordy page sets tighter (`rollTableDensity`), so the page fits one screen.
 *
 * Presentational, so the server and the island draw the same page: the server
 * renders it with no roll and no handlers (the bands are real content for a
 * crawler or a no-JS reader), and `RollTableIsland` mounts it live.
 */

type RollTableViewProps = {
  data: RollTablePageData
  /** The page's band colour, which the table's rows band in. */
  tone?: string
  /** The roll the table marks, or `null` before the first. */
  roll: number | null
  /** Roll the die. Absent on the server, where the stamp is a plain label. */
  onRoll?: () => void
}

export function RollTableView({ data, tone, roll, onRoll }: RollTableViewProps) {
  const hit = roll === null ? undefined : rowForRoll(data.table, data.rows, roll)
  const density = rollTableDensity(data.rows, data.description)

  return (
    <RollPageFrame density={density} description={data.description}>
      <RollTableInstrument
        name={data.name}
        size="large"
        tone={tone}
        density={density}
        onRoll={onRoll}
        table={{
          kind: 'bands',
          rows: data.rows.map((row) => ({ ...row, value: <MentionProse parts={row.value} /> })),
          mark: hit && roll !== null ? { key: hit.key, roll } : undefined,
          split: splitRows(data.rows),
        }}
      />
    </RollPageFrame>
  )
}

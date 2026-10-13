import { RollTableInstrument } from 'component-lib'
import { NO_EFFECT } from 'salvageunion-reference'
import type { RollState, RollTablePageData } from '../lib/rollTablePage'
import {
  outcomeLabel,
  rangeLabel,
  rollTableDensity,
  rowForRoll,
  splitRows,
} from '../lib/rollTablePage'
import { MentionProse } from './MentionProse'
import { RollPanel } from './RollPanel'

/**
 * RollTableView — a roll table's page, rolled and read (board 08b).
 *
 * The table is the shared `RollTableInstrument`, the same one every card and
 * guide step draws: its bar with the Roll the Die button at its right, then
 * the bands, banded in the page's tone. The page adds only its READOUT: the
 * "You rolled" panel with the number, the range it lands on, the outcome and
 * its text, and the earlier rolls. The table's Roll the Die button is the roll
 * (press it again to roll again); the panel has no button of its own. The die is not named: it is always a d20. A long or wordy table
 * (`splitRows`) sets its bands in two halves on a wide screen, the ranges on
 * the outer edges, and a wordy page sets tighter (`rollTableDensity`), so the
 * page fits one screen.
 *
 * Presentational, so the server and the island draw the same page: the server
 * renders it with no roll and no handlers (the bands are real content for a
 * crawler or a no-JS reader), and `RollTableIsland` mounts it live.
 */

type RollTableViewProps = {
  data: RollTablePageData
  /** The page's band colour, which the table's rows band in. */
  tone?: string
  state: RollState
  /** Roll the die. Absent on the server, where the stamp is a plain label. */
  onRoll?: () => void
}

export function RollTableView({ data, tone, state, onRoll }: RollTableViewProps) {
  const { roll, history } = state
  const hit = roll === null ? undefined : rowForRoll(data.table, data.rows, roll)
  const density = rollTableDensity(data.rows, data.description)

  return (
    <RollPanel
      name={data.name}
      prompt="Roll the die, and the result is marked in the table."
      result={
        roll === null ? undefined : (
          <>
            <div className="srd-roll__readout">
              <span className="srd-roll__number">{roll}</span>
              <div className="srd-roll__outcome">
                {hit && (
                  <span className="srd-roll__lands">
                    <span className="srd-roll__lands-label">Lands on</span>
                    <span className="srd-roll__lands-range">{rangeLabel(hit.key)}</span>
                  </span>
                )}
                <span className="srd-roll__outcome-title">
                  {hit ? (hit.label ?? `Roll ${roll}`) : NO_EFFECT}
                </span>
              </div>
            </div>
            {hit && (
              <p className="srd-roll__text">
                <MentionProse parts={hit.value} />
              </p>
            )}
          </>
        )
      }
      history={history.map((n) => ({ n, label: outcomeLabel(data.table, data.rows, n) }))}
      density={density}
    >
      {data.description.map((paragraph) => (
        <p key={paragraph} className="srd-roll__description">
          {paragraph}
        </p>
      ))}
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
    </RollPanel>
  )
}

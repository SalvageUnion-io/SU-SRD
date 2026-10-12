import { Button, InlineRef } from 'component-lib'
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
import { RollBands } from './RollBands'

/**
 * RollTableView — a roll table's page, rolled and read (board 08b).
 *
 * The table on the left in the book's bands under its "ROLL THE DIE:" stamp
 * (`RollBands`); on the right the "You rolled" panel: the number, the range it
 * lands on, the outcome and its text, and the earlier rolls. Roll again and the Randsum
 * credit sit under the panel's head, above the result, so the button stays
 * put whatever length the outcome's text runs to. The matching row is set in
 * ink with a "Rolled 14" tag. The die is not named: it is always a d20. A
 * long or wordy table (`splitRows`) sets its bands in two columns on a wide
 * screen, the ranges on the outer edges, and a wordy page sets tighter
 * (`rollTableDensity`), so the page fits one screen.
 *
 * Presentational, so the server and the island draw the same page: the server
 * renders it with no roll and no handlers (the bands are real content for a
 * crawler or a no-JS reader), and `RollTableIsland` mounts it live.
 */

type RollTableViewProps = {
  data: RollTablePageData
  state: RollState
  /** Roll the die. Absent on the server, where the controls are inert. */
  onRoll?: () => void
}

export function RollTableView({ data, state, onRoll }: RollTableViewProps) {
  const { roll, history } = state
  const live = !!onRoll
  const hit = roll === null ? undefined : rowForRoll(data.table, data.rows, roll)
  const outcomeOf = (n: number) => outcomeLabel(data.table, data.rows, n)

  return (
    <div className="srd-roll" data-density={rollTableDensity(data.rows, data.description)}>
      <section className="srd-roll__panel" aria-labelledby="roll-panel-title">
        <div className="srd-roll__panel-head">
          <h2 id="roll-panel-title" className="srd-roll__panel-title">
            You rolled
          </h2>
          <span className="srd-roll__panel-name">{data.name}</span>
        </div>

        <div className="srd-roll__controls">
          <Button
            variant="primary"
            size="full"
            className="srd-roll__roll"
            onClick={onRoll}
            disabled={!live}
          >
            {roll === null ? 'Roll the die' : 'Roll again'}
          </Button>
          <p className="srd-roll__credit">
            Dice rolling powered by{' '}
            <InlineRef href="https://randsum.dev" target="_blank" rel="noopener noreferrer">
              Randsum.dev
            </InlineRef>
          </p>
        </div>

        <div aria-live="polite" className="srd-roll__result">
          {roll === null ? (
            <p className="srd-roll__prompt">Roll the die, and the result is marked in the table.</p>
          ) : (
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
          )}
        </div>

        {history.length > 0 && (
          <div className="srd-roll__earlier">
            <h3 className="srd-roll__earlier-title">Earlier rolls</h3>
            <ol className="srd-roll__earlier-list">
              {history.map((n, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a roll history repeats values; its position is its identity
                <li key={index} className="srd-roll__earlier-row">
                  <span className="srd-roll__earlier-n">{n}</span>
                  <span className="srd-roll__earlier-outcome">{outcomeOf(n)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <div className="srd-roll__main">
        {data.description.map((paragraph) => (
          <p key={paragraph} className="srd-roll__description">
            {paragraph}
          </p>
        ))}
        <RollBands
          name={data.name}
          rows={data.rows}
          roll={roll}
          hit={hit}
          split={splitRows(data.rows)}
        />
      </div>
    </div>
  )
}

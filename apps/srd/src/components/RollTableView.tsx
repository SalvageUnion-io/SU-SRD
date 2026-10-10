import { Button, InlineRef } from 'component-lib'
import type { FormEvent } from 'react'
import type { RollState, RollTablePageData } from '../lib/rollTablePage'
import { D20_FACES, outcomeLabel, rangeLabel, rowForRoll } from '../lib/rollTablePage'

/**
 * RollTableView — a roll table's page, rolled and read (board 08b).
 *
 * The table on the left in the book's bands under its "ROLL THE DIE:" stamp;
 * on the right the "You rolled" panel: the number, the range it lands on, the
 * outcome and its text, then Roll again, a field for a roll made with real
 * dice, the Randsum credit and the earlier rolls. The matching row is set in
 * ink with a "Rolled 14" tag. The die is not named: it is always a d20.
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
  /** The "Rolled real dice?" field's text. */
  typed?: string
  onTypedChange?: (text: string) => void
  /** Commit the typed roll (Enter, or leaving the field). */
  onTypedCommit?: () => void
}

export function RollTableView({
  data,
  state,
  onRoll,
  typed = '',
  onTypedChange,
  onTypedCommit,
}: RollTableViewProps) {
  const { roll, history } = state
  const live = !!onRoll
  const hit = roll === null ? undefined : rowForRoll(data.table, data.rows, roll)
  const outcomeOf = (n: number) => outcomeLabel(data.table, data.rows, n)

  const commit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onTypedCommit?.()
  }

  return (
    <div className="srd-roll">
      <section className="srd-roll__panel" aria-labelledby="roll-panel-title">
        <div className="srd-roll__panel-head">
          <h2 id="roll-panel-title" className="srd-roll__panel-title">
            You rolled
          </h2>
          <span className="srd-roll__panel-name">{data.name}</span>
        </div>

        <div aria-live="polite" className="srd-roll__result">
          {roll === null ? (
            <p className="srd-roll__prompt">
              Roll the die, or enter a roll you made at the table, and the result is marked in the
              table.
            </p>
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
                    {hit ? (hit.label ?? `Roll ${roll}`) : 'No effect'}
                  </span>
                </div>
              </div>
              {hit && <p className="srd-roll__text">{hit.value}</p>}
            </>
          )}
        </div>

        <div className="srd-roll__controls">
          <Button variant="primary" size="full" onClick={onRoll} disabled={!live}>
            {roll === null ? 'Roll the die' : 'Roll again'}
          </Button>
          <form className="srd-roll__typed" onSubmit={commit}>
            <label className="srd-roll__typed-label" htmlFor="roll-typed">
              Rolled real dice?
            </label>
            <input
              id="roll-typed"
              className="srd-roll__typed-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={D20_FACES}
              value={typed}
              disabled={!live}
              onChange={(event) => onTypedChange?.(event.target.value)}
              onBlur={() => onTypedCommit?.()}
            />
          </form>
          <p className="srd-roll__credit">
            Dice rolling powered by{' '}
            <InlineRef href="https://randsum.dev" target="_blank" rel="noopener noreferrer">
              Randsum.dev
            </InlineRef>
          </p>
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
        <div className="srd-roll__stamp-row">
          <span className="srd-roll__stamp">Roll the die:</span>
          <span aria-hidden="true" className="srd-roll__leader" />
          <span className="srd-roll__hint">Your result is marked in the table</span>
        </div>
        <ol
          className="srd-roll__rows"
          aria-label={`${data.name} table`}
          data-has-roll={hit ? 'true' : undefined}
        >
          {data.rows.map((row) => {
            const rolled = hit?.key === row.key
            return (
              <li
                key={row.key}
                className="srd-roll__row"
                data-rolled={rolled ? 'true' : undefined}
                aria-current={rolled ? 'true' : undefined}
              >
                <span className="srd-roll__range">{rangeLabel(row.key)}</span>
                <div className="srd-roll__body">
                  {row.label && <span className="srd-roll__label">{row.label}</span>}
                  <span className="srd-roll__value">{row.value}</span>
                </div>
                {rolled && <span className="srd-roll__tag">Rolled {roll}</span>}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

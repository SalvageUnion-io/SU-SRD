import type { RollTableRow } from '../lib/rollTablePage'
import { rangeLabel } from '../lib/rollTablePage'
import { MentionProse } from './MentionProse'

/**
 * RollBands — a roll table's bands under the book's "ROLL THE DIE:" stamp,
 * the rolled band set in ink. The one render of a table's bands: the
 * roll-table page (`RollTableView`) draws them at full size, and the Mediator
 * Screen (`ScreenView`) at `compact`.
 *
 * `compact` sets the bands at the caption size with each label run in ahead
 * of its text, drops the stamp's hint and the "Rolled N" tag (the screen
 * reads the roll beside its button), and never splits.
 */

type RollBandsProps = {
  /** The table's name, for the bands' list label. */
  name: string
  rows: RollTableRow[]
  /** The roll the bands read, or `null` before the first one. */
  roll: number | null
  /** The band the roll lands on, if the table has one for it. */
  hit: RollTableRow | undefined
  /** Split the bands in two columns on a wide screen (`splitRows`). Full size only. */
  split?: boolean
  size?: 'full' | 'compact'
}

export function RollBands({ name, rows, roll, hit, split = false, size = 'full' }: RollBandsProps) {
  const compact = size === 'compact'
  // A dense table splits in two down the middle, ranges on the outer edges.
  const half = Math.ceil(rows.length / 2)
  const halves = split && !compact ? [rows.slice(0, half), rows.slice(half)] : [rows]

  return (
    <>
      <div className="srd-roll__stamp-row">
        <span className="srd-roll__stamp">Roll the die:</span>
        <span aria-hidden="true" className="srd-roll__leader" />
        {!compact && <span className="srd-roll__hint">Your result is marked in the table</span>}
      </div>
      <div
        className="srd-roll__bands"
        data-split={halves.length > 1 ? 'true' : undefined}
        data-size={compact ? 'compact' : undefined}
      >
        {halves.map((bands, side) => (
          <ol
            key={side === 0 ? 'left' : 'right'}
            className="srd-roll__rows"
            aria-label={side === 0 ? `${name} table` : `${name} table, continued`}
            data-has-roll={hit ? 'true' : undefined}
            data-side={side === 1 ? 'right' : undefined}
          >
            {bands.map((row) => {
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
                    <span className="srd-roll__value">
                      <MentionProse parts={row.value} />
                    </span>
                  </div>
                  {rolled && !compact && <span className="srd-roll__tag">Rolled {roll}</span>}
                </li>
              )
            })}
          </ol>
        ))}
      </div>
    </>
  )
}

/**
 * DialConfig — the ⚙ overlay that shows/hides and reorders the rotary Dial's
 * entries. Presentational only: it renders a generic list of reorderable rows +
 * emits id-based toggle/move events. The app owns what a "kind" is and how the
 * change maps to its persisted prefs (a thin ITUN wrapper around this).
 */

import { Button } from '../chrome/Button'
import { Toggle } from '../chrome/Toggle'

export type DialConfigRow = {
  /** Stable identifier for the row (the app's dial kind). */
  id: string
  label: string
  hidden: boolean
  /** Locked rows are always visible and cannot be toggled. */
  locked?: boolean
}

export type DialConfigProps = {
  rows: DialConfigRow[]
  onToggle: (id: string) => void
  onMove: (id: string, delta: -1 | 1) => void
  onClose: () => void
}

export function DialConfig({ rows, onToggle, onMove, onClose }: DialConfigProps) {
  return (
    <div className="pc-dialcfg" role="dialog" aria-label="Configure dial">
      <div className="pc-dialcfg-head">
        <span className="pc-dialcfg-title">Configure Dial</span>
        <Button variant="ghost" size="compact" onClick={onClose}>
          Done
        </Button>
      </div>
      <ul className="pc-dialcfg-list">
        {rows.map((row, i) => (
          <li key={row.id} className="pc-dialcfg-row">
            <span className="pc-dialcfg-show">
              {/*
               * `Toggle`, not `Checkbox`: this row is already a bordered
               * instrument row carrying its own condensed-uppercase label, so
               * the framed choice-row card would nest a card inside a card —
               * the reason this had been holding an open-coded native `<input>`
               * instead. Toggle is the bare rung that was missing, and adopting
               * it retires the browser's default accent blue, the one colour
               * with no place in a paper/ink/rust cockpit.
               *
               * The wrapper is no longer a `<label>`: Toggle brings its own, and
               * nesting labels would give the switch two accessible names.
               */}
              <Toggle
                label={`Show ${row.label}`}
                checked={row.locked || !row.hidden}
                disabled={row.locked}
                onChange={() => onToggle(row.id)}
              />
              <span className={row.hidden ? 'pc-dialcfg-lab hidden' : 'pc-dialcfg-lab'}>
                {row.label}
                {row.locked ? ' (locked)' : ''}
              </span>
            </span>
            <span className="pc-dialcfg-move">
              <Button
                size="compact"
                className="min-w-0 flex-1 px-2"
                onClick={() => onMove(row.id, -1)}
                disabled={i === 0}
                aria-label={`Move ${row.label} up`}
              >
                ▲
              </Button>
              <Button
                size="compact"
                className="min-w-0 flex-1 px-2"
                onClick={() => onMove(row.id, 1)}
                disabled={i === rows.length - 1}
                aria-label={`Move ${row.label} down`}
              >
                ▼
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

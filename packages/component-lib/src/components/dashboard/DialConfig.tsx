/**
 * DialConfig — the ⚙ overlay that shows/hides and reorders the rotary Dial's
 * entries. Presentational only: it renders a generic list of reorderable rows +
 * emits id-based toggle/move events. The app owns what a "kind" is and how the
 * change maps to its persisted prefs (a thin ITUN wrapper around this).
 */

import { Button } from '../chrome/Button'

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
            <label className="pc-dialcfg-show">
              <input
                type="checkbox"
                checked={row.locked || !row.hidden}
                disabled={row.locked}
                onChange={() => onToggle(row.id)}
                aria-label={`Show ${row.label}`}
              />
              <span className={row.hidden ? 'pc-dialcfg-lab hidden' : 'pc-dialcfg-lab'}>
                {row.label}
                {row.locked ? ' (locked)' : ''}
              </span>
            </label>
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

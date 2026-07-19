/**
 * DialConfig — the ⚙ overlay that shows/hides and reorders the rotary Dial's
 * entries. Presentational only: it renders a generic list of reorderable rows +
 * emits id-based toggle/move events. The app owns what a "kind" is and how the
 * change maps to its persisted prefs (a thin ITUN wrapper around this).
 */

export type DialConfigRow = {
  /** Stable identifier for the row (the app's dial kind). */
  id: string
  label: string
  hidden: boolean
  /** Locked rows are always visible and cannot be toggled. */
  locked?: boolean
}

export type DialConfigProps = {
  title?: string
  rows: DialConfigRow[]
  onToggle: (id: string) => void
  onMove: (id: string, delta: -1 | 1) => void
  onClose: () => void
}

export function DialConfig({
  title = 'Configure Dial',
  rows,
  onToggle,
  onMove,
  onClose,
}: DialConfigProps) {
  return (
    <div className="pc-dialcfg" role="dialog" aria-label="Configure dial">
      <div className="pc-dialcfg-head">
        <span className="pc-dialcfg-title">{title}</span>
        <button type="button" className="pc-railbtn" onClick={onClose}>
          Done
        </button>
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
              <button
                type="button"
                className="pc-wheel-btn"
                onClick={() => onMove(row.id, -1)}
                disabled={i === 0}
                aria-label={`Move ${row.label} up`}
              >
                ▲
              </button>
              <button
                type="button"
                className="pc-wheel-btn"
                onClick={() => onMove(row.id, 1)}
                disabled={i === rows.length - 1}
                aria-label={`Move ${row.label} down`}
              >
                ▼
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

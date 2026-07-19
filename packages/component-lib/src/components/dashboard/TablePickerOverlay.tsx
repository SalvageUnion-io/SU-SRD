/**
 * TablePickerOverlay — the Dashboard Tables full picker (D3).
 *
 * A 5-column grid, one column per category (COMBAT / PILOT / SALVAGE /
 * CRAWLER / DOWNTIME), each a stamped column of table buttons. Categories come
 * from the `tableCategories` map (roll tables carry no category field). Picking a
 * table calls `onPick` and closes; a backdrop / ✕ closes without changing the
 * selection. Presentational — the caller passes the pickable tables.
 */

import { Button } from '../chrome/Button'
import type { PickableTable } from './tableCategories'
import { TABLE_CATEGORY_LABEL, groupTablesByCategory } from './tableCategories'

export type TablePickerOverlayProps = {
  tables: readonly PickableTable[]
  selectedId: string | null
  onPick: (id: string) => void
  onClose: () => void
}

export function TablePickerOverlay({
  tables,
  selectedId,
  onPick,
  onClose,
}: TablePickerOverlayProps) {
  const columns = groupTablesByCategory(tables)

  return (
    <div className="pc-tablepick" role="dialog" aria-label="Pick a roll table" aria-modal="true">
      <div className="pc-tablepick-head">
        <span className="pc-tablepick-title">Pick a roll table</span>
        <Button size="sm" onClick={onClose} aria-label="Close table picker">
          ✕
        </Button>
      </div>
      <div className="pc-tablepick-grid">
        {columns.map(({ category, tables: colTables }) => (
          <div key={category} className="pc-tablepick-col">
            <div className="pc-tablepick-cat">{TABLE_CATEGORY_LABEL[category]}</div>
            <ul className="pc-tablepick-list">
              {colTables.length === 0 ? (
                <li className="pc-tablepick-empty">—</li>
              ) : (
                colTables.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="pc-tablepick-item"
                      aria-pressed={t.id === selectedId}
                      data-selected={t.id === selectedId ? '' : undefined}
                      onClick={() => {
                        onPick(t.id)
                        onClose()
                      }}
                    >
                      {t.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

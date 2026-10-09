/**
 * TablePickerOverlay — the Dashboard Tables full picker.
 *
 * A 5-column grid, one column per category (COMBAT / PILOT / SALVAGE /
 * CRAWLER / DOWNTIME), each a stamped column of table buttons. Categories come
 * from the `tableCategories` map (roll tables carry no category field). Picking a
 * table calls `onPick` and closes; Escape, a press outside it or ✕ closes
 * without changing the selection. Presentational — the caller passes the
 * pickable tables.
 *
 * A `ModalShell` portalled into `container` (the Tables tab), so it covers that
 * tab inside the scaled canvas and keeps the `.pc-root` styling, while Base UI
 * moves focus into it, keeps it there and hands it back on close.
 */

import { Button, ModalShell } from 'component-lib'
import type { RefObject } from 'react'
import type { PickableTable } from './tableCategories'
import { groupTablesByCategory, TABLE_CATEGORY_LABEL } from './tableCategories'

const TITLE = 'Pick a roll table'

export type TablePickerOverlayProps = {
  open: boolean
  /** The positioned box the picker covers. */
  container: RefObject<HTMLElement | null>
  tables: readonly PickableTable[]
  selectedId: string | null
  onPick: (id: string) => void
  onClose: () => void
}

export function TablePickerOverlay({
  open,
  container,
  tables,
  selectedId,
  onPick,
  onClose,
}: TablePickerOverlayProps) {
  const columns = groupTablesByCategory(tables)

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={TITLE}
      container={container}
      bare
    >
      <div className="pc-tablepick">
        <div className="pc-tablepick-head">
          <span className="pc-tablepick-title">{TITLE}</span>
          <Button size="compact" onClick={onClose} aria-label="Close table picker">
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
    </ModalShell>
  )
}

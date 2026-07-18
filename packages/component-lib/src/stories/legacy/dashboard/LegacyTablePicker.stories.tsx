/**
 * Legacy "before" capture — ITUN Dashboard `TablePickerOverlay` (D3).
 *
 * Reproduces the bespoke `role="dialog" aria-modal` roll-table picker from
 * apps/in-the-union-now/src/components/dashboard/TablePickerOverlay.tsx VERBATIM
 * — same `.pc-tablepick*` markup, styled by the co-located CSS slice (NOT
 * Tailwind). The 5-column category grouping (pure, app-side in the original)
 * is reproduced inline here so the story is self-contained; the pickable rows
 * are driven from real `SalvageUnionReference.RollTables`. L1 reconciliation:
 * freeze the "before", do not refactor onto ModalShell.
 */

import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../_harness'
import './LegacyTablePicker.css'

// --- Inlined 5-column grouping (reproduced from the app's tableCategories.ts) ---
type TableCategory = 'COMBAT' | 'PILOT' | 'SALVAGE' | 'CRAWLER' | 'DOWNTIME'
const TABLE_CATEGORY_ORDER: readonly TableCategory[] = [
  'COMBAT',
  'PILOT',
  'SALVAGE',
  'CRAWLER',
  'DOWNTIME',
]
const TABLE_CATEGORY_LABEL: Record<TableCategory, string> = {
  COMBAT: 'Combat',
  PILOT: 'Pilot',
  SALVAGE: 'Salvage',
  CRAWLER: 'Crawler',
  DOWNTIME: 'Downtime',
}
const CURATED: Record<string, TableCategory> = {
  'Critical Injury': 'PILOT',
  Keepsake: 'PILOT',
  Motto: 'PILOT',
  'Pilot Appearance': 'PILOT',
  Quirks: 'PILOT',
  Background: 'PILOT',
  Rumour: 'DOWNTIME',
  'Trading Bay': 'DOWNTIME',
  "Let's Make a Deal": 'DOWNTIME',
}
function categorize(name: string): TableCategory {
  const curated = CURATED[name]
  if (curated) return curated
  if (/crawler/i.test(name)) return 'CRAWLER'
  if (/salvage/i.test(name)) return 'SALVAGE'
  return 'COMBAT'
}
type PickableTable = { id: string; name: string }
function groupTablesByCategory(
  tables: readonly PickableTable[]
): Array<{ category: TableCategory; tables: PickableTable[] }> {
  const buckets = new Map<TableCategory, PickableTable[]>(TABLE_CATEGORY_ORDER.map((c) => [c, []]))
  for (const t of tables) buckets.get(categorize(t.name))?.push(t)
  return TABLE_CATEGORY_ORDER.map((category) => ({
    category,
    tables: [...(buckets.get(category) ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

// Verbatim reproduction of TablePickerOverlay.tsx.
function TablePickerOverlay({
  tables,
  selectedId,
  onPick,
  onClose,
}: {
  tables: readonly PickableTable[]
  selectedId: string | null
  onPick: (id: string) => void
  onClose: () => void
}) {
  const columns = groupTablesByCategory(tables)
  return (
    <div className="pc-tablepick" role="dialog" aria-label="Pick a roll table" aria-modal="true">
      <div className="pc-tablepick-head">
        <span className="pc-tablepick-title">Pick a roll table</span>
        <button
          type="button"
          className="pc-tablepick-close"
          onClick={onClose}
          aria-label="Close table picker"
        >
          ✕
        </button>
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

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/PC Table Picker' }

export const Default: Story = () => {
  const tables: PickableTable[] = SalvageUnionReference.RollTables.all()
    .slice(0, 40)
    .map((t) => ({ id: t.id, name: t.name }))
  const [selectedId, setSelectedId] = useState<string | null>(tables[0]?.id ?? null)
  const [open, setOpen] = useState(true)

  return (
    <div style={{ maxWidth: 900 }}>
      <Caption>
        ITUN Dashboard roll-table picker (TablePickerOverlay) — a bespoke role="dialog"/aria-modal
        overlay that duplicates the shared ModalShell. Rows are real SalvageUnionReference roll
        tables. The overlay is absolute inset:0 inside its display area.
      </Caption>
      {/* Sized positioned stage that stands in for the Dashboard display surface. */}
      <div className="pc-tables" style={{ position: 'relative', height: 460, width: '100%' }}>
        {open ? (
          <TablePickerOverlay
            tables={tables}
            selectedId={selectedId}
            onPick={setSelectedId}
            onClose={() => setOpen(false)}
          />
        ) : (
          <button
            type="button"
            className="pc-tablepick-item"
            style={{ width: 'auto' }}
            onClick={() => setOpen(true)}
          >
            Re-open picker
          </button>
        )}
      </div>
    </div>
  )
}

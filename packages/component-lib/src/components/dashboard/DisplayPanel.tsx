/**
 * DisplayPanel — the Dashboard's main display: the ONE surface that reads
 * "forward". Presentational: the ITUN wrapper resolves the Dial focus (+ store /
 * rules) into a discriminated `content`, and this renders it — the faithful light
 * SRD reference document (reused ReferenceEntityCard / RollTable), the Tables
 * picker, the SRD Explorer, or an app-provided slot (the Actions deck).
 */

import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Button } from '../chrome/Button'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'
import { ControlButtons } from '../shared/ControlButtons'
import { RollTable } from '../shared/RollTable'
import { SrdExplorer } from './SrdExplorer'
import { TablePickerOverlay } from './TablePickerOverlay'
import type { PickableTable } from './tableCategories'

const HIDE_CHOICES = { choices: true } as const

/** How many recent roll results the Tables view keeps. */
const ROLL_HISTORY_LIMIT = 8

/** A roll-table entity: its `table` is the actual RollTable payload. */
type RollTableEntity = PickableTable & {
  table: Parameters<typeof RollTable>[0]['table']
}

type RollHistoryEntry = {
  seq: number
  tableName: string
  key: string
  text: string
}

/**
 * TablesView — the Tables focus (D3): the selected table rendered via the reused
 * `RollTable`, whose header TITLE is the trigger for the 5-column category
 * picker overlay, plus an ephemeral roll history. Self-contained (reads the ORM
 * roll tables).
 *
 * The trigger used to be a separate bar above the table — a "Roll table" label
 * and a button repeating the name the header band printed directly beneath it.
 * `titleSelect` folds the two into one control (see `RollTable`).
 */
function TablesView() {
  const tables: RollTableEntity[] = SalvageUnionReference.RollTables.all()
  const [tableId, setTableId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [history, setHistory] = useState<RollHistoryEntry[]>([])
  const seqRef = useRef(0)

  const selected =
    // Indexed lookups, not scans over `tables`: `BaseModel` builds an id/name
    // index lazily, and this runs on every Display render. `tables` is still
    // needed for the list itself and the `[0]` fallback.
    (tableId ? SalvageUnionReference.RollTables.getById(tableId) : undefined) ??
    SalvageUnionReference.RollTables.getByName('Core Mechanic') ??
    tables[0]

  return (
    <div className="pc-display-scroll pc-tables">
      {selected ? (
        <RollTable
          table={selected.table}
          tableName={selected.name}
          showCommand
          titleSelect={{ onOpen: () => setPickerOpen(true), open: pickerOpen }}
          onRollResult={(text, key) => {
            seqRef.current += 1
            const entry: RollHistoryEntry = {
              seq: seqRef.current,
              tableName: selected.name,
              key,
              text,
            }
            setHistory((h) => [entry, ...h].slice(0, ROLL_HISTORY_LIMIT))
          }}
        />
      ) : (
        <div className="pc-display-note">Roll tables load here.</div>
      )}

      {history.length > 0 ? (
        <div className="pc-rollhist">
          <div className="pc-rollhist-head">
            <span className="pc-rollhist-title">Roll history</span>
            <Button size="mini" onClick={() => setHistory([])}>
              Clear
            </Button>
          </div>
          <ul className="pc-rollhist-list">
            {history.map((h) => (
              <li key={h.seq} className="pc-rollhist-row">
                <span className="pc-rollhist-src">
                  {h.tableName} · {h.key}
                </span>
                <span className="pc-rollhist-text">{h.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pickerOpen ? (
        <TablePickerOverlay
          tables={tables}
          selectedId={selected?.id ?? null}
          onPick={setTableId}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  )
}

/**
 * A framed reference card with optional entity-level foot actions, or a graceful
 * fallback (still carrying the foot actions) when a slug doesn't resolve.
 */
function EntityCard({
  data,
  note,
  controls,
}: {
  data: SURefEntity | null
  note: string
  controls?: ReferenceEntityControl[]
}) {
  if (!data) {
    return (
      <div className="pc-entity-fallback">
        <p className="pc-crawler-focus-note">{note}</p>
        {controls && controls.length > 0 ? (
          <div className="pc-entity-foot">
            <ControlButtons controls={controls} />
          </div>
        ) : null}
      </div>
    )
  }
  return <ReferenceEntityCard data={data} hide={HIDE_CHOICES} controls={controls} />
}

/** What the display shows — resolved by the app from the Dial focus + store. */
export type DisplayContent =
  | { kind: 'note'; text: string }
  | { kind: 'tables' }
  | { kind: 'srd' }
  /** An app-provided view (the store/rules-wired Actions deck). */
  | { kind: 'slot'; node: ReactNode }
  | { kind: 'entity'; data: SURefEntity | null; note: string; controls?: ReferenceEntityControl[] }

export type DisplayPanelProps = { content: DisplayContent }

export function DisplayPanel({ content }: DisplayPanelProps) {
  switch (content.kind) {
    case 'note':
      return <div className="pc-display-note">{content.text}</div>
    case 'tables':
      return <TablesView />
    case 'srd':
      return <SrdExplorer />
    case 'slot':
      return <>{content.node}</>
    case 'entity':
      // Centre the card at a document width, the way the srd reference page
      // does (`mx-auto w-full max-w-*`). Without it the full `large` card
      // stretches to the whole panel and reads squashed — wide-and-short header
      // stats, over-wide art. `pc-display-scroll` only provides the scroll box.
      return (
        <div className="pc-display-scroll">
          <div className="mx-auto w-full max-w-2xl">
            <EntityCard data={content.data} note={content.note} controls={content.controls} />
          </div>
        </div>
      )
  }
}

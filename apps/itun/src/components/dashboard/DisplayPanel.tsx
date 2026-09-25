/**
 * DisplayPanel — the Dashboard's main display: the ONE surface that reads
 * "forward".
 *
 * `DisplayPanel` resolves the Dial focus (+ play-state store / rules) into a
 * discriminated `DisplayContent`; `DisplayPanelFrame` renders it — the faithful
 * light SRD reference document (reused ReferenceEntityCard / RollTable), the
 * Tables picker, the SRD Explorer, or the store/rules-wired Actions deck (passed
 * as a slot). Statful focuses resolve the entity's reference data and build the
 * entity-level controls (Load Into Mech / Enter Downtime / Full sheet →).
 *
 * The two halves were split across component-lib and ITUN, with ITUN importing
 * the library's copy `as DisplayPanelView`, although ITUN was its only consumer.
 * They share one file now (component-lib boundary audit, PK-03).
 */

import type { ReferenceEntityControl } from 'component-lib'
import { Button, ControlButtons, ReferenceEntityCard, RollTable } from 'component-lib'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { usePlayStateStore } from '../../stores/playStateStore'
import { ActionsDeck } from './ActionsDeck'
import type { DialItem } from './dialItems'
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

/**
 * The presentational half: renders an already-resolved `content`. Exported for
 * the Ladle story, which drives it with real reference data and no store.
 */
export function DisplayPanelFrame({ content }: { content: DisplayContent }) {
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

type DisplayPanelProps = {
  focus: DialItem | undefined
  mech: Mech
  pilot: Pilot | null
  crawler: Crawler | null
}

export function DisplayPanel({ focus, mech, pilot, crawler }: DisplayPanelProps) {
  const enterDowntime = usePlayStateStore((s) => s.enterDowntime)
  const mount = usePlayStateStore((s) => s.mount)
  const setMount = usePlayStateStore((s) => s.setMount)

  const content = ((): DisplayContent => {
    if (!focus) return { kind: 'note', text: 'Nothing selected.' }

    if (focus.statless) {
      if (focus.key === 'tables') return { kind: 'tables' }
      if (focus.key === 'actions') {
        return {
          kind: 'slot',
          node: <ActionsDeck mech={mech} pilot={pilot} crawler={crawler} mount={mount} />,
        }
      }
      if (focus.key === 'srd') return { kind: 'srd' }
      return { kind: 'note', text: focus.label }
    }

    // Statful entity focus → its reference card + entity-level foot actions.
    if (focus.key.startsWith('mech:')) {
      const chassis = resolveChassisRef(mech.chassisRef)
      const controls: ReferenceEntityControl[] = []
      if (mount === 'pilot') {
        controls.push({
          key: 'load',
          label: 'Load Into Mech ▶',
          ariaLabel: 'Load Into Mech',
          onClick: () => setMount('mech'),
          variant: 'primary',
        })
      }
      controls.push({ key: 'sheet', href: `/sheet/mech/${mech.id}`, label: 'Full mech sheet →' })
      return {
        kind: 'entity',
        data: chassis,
        note: `Chassis “${mech.chassisRef}” not in the reference set.`,
        controls,
      }
    }
    if (focus.key.startsWith('pilot:') && pilot) {
      const cls = SalvageUnionReference.Classes.find((c) => c.id === pilot.classRef) ?? null
      return {
        kind: 'entity',
        data: cls,
        note: `Class “${pilot.classRef}” not in the reference set.`,
        controls: [{ key: 'sheet', href: `/sheet/pilot/${pilot.id}`, label: 'Full pilot sheet →' }],
      }
    }
    if (focus.key.startsWith('crawler:') && crawler) {
      const crawlerRef = crawler.type ? resolveCrawlerType(crawler.type) : null
      return {
        kind: 'entity',
        data: crawlerRef,
        note: `Crawler · ${crawler.name} — back at the Union Crawler for the Downtime loop.`,
        controls: [
          {
            key: 'downtime',
            label: 'Enter Downtime ▶',
            ariaLabel: 'Enter Downtime',
            onClick: enterDowntime,
            variant: 'primary',
          },
          { key: 'sheet', href: `/sheet/crawler/${crawler.id}`, label: 'Full crawler sheet →' },
        ],
      }
    }

    return { kind: 'note', text: focus.label }
  })()

  return <DisplayPanelFrame content={content} />
}

/**
 * DisplayView — the Dashboard's main display: the ONE surface that reads
 * "forward". It renders the faithful light SRD reference document for whatever
 * the Dial is focused on (focus→display sync), reusing component-lib's
 * ReferenceEntityDisplay / RollTable verbatim — the same components the live
 * sheet and reference site show (ADR-017).
 *
 * D5 (this pass): each statful entity focus (mech / pilot / crawler) renders the
 * entity's real reference card with entity-level `controls` in the card overlay
 * — "Full sheet →" links plus the play verbs (Load Into Mech, Enter Downtime for
 * the crawler). Live vitals stay in the gauges / dial / Active
 * Item band (the app has no live-composed entity card, by design — see the
 * dashboard-display-completion-plan). The crawler focus is now a real reference
 * card instead of the old text note.
 */

import { useRef, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import {
  ControlButtons,
  type ReferenceEntityControl,
  ReferenceEntityDisplay,
  RollTable,
} from 'component-lib'

import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
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
  /** Ephemeral, per-mount unique id for the list key. */
  seq: number
  tableName: string
  key: string
  text: string
}

/**
 * TablesView — the Tables focus (D3): a 5-column category picker overlay over
 * the curated `tableCategories` map, the selected table rendered via the reused
 * `RollTable` (roll button on, result in-panel), and an ephemeral roll history.
 */
function TablesView() {
  const tables = SalvageUnionReference.RollTables.all() as unknown as RollTableEntity[]
  const [tableId, setTableId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [history, setHistory] = useState<RollHistoryEntry[]>([])
  const seqRef = useRef(0)

  const selected =
    (tableId ? tables.find((t) => t.id === tableId) : undefined) ??
    tables.find((t) => t.name === 'Core Mechanic') ??
    tables[0]

  return (
    <div className="pc-display-scroll pc-tables">
      <div className="pc-tables-bar">
        <span className="pc-tables-lab">Roll table</span>
        <button
          type="button"
          className="pc-tables-pick-btn"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          {selected?.name ?? 'Choose a table'} ▾
        </button>
      </div>

      {selected ? (
        <RollTable
          table={selected.table}
          tableName={selected.name}
          showCommand
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
            <button type="button" className="pc-rollhist-clear" onClick={() => setHistory([])}>
              Clear
            </button>
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

type DisplayViewProps = {
  focus: DialItem | undefined
  mech: Mech
  pilot: Pilot | null
  crawler: Crawler | null
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
  return <ReferenceEntityDisplay data={data} hide={HIDE_CHOICES} controls={controls} />
}

export function DisplayView({ focus, mech, pilot, crawler }: DisplayViewProps) {
  const enterDowntime = usePlayStateStore((s) => s.enterDowntime)
  const mount = usePlayStateStore((s) => s.mount)
  const setMount = usePlayStateStore((s) => s.setMount)
  if (!focus) return <div className="pc-display-note">Nothing selected.</div>

  if (focus.statless) {
    if (focus.key === 'tables') {
      return <TablesView />
    }
    if (focus.key === 'actions') {
      return <ActionsDeck mech={mech} pilot={pilot} mount={mount} />
    }
    if (focus.key === 'srd') {
      return <SrdExplorer />
    }
    return <div className="pc-display-note">{focus.label}</div>
  }

  // Statful entity focus → its reference card + entity-level foot actions.
  if (focus.key.startsWith('mech:')) {
    const chassis = resolveChassisRef(mech.chassisRef) as SURefEntity | null
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
    return (
      <div className="pc-display-scroll">
        <EntityCard
          data={chassis}
          note={`Chassis “${mech.chassisRef}” not in the reference set.`}
          controls={controls}
        />
      </div>
    )
  }
  if (focus.key.startsWith('pilot:') && pilot) {
    const cls = (SalvageUnionReference.Classes.find((c) => c.id === pilot.classRef) ??
      null) as SURefEntity | null
    const controls: ReferenceEntityControl[] = [
      { key: 'sheet', href: `/sheet/pilot/${pilot.id}`, label: 'Full pilot sheet →' },
    ]
    return (
      <div className="pc-display-scroll">
        <EntityCard
          data={cls}
          note={`Class “${pilot.classRef}” not in the reference set.`}
          controls={controls}
        />
      </div>
    )
  }
  if (focus.key.startsWith('crawler:') && crawler) {
    const crawlerRef = crawler.type
      ? (resolveCrawlerType(crawler.type) as unknown as SURefEntity | null)
      : null
    const controls: ReferenceEntityControl[] = [
      {
        key: 'downtime',
        label: 'Enter Downtime ▶',
        ariaLabel: 'Enter Downtime',
        onClick: enterDowntime,
        variant: 'primary',
      },
      { key: 'sheet', href: `/sheet/crawler/${crawler.id}`, label: 'Full crawler sheet →' },
    ]
    return (
      <div className="pc-display-scroll">
        <EntityCard
          data={crawlerRef}
          note={`Crawler · ${crawler.name} — back at the Union Crawler for the Downtime loop.`}
          controls={controls}
        />
      </div>
    )
  }

  return <div className="pc-display-note">{focus.label}</div>
}

/**
 * DisplayPanel — what the display's Reference, Tables and SRD tabs show
 * (`DisplayTabs`): the ONE surface that reads "forward".
 *
 * `DisplayPanel` resolves the chosen `DisplayFocus` (+ play-state store /
 * rules) into a discriminated `DisplayContent`; `DisplayPanelFrame` renders it — the faithful
 * light SRD reference document (reused ReferenceEntityCard / RollTable), the
 * Tables picker or the SRD Explorer. Entity focuses resolve the entity's
 * reference data and build the entity-level controls (Load Into Mech / Enter
 * Downtime / Full sheet →). Rolls on a table go to the Game's log
 * (`dashboardRolls.ts`), which the Log tab reads.
 *
 * The two halves were split across component-lib and ITUN, with ITUN importing
 * the library's copy `as DisplayPanelView`, although ITUN was its only consumer.
 * They share one file now (component-lib boundary audit, PK-03).
 */

import type { ReferenceEntityControl } from 'component-lib'
import { ControlButtons, ReferenceEntityCard, RollTable } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { usePlayStateStore } from '../../stores/playStateStore'
import { recordRoll } from './dashboardRolls'
import { SrdExplorer } from './SrdExplorer'
import { TablePickerOverlay } from './TablePickerOverlay'
import type { PickableTable } from './tableCategories'
import type { MountState, SeatHandle } from './useSeat'

const HIDE_CHOICES = { choices: true } as const

/** A roll-table entity: its `table` is the actual RollTable payload. */
type RollTableEntity = PickableTable & {
  table: Parameters<typeof RollTable>[0]['table']
}

/** A table roll, by table, the row it landed on and that row's text. */
export type TableRoll = (tableName: string, key: string, text: string) => void

/**
 * TablesView — the Tables tab (D3): the selected table rendered via the reused
 * `RollTable`, whose header TITLE is the trigger for the 5-column category
 * picker overlay. Self-contained (reads the ORM roll tables). Its rolls go to
 * `onRoll`, which writes them to the Game's log; they used to be a history
 * kept here, on this device only, until the Log tab replaced it.
 *
 * The trigger used to be a separate bar above the table — a "Roll table" label
 * and a button repeating the name the header band printed directly beneath it.
 * `titleSelect` folds the two into one control (see `RollTable`).
 */
function TablesView({ onRoll }: { onRoll?: TableRoll }) {
  const tables: RollTableEntity[] = SalvageUnionReference.RollTables.all()
  const [tableId, setTableId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

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
          onRollResult={(text, key) => onRoll?.(selected.name, key, text)}
        />
      ) : (
        <div className="pc-display-note">Roll tables load here.</div>
      )}

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

/** What the display shows — resolved by the app from the focus + store. */
export type DisplayContent =
  | { kind: 'note'; text: string }
  | { kind: 'tables'; onRoll?: TableRoll }
  | { kind: 'srd' }
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
      return <TablesView onRoll={content.onRoll} />
    case 'srd':
      return <SrdExplorer />
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

/**
 * What the panel shows: an entity's reference card (the Reference tab, whose
 * `DisplayPicker` chooses the entity), the Tables roller or the SRD explorer.
 */
export type DisplayFocus = 'pilot' | 'mech' | 'crawler' | 'tables' | 'srd'

/** The entities the Reference tab can show. */
export type ReferenceFocus = Extract<DisplayFocus, 'pilot' | 'mech' | 'crawler'>

type DisplayPanelProps = {
  focus: DisplayFocus
  /** The boarded or assigned mech; null for a pilot on foot with none. */
  mech: Mech | null
  pilot: Pilot | null
  crawler: Crawler | null
  /** Which entity runs the Dashboard, derived from the seat and Downtime. */
  mount: MountState
  /** The pilot's seat: boarding from the mech card. */
  seat: SeatHandle
}

export function DisplayPanel({ focus, mech, pilot, crawler, mount, seat }: DisplayPanelProps) {
  const enterDowntime = usePlayStateStore((s) => s.enterDowntime)

  const content = ((): DisplayContent => {
    if (focus === 'tables') {
      const owner = pilot ?? mech
      return {
        kind: 'tables',
        onRoll: (tableName, key, text) => {
          if (!owner) return
          recordRoll(owner, {
            description: `${owner.name} · ${tableName}, ${key}: ${text}`,
            result: { kind: 'table', roll: null, outcome: key },
          })
        },
      }
    }
    if (focus === 'srd') return { kind: 'srd' }

    // An entity focus → its reference card + entity-level foot actions.
    if (focus === 'mech' && mech) {
      const chassis = resolveChassisRef(mech.chassisRef)
      const controls: ReferenceEntityControl[] = []
      if (mount === 'pilot') {
        controls.push({
          key: 'load',
          label: 'Load Into Mech ▶',
          ariaLabel: 'Load Into Mech',
          onClick: () => seat.board(mech.id),
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
    if (focus === 'pilot' && pilot) {
      const cls = SalvageUnionReference.Classes.getById(pilot.classRef) ?? null
      return {
        kind: 'entity',
        data: cls,
        note: `Class “${pilot.classRef}” not in the reference set.`,
        controls: [{ key: 'sheet', href: `/sheet/pilot/${pilot.id}`, label: 'Full pilot sheet →' }],
      }
    }
    if (focus === 'crawler' && crawler) {
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

    return { kind: 'note', text: 'Nothing to show.' }
  })()

  return <DisplayPanelFrame content={content} />
}

const PICKER: CSSProperties = { padding: '8px 12px 0', flex: '0 0 auto' }

/** A bare fieldset: the group, without the browser's frame around it. */
const GROUP: CSSProperties = { border: 0, margin: 0, padding: 0, minInlineSize: 0 }

/**
 * The Reference tab's choice of entity, as a plain row of toggle buttons. Each
 * is a button with `aria-pressed`, not a tab: it filters one panel, and the
 * display's own tabs (`DisplayTabs`) already hold the tab role and its
 * keyboard model.
 */
export function DisplayPicker({
  focus,
  options,
  onFocus,
}: {
  focus: ReferenceFocus
  options: readonly { focus: ReferenceFocus; label: string }[]
  onFocus: (focus: ReferenceFocus) => void
}) {
  return (
    <div style={PICKER}>
      <fieldset className="pc-deck-tabs" style={GROUP} aria-label="Reference">
        {options.map((o) => (
          <button
            key={o.focus}
            type="button"
            aria-pressed={focus === o.focus}
            className={`pc-deck-tab${focus === o.focus ? ' is-active' : ''}`}
            onClick={() => onFocus(o.focus)}
          >
            {o.label}
          </button>
        ))}
      </fieldset>
    </div>
  )
}

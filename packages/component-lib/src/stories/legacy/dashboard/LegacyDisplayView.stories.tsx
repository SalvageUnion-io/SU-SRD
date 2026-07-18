/**
 * Legacy "before" capture — ITUN Dashboard `DisplayView` (the main "forward"
 * display, D5).
 *
 * DisplayView is a thin router: for a statful focus it renders the entity's
 * faithful reference card (component-lib's `ReferenceEntityDisplay`, already
 * canonical — captured elsewhere) with entity-level foot actions folded in; for
 * the Tables focus it renders `TablesView`. What is BESPOKE here (the frozen
 * "before") is the surrounding `.pc-*` shell: the Tables mini-bar + roll
 * history, and the `EntityCard` fallback for an unresolved slug. Those shells
 * are reproduced VERBATIM as raw markup, styled by the co-located CSS slice
 * (NOT Tailwind); the real `RollTable` is embedded in TablesView exactly as the
 * app renders it, driven by real `SalvageUnionReference.RollTables`. Store /
 * ActionsDeck / TablePickerOverlay plumbing is collapsed to local state (the
 * picker overlay has its own capture — Legacy/PC Table Picker). L1
 * reconciliation: freeze the "before", do not refactor onto ModalShell.
 */

import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { RollTable } from '../../../components/shared/RollTable'
import { Caption } from '../../_harness'
import './LegacyDisplayView.css'

/** How many recent roll results the Tables view keeps (verbatim from DisplayView). */
const ROLL_HISTORY_LIMIT = 8

type RollHistoryEntry = {
  seq: number
  tableName: string
  key: string
  text: string
}

/**
 * TablesView — the Tables focus (verbatim shell): a mini-bar with the picker
 * button, the selected table rendered via the reused `RollTable`, and an
 * ephemeral roll history. The picker OPEN handler is inert here (the overlay is
 * captured separately).
 */
function TablesView() {
  const tables = SalvageUnionReference.RollTables.all()
  const selected = tables.find((t) => t.name === 'Core Mechanic') ?? tables[0]
  const [history, setHistory] = useState<RollHistoryEntry[]>([])
  const seqRef = useRef(0)

  if (!selected) return <div className="pc-display-note">Roll tables load here.</div>
  const table = 'table' in selected ? selected.table : undefined

  return (
    <div className="pc-display-scroll pc-tables">
      <div className="pc-tables-bar">
        <span className="pc-tables-lab">Roll table</span>
        <button
          type="button"
          className="pc-tables-pick-btn"
          aria-haspopup="dialog"
          aria-expanded={false}
        >
          {selected.name} ▾
        </button>
      </div>

      {table ? (
        <RollTable
          table={table}
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
    </div>
  )
}

/**
 * EntityCard fallback (verbatim from DisplayView) — the graceful shell shown
 * when a focus's slug doesn't resolve to a reference entity, still carrying the
 * entity-level foot actions.
 */
function EntityFallback({ note, footActions }: { note: string; footActions: ReactNode }) {
  return (
    <div className="pc-entity-fallback">
      <p className="pc-crawler-focus-note">{note}</p>
      <div className="pc-entity-foot">{footActions}</div>
    </div>
  )
}

/** A light paper stage that stands in for the Dashboard's `.pc-display` surface. */
function DisplayStage({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div
      className="pc-root pc-display-light"
      style={{ height, borderRadius: 5, border: '2.5px solid rgba(40,32,25,0.5)' }}
    >
      {children}
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/PC Display View' }

export const Default: Story = () => {
  const crawler = SalvageUnionReference.Crawlers.all()[0]
  if (!crawler) return <Caption>Crawler fixture missing</Caption>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
      <div>
        <Caption>
          Tables focus (TablesView) — bespoke `.pc-tables-bar` + `.pc-rollhist` shell wrapping the
          reused RollTable. Roll the real "Core Mechanic" table to populate the history.
        </Caption>
        <DisplayStage height={520}>
          <TablesView />
        </DisplayStage>
      </div>

      <div>
        <Caption>
          Statful focus, unresolved slug (EntityCard fallback) — the `.pc-entity-fallback` +
          `.pc-entity-foot` shell with real crawler play verbs. The resolved branch renders
          ReferenceEntityDisplay (canonical, captured separately).
        </Caption>
        <DisplayStage height={240}>
          <div className="pc-display-scroll">
            <EntityFallback
              note={`Crawler · ${crawler.name} — back at the Union Crawler for the Downtime loop.`}
              footActions={
                <>
                  <button type="button" className="pc-deck-btn">
                    Enter Downtime ▶
                  </button>
                  <a href={`/sheet/crawler/${crawler.id}`} className="pc-deck-btn">
                    Full crawler sheet →
                  </a>
                </>
              }
            />
          </div>
        </DisplayStage>
      </div>
    </div>
  )
}

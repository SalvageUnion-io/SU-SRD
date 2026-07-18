/**
 * Legacy "before" capture — ITUN Dashboard `DowntimeWizard` (the guided Union
 * Crawler Downtime loop, Phase 6).
 *
 * Reproduces the bespoke `.pc-dt*` shell from
 * apps/in-the-union-now/src/components/dashboard/DowntimeWizard.tsx VERBATIM —
 * the phase/count head, the underlined step name, the read-only gate readout,
 * the note, and the prev / Mark-Complete / next controls — styled by the
 * co-located CSS slice (NOT Tailwind). The 10 steps are driven from the REAL
 * "Crawler Downtime" Guide in the ORM (`SalvageUnionReference.Guides`), one at a
 * time, with each step's content rendered through the reused canonical
 * `Content` and the associated SRD roll table via the reused `RollTable` —
 * exactly the path the app takes. Collapsed for a self-contained capture: the
 * `playStateStore` step/complete state becomes local state, and the `StepGate`
 * (normally driven by app-only `crawlerEconomy` / `downtime` rules against a
 * live Crawler) is shown as a static representative readout with the real rule
 * text. L1 reconciliation: freeze the "before", do not refactor.
 */

import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectGuideStep, SURefObjectTable } from 'salvageunion-reference'
import { Content } from '../../components/referenceEntity/Content'
import { RollTable } from '../../components/shared/RollTable'
import { Caption } from '../_harness'
import './LegacyDowntimeWizard.css'

const DOWNTIME_GUIDE_TYPE = 'downtime'
const CRAWLER_PINK = '#7e2a5b'

/** SRD roll tables associated with a Downtime step (verbatim from the source). */
const STEP_ROLL_TABLE: Record<string, string> = {
  'Upkeep & Upgrade': 'Crawler Deterioration',
  Trade: 'Trading Bay',
}

/**
 * Static representative gate readout — the app drives these lines from
 * `crawlerEconomy` / `downtime` against a live Crawler (bay operational /
 * damaged / absent). Here they show the "operational" branch with the real
 * rule text (Upkeep is 5× Tech Level in Scrap).
 */
function StepGate({ step }: { step: SURefObjectGuideStep }) {
  if (step.name === 'Restore your Mech & Pilot') {
    return (
      <ul className="pc-dt-gate">
        <li>Mech Bay: operational — SP/EP/Heat restore, damaged items repair</li>
        <li>Med Bay: operational — HP heals, Minor + Major Injuries heal</li>
      </ul>
    )
  }
  if (step.name === 'Upkeep & Upgrade') {
    return (
      <ul className="pc-dt-gate">
        <li>Upkeep is 5× the crawler's Tech Level in Scrap this Downtime.</li>
        <li>Unpaid Upkeep forces a roll on the Crawler Deterioration table (below).</li>
      </ul>
    )
  }
  if (step.name === 'Trade') {
    return (
      <ul className="pc-dt-gate">
        <li>Trading Bay: operational — roll availability, then trade Scrap at fixed rates</li>
      </ul>
    )
  }
  return null
}

function DowntimeWizard() {
  const [dtStep, setDtStep] = useState(0)
  const [dtDone, setDtDone] = useState<Record<number, boolean>>({})
  const toggleDtDone = (i: number) => setDtDone((d) => ({ ...d, [i]: !d[i] }))

  const guide = SalvageUnionReference.Guides.find((g) => g.guideType === DOWNTIME_GUIDE_TYPE)
  const steps = guide?.steps ?? []
  if (steps.length === 0) {
    return <div className="pc-display-note">Downtime procedure not in the reference set.</div>
  }

  const idx = Math.min(Math.max(dtStep, 0), steps.length - 1)
  const step = steps[idx]
  if (!step) {
    return <div className="pc-display-note">Downtime procedure not in the reference set.</div>
  }

  // Phase = the most recent section label at or before the current step.
  let phase = 'Downtime'
  for (let i = 0; i <= idx; i++) {
    const sec = steps[i]?.section
    if (sec) phase = sec
  }

  const done = dtDone[idx] ?? false
  const headerBg = guide?.guideColor ?? CRAWLER_PINK
  const tableName = STEP_ROLL_TABLE[step.name]
  const tableEntity = tableName
    ? SalvageUnionReference.RollTables.find((t) => t.name === tableName)
    : undefined
  // The app passes the ORM entity directly; the reused RollTable reads its
  // `.table` payload (the known-good shape, as in DisplayView / RenderingMatrix).
  const table =
    tableEntity && 'table' in tableEntity ? (tableEntity.table as SURefObjectTable) : undefined

  return (
    <div className="pc-display-scroll">
      <div className="pc-dt">
        <div className="pc-dt-head">
          <span className="pc-dt-phase" style={{ background: headerBg }}>
            {phase}
          </span>
          <span className="pc-dt-count">
            Step {idx + 1} / {steps.length}
          </span>
        </div>

        <h3 className="pc-dt-step-name" style={{ borderColor: headerBg }}>
          {step.name}
        </h3>
        {step.content && step.content.length > 0 && (
          <Content body={step.content} headerBg={headerBg} />
        )}

        <StepGate step={step} />

        {table && (
          <div className="pc-dt-table">
            <RollTable table={table} tableName={tableName} compact showCommand />
          </div>
        )}

        <p className="pc-dt-note">
          Guidance only — Downtime economy writes (Upkeep, Restore, Crafting) are applied on the
          live sheet.
        </p>

        <div className="pc-dt-controls">
          <button
            type="button"
            className="pc-deck-btn"
            onClick={() => setDtStep(idx - 1)}
            disabled={idx === 0}
          >
            ‹ Prev
          </button>
          <button
            type="button"
            className={done ? 'pc-deck-btn pc-dt-btn-done' : 'pc-deck-btn'}
            onClick={() => toggleDtDone(idx)}
            aria-pressed={done}
          >
            {done ? '✓ Complete' : 'Mark Complete'}
          </button>
          <button
            type="button"
            className="pc-deck-btn"
            onClick={() => setDtStep(idx + 1)}
            disabled={idx === steps.length - 1}
          >
            Next ›
          </button>
        </div>
      </div>
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/PC Downtime Wizard' }

export const Default: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <Caption>
      ITUN Dashboard Downtime wizard (DowntimeWizard) — bespoke `.pc-dt*` shell walking the real
      "Crawler Downtime" guide (10 steps) via the reused Content + RollTable. Step nav / complete
      collapsed to local state; the gate readout is a static representative of the app-only crawler
      rules. Page through with Prev / Next.
    </Caption>
    <div
      className="pc-root pc-display-light"
      style={{ height: 620, borderRadius: 5, border: '2.5px solid rgba(40,32,25,0.5)' }}
    >
      <DowntimeWizard />
    </div>
  </div>
)

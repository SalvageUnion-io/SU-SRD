/**
 * DowntimeWizard — the guided Union Crawler Downtime loop, shown on the ONE
 * light display surface while the Dashboard is in the `'downtime'` mount state
 * (plan §5.5, §9.6). Crawler-dominant: pink chrome, the crawler is the Active
 * Item, and this wizard walks the 10-step Post-/Pre-Session procedure.
 *
 * The 10 steps are NOT hard-coded — they are driven from the real "Crawler
 * Downtime" Guide in the reference ORM (`SalvageUnionReference.Guides`, faithful
 * SRD p.227-228), one step at a time. Each step's descriptive content renders
 * through the reused `Content` (the same content renderer the
 * reference site uses) so it matches the book verbatim. Step *gating* is layered
 * on top from the pure rules modules (`downtime.ts` bay gates, `crawlerEconomy.ts`
 * upkeep/trading) as READ-ONLY readouts, and the relevant SRD roll tables
 * (Crawler Deterioration / Trading Bay) render via the reused `RollTable`.
 *
 * Read-mostly (ADR-007 + the phase brief): the wizard shows what each step
 * *would* do and defers the destructive economy writes (upkeep spend, restore,
 * crafting) to the live sheet — those `downtime.ts` / `crawlerEconomy.ts` patch
 * fns are not applied from here. Navigation (prev/next) and the per-step "Mark
 * Complete" toggle are ephemeral, held in `playStateStore`.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectGuideStep, SURefObjectTable } from 'salvageunion-reference'
import { Content, RollTable } from 'component-lib'

import { bayGate, UPKEEP_SCRAP } from '../../lib/rules/crawlerEconomy'
import { mechBayStatus, medBayStatus } from '../../lib/rules/downtime'
import type { Crawler } from '../../lib/schemas/crawler'
import { usePlayStateStore } from '../../stores/playStateStore'

/** The guideType that identifies the Union Crawler Downtime procedure. */
const DOWNTIME_GUIDE_TYPE = 'downtime'

/** Fallback pink when the guide carries no `guideColor` (crawler ontology). */
const CRAWLER_PINK = '#7e2a5b'

/**
 * SRD roll tables associated with a Downtime step (keyed by the guide step's
 * name). The guide content describes the roll but does not link the table
 * entity, so this presentation glue resolves it for the reused RollTable.
 */
const STEP_ROLL_TABLE: Record<string, string> = {
  'Upkeep & Upgrade': 'Crawler Deterioration',
  Trade: 'Trading Bay',
}

type DowntimeWizardProps = {
  crawler: Crawler | null
}

/** Read-only gate readout for the steps whose effects the rules modules gate. */
function StepGate({ step, crawler }: { step: SURefObjectGuideStep; crawler: Crawler }) {
  if (step.name === 'Restore your Mech & Pilot') {
    const mechBay = mechBayStatus(crawler)
    const medBay = medBayStatus(crawler)
    return (
      <ul className="pc-dt-gate">
        <li>
          Mech Bay:{' '}
          {mechBay.operational
            ? 'operational — SP/EP/Heat restore, damaged items repair'
            : 'blocked — no restore or repair this Downtime'}
        </li>
        <li>
          Med Bay:{' '}
          {medBay.operational
            ? `operational — HP heals${medBay.healsMajor ? ', Minor + Major Injuries heal' : medBay.healsMinor ? ', Minor Injuries heal' : ''}`
            : 'blocked — no HP or injury healing (AP still rests to full)'}
        </li>
      </ul>
    )
  }
  if (step.name === 'Upkeep & Upgrade') {
    return (
      <ul className="pc-dt-gate">
        <li>Upkeep is {UPKEEP_SCRAP}× the crawler's Tech Level in Scrap this Downtime.</li>
        <li>Unpaid Upkeep forces a roll on the Crawler Deterioration table (below).</li>
      </ul>
    )
  }
  if (step.name === 'Trade') {
    const trading = bayGate(crawler, 'Trading Bay')
    return (
      <ul className="pc-dt-gate">
        <li>
          Trading Bay:{' '}
          {trading.operational
            ? 'operational — roll availability, then trade Scrap at fixed rates'
            : trading.present
              ? 'damaged — Scrap trading and the availability roll are blocked'
              : 'not installed — no Trading Bay availability this Downtime'}
        </li>
      </ul>
    )
  }
  return null
}

export function DowntimeWizard({ crawler }: DowntimeWizardProps) {
  const dtStep = usePlayStateStore((s) => s.dtStep)
  const setDtStep = usePlayStateStore((s) => s.setDtStep)
  const dtDone = usePlayStateStore((s) => s.dtDone)
  const toggleDtDone = usePlayStateStore((s) => s.toggleDtDone)

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

  // Phase = the most recent section label at or before the current step (the
  // guide sets `section` only on the first step of each phase).
  let phase = 'Downtime'
  for (let i = 0; i <= idx; i++) {
    const sec = steps[i]?.section
    if (sec) phase = sec
  }

  const done = dtDone[idx] ?? false
  const headerBg = guide?.guideColor ?? CRAWLER_PINK
  const tableName = STEP_ROLL_TABLE[step.name]
  const table = tableName
    ? (SalvageUnionReference.RollTables.find((t) => t.name === tableName) as
        | SURefObjectTable
        | undefined)
    : undefined

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

        {crawler && <StepGate step={step} crawler={crawler} />}

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

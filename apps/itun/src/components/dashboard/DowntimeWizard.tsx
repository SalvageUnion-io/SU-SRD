/**
 * DowntimeWizard — the guided Union Crawler Downtime loop, shown on the ONE
 * light display surface while the Dashboard is in the `'downtime'` mount state.
 * Crawler-dominant: pink chrome, and this wizard walks the 10-step Post-/Pre-
 * Session procedure.
 *
 * The 10 steps are NOT hard-coded — they are driven from the real "Crawler
 * Downtime" Guide in the reference ORM (`SalvageUnionReference.Guides`, faithful
 * SRD p.227-228), one step at a time, rendered through the reused `Content` so it
 * matches the book verbatim, with the relevant SRD roll tables via `RollTable`.
 *
 * `DowntimeWizard` binds it to ITUN's state + rules: step navigation and the
 * ephemeral per-step "Mark Complete" flag come from `playStateStore`, and the
 * read-only rules gate readout (bay status / upkeep / trading) is computed from
 * the crawler and the pure rules modules. `DowntimeWizardFrame` is the
 * presentational half. They were split across component-lib and ITUN, with
 * ITUN its only consumer; one file since the component-lib boundary audit
 * (PK-03).
 *
 * Restore WRITES (F5). The wizard used to render the guide and gates and write
 * nothing at all, so Guided Play described a rule it never applied.
 *
 * ADR-007 is satisfied without a confirm dialog here because Restore is
 * non-destructive by construction — `downtimeMechPatch` / `downtimePilotPatch`
 * only heal, repair and recharge, and both refuse to touch a Destroyed mech
 * (Downtime repairs Damaged, it never resurrects Destroyed). The explicit
 * button press IS the player's decision; there is no consequence to confirm.
 * The genuinely destructive economy steps (upkeep spend, deterioration) stay
 * out of this pass.
 */

import { Badge, Button, Content, cn, entityGuideToneColor, RollTable } from 'component-lib'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { SURefObjectGuideStep, SURefObjectTable } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { bayGate, UPKEEP_SCRAP } from '../../lib/rules/crawlerEconomy'
import {
  allDowntimeSteps,
  downtimeMechPatch,
  downtimePilotPatch,
  mechBayStatus,
  medBayStatus,
} from '../../lib/rules/downtime'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'

/** The guideType that identifies the Union Crawler Downtime procedure. */
const DOWNTIME_GUIDE_TYPE = 'downtime'

/** Fallback tone when the guide carries no `guideTone` (crawler ontology). */
const CRAWLER_TONE = 'var(--color-sheet-crawler-deep)'

/**
 * SRD roll tables associated with a Downtime step (keyed by the guide step's
 * name). The guide content describes the roll but does not link the table
 * entity, so this presentation glue resolves it for the reused RollTable.
 */
const STEP_ROLL_TABLE: Record<string, string> = {
  'Upkeep & Upgrade': 'Crawler Deterioration',
  Trade: 'Trading Bay',
}

type DowntimeWizardFrameProps = {
  /** Current step index (clamped to the guide's range). Caller-owned. */
  stepIndex: number
  onStepChange: (index: number) => void
  /** Per-step "complete" flags, keyed by step index. */
  doneMap: Record<number, boolean>
  onToggleDone: (index: number) => void
  /** App-computed read-only rules readout for a step (crawler + rules modules). */
  renderStepGate?: (step: SURefObjectGuideStep) => ReactNode
}

/**
 * The presentational half: step navigation and the per-step "Mark Complete"
 * flag are owned by the caller, and the rules gate readout is injected via
 * `renderStepGate`. Exported for the Ladle story, which drives it with the real
 * guide and local state instead of `playStateStore`.
 */
export function DowntimeWizardFrame({
  stepIndex,
  onStepChange,
  doneMap,
  onToggleDone,
  renderStepGate,
}: DowntimeWizardFrameProps) {
  const guide = SalvageUnionReference.Guides.find((g) => g.guideType === DOWNTIME_GUIDE_TYPE)
  const steps = guide?.steps ?? []
  if (steps.length === 0) {
    return <div className="pc-display-note">Downtime procedure not in the reference set.</div>
  }

  const idx = Math.min(Math.max(stepIndex, 0), steps.length - 1)
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

  const done = doneMap[idx] ?? false
  const headerBg = (guide ? entityGuideToneColor(guide) : undefined) ?? CRAWLER_TONE
  const tableName = STEP_ROLL_TABLE[step.name]
  const table = tableName
    ? (SalvageUnionReference.RollTables.getByName(tableName) as SURefObjectTable | undefined)
    : undefined

  return (
    <div className="pc-display-scroll">
      <div className="pc-dt">
        <div className="pc-dt-head">
          <Badge
            shape="stamp"
            className="px-[9px] py-[5px] text-caption text-paper"
            style={{ backgroundColor: headerBg }}
          >
            {phase}
          </Badge>
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

        {renderStepGate?.(step)}

        {table && (
          <div className="pc-dt-table">
            <RollTable table={table} tableName={tableName} size="compact" showCommand />
          </div>
        )}

        <p className="pc-dt-note">
          Guidance only — Downtime economy writes (Upkeep, Restore, Crafting) are applied on the
          live sheet.
        </p>

        <div className="pc-dt-controls">
          <Button
            size="compact"
            className="flex-1"
            onClick={() => onStepChange(idx - 1)}
            disabled={idx === 0}
          >
            ‹ Prev
          </Button>
          <Button
            size="compact"
            className={cn('flex-1', done && 'bg-status-ok')}
            onClick={() => onToggleDone(idx)}
            aria-pressed={done}
          >
            {done ? '✓ Complete' : 'Mark Complete'}
          </Button>
          <Button
            size="compact"
            className="flex-1"
            onClick={() => onStepChange(idx + 1)}
            disabled={idx === steps.length - 1}
          >
            Next ›
          </Button>
        </div>
      </div>
    </div>
  )
}

type DowntimeWizardProps = {
  crawler: Crawler | null
  /** The mech and pilot Restore acts on; absent = nothing to restore. */
  mech?: Mech | null
  pilot?: Pilot | null
  store?: typeof useEntityStore
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

export function DowntimeWizard({
  crawler,
  mech,
  pilot,
  store = useEntityStore,
}: DowntimeWizardProps) {
  const dtStep = usePlayStateStore((s) => s.dtStep)
  const setDtStep = usePlayStateStore((s) => s.setDtStep)
  const dtDone = usePlayStateStore((s) => s.dtDone)
  const toggleDtDone = usePlayStateStore((s) => s.toggleDtDone)
  const storeState = store()
  const [restored, setRestored] = useState<string | null>(null)

  /**
   * Apply the Restore step to the mech and pilot.
   *
   * Reads the FRESHEST records so a rapid second press cannot restore against a
   * stale copy, and writes each half only when the rules produced a change —
   * an empty patch would log a change that changed nothing.
   */
  function restore(): void {
    if (!crawler) return
    const steps = allDowntimeSteps()
    const crawlerTl = Number((crawler.techLevel ?? '').replace(/\D/g, '')) || 1
    const applied: string[] = []

    if (mech) {
      const fresh = storeState.get('mech', mech.id) ?? mech
      const patch = downtimeMechPatch(fresh, crawlerTl, steps, mechBayStatus(crawler))
      if (Object.keys(patch).length > 0) {
        runWrite(() => storeState.update('mech', mech.id, patch, DASHBOARD_TXN))
        applied.push(fresh.name)
      }
    }
    if (pilot) {
      const fresh = storeState.get('pilot', pilot.id) ?? pilot
      const patch = downtimePilotPatch(
        fresh,
        medBayStatus(crawler),
        steps,
        resolveEffectiveCrawlerLevel(fresh, crawler)
      )
      if (Object.keys(patch).length > 0) {
        runWrite(() => storeState.update('pilot', pilot.id, patch, DASHBOARD_TXN))
        applied.push(fresh.name)
      }
    }

    setRestored(
      applied.length > 0
        ? `Restored ${applied.join(' and ')}.`
        : 'Nothing to restore — everything is already at full.'
    )
  }

  return (
    <DowntimeWizardFrame
      stepIndex={dtStep}
      onStepChange={setDtStep}
      doneMap={dtDone}
      onToggleDone={toggleDtDone}
      renderStepGate={
        crawler
          ? (step) => (
              <>
                <StepGate step={step} crawler={crawler} />
                {step.name === 'Restore your Mech & Pilot' && (mech || pilot) ? (
                  <div className="pc-dt-gate">
                    <Button type="button" onClick={restore}>
                      Apply Restore
                    </Button>
                    {restored ? <p className="pc-dt-note">{restored}</p> : null}
                  </div>
                ) : null}
              </>
            )
          : undefined
      }
    />
  )
}

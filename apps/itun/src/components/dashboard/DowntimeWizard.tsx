/**
 * DowntimeWizard (ITUN binding) — wires the presentational DowntimeWizard in
 * component-lib to ITUN's state + rules: step navigation + the ephemeral per-step
 * "Mark Complete" flag come from `playStateStore`, and the read-only rules gate
 * readout (bay status / upkeep / trading) is computed here from the crawler and
 * the pure rules modules and injected via `renderStepGate`.
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

import { useState } from 'react'
import { Button, DowntimeWizard as DowntimeWizardView } from 'component-lib'
import type { SURefObjectGuideStep } from 'salvageunion-reference'

import { UPKEEP_SCRAP, bayGate } from '../../lib/rules/crawlerEconomy'
import {
  allDowntimeSteps,
  downtimeMechPatch,
  downtimePilotPatch,
  mechBayStatus,
  medBayStatus,
} from '../../lib/rules/downtime'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import { usePlayStateStore } from '../../stores/playStateStore'

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
        void storeState.update('mech', mech.id, patch, DASHBOARD_TXN)
        applied.push(fresh.name)
      }
    }
    if (pilot) {
      const fresh = storeState.get('pilot', pilot.id) ?? pilot
      const patch = downtimePilotPatch(fresh, medBayStatus(crawler), steps)
      if (Object.keys(patch).length > 0) {
        void storeState.update('pilot', pilot.id, patch, DASHBOARD_TXN)
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
    <DowntimeWizardView
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

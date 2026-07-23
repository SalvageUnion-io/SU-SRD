/**
 * DowntimeWizard (ITUN binding) — wires the presentational DowntimeWizard in
 * component-lib to ITUN's state + rules: step navigation + the ephemeral per-step
 * "Mark Complete" flag come from `playStateStore`, and the read-only rules gate
 * readout (bay status / upkeep / trading) is computed here from the crawler and
 * the pure rules modules and injected via `renderStepGate`.
 *
 * Read-mostly (ADR-007): the wizard shows what each step *would* do; the
 * destructive economy writes (upkeep spend, restore, crafting) are deferred to
 * the live sheet.
 */

import { DowntimeWizard as DowntimeWizardView } from 'component-lib'
import type { SURefObjectGuideStep } from 'salvageunion-reference'

import { UPKEEP_SCRAP, bayGate } from '../../lib/rules/crawlerEconomy'
import { mechBayStatus, medBayStatus } from '../../lib/rules/downtime'
import type { Crawler } from '../../lib/schemas/crawler'
import { usePlayStateStore } from '../../stores/playStateStore'

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

  return (
    <DowntimeWizardView
      stepIndex={dtStep}
      onStepChange={setDtStep}
      doneMap={dtDone}
      onToggleDone={toggleDtDone}
      renderStepGate={crawler ? (step) => <StepGate step={step} crawler={crawler} /> : undefined}
    />
  )
}

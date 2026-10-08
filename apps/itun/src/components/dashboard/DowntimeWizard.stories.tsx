import { Caption } from 'component-lib/stories/harness'
import { useState } from 'react'
import { InstrumentStage } from './_dashboardStage'
import type { ReadyPip } from './DowntimeWizard'
import { DowntimeWizardFrame } from './DowntimeWizard'

export default { title: 'Compositions/Dashboard/Downtime Wizard' }

const CREW: readonly ReadyPip[] = [
  { userId: 'u-me', name: 'Vesna', done: false },
  { userId: 'u-ash', name: 'Ash', done: true },
  { userId: 'u-bex', name: 'Bex', done: false },
]

/**
 * The guided Crawler Downtime loop, driven from the real "Crawler Downtime"
 * Guide in the ORM, at the step the Game is on. Local state stands in for the
 * Game's `downtime` row: "I'm done" fills your ready pip, and Next step (the
 * Mediator's) moves the table on. Rendered as the light "document under
 * glass" in the dark instrument stage. (The rules gate readout is
 * app-injected; omitted here.)
 */
function Wizard({ mediator }: { mediator: boolean }) {
  const [step, setStep] = useState(0)
  const [crew, setCrew] = useState(CREW)
  const mine = crew.find((c) => c.userId === 'u-me')?.done ?? false
  return (
    <InstrumentStage width={560}>
      <div
        className="pc-display-light"
        style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
      >
        <DowntimeWizardFrame
          stepIndex={step}
          ready={crew}
          doneByMe={mine}
          onDone={(done) =>
            setCrew((cs) => cs.map((c) => (c.userId === 'u-me' ? { ...c, done } : c)))
          }
          onNext={
            mediator
              ? () => {
                  setStep((s) => s + 1)
                  // Completion is per step: it clears on every advance.
                  setCrew((cs) => cs.map((c) => ({ ...c, done: false })))
                }
              : undefined
          }
        />
      </div>
    </InstrumentStage>
  )
}

/** A player: "I'm done", and the table waits for the Mediator. */
export const Player = () => (
  <div className="flex flex-col gap-4">
    <Caption>Downtime, a player — the Game's step, the ready pips, and I'm done.</Caption>
    <Wizard mediator={false} />
  </div>
)

/** The Mediator: Next step moves every member's Dashboard on. */
export const Mediator = () => (
  <div className="flex flex-col gap-4">
    <Caption>Downtime, the Mediator — Next step moves the whole table on.</Caption>
    <Wizard mediator />
  </div>
)

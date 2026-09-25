import { Caption } from 'component-lib/stories/harness'
import { useState } from 'react'
import { InstrumentStage } from './_dashboardStage'
import { DowntimeWizardFrame } from './DowntimeWizard'

export default { title: 'Compositions/Dashboard/Downtime Wizard' }

/**
 * The guided Crawler Downtime loop, driven from the real "Crawler Downtime"
 * Guide in the ORM. Prev/Next walk the steps; Mark Complete flips the per-step
 * flag. Rendered as the light "document under glass" in the dark instrument
 * stage. (The rules gate readout is app-injected; omitted here.)
 */
export const Default = () => {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<Record<number, boolean>>({})
  return (
    <div className="flex flex-col gap-4">
      <Caption>Downtime wizard — one guide step at a time, real SRD content + roll tables.</Caption>
      <InstrumentStage width={560}>
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <DowntimeWizardFrame
            stepIndex={step}
            onStepChange={setStep}
            doneMap={done}
            onToggleDone={(i) => setDone((d) => ({ ...d, [i]: !d[i] }))}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}

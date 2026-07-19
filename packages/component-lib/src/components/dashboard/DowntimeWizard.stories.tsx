import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { DowntimeWizard } from './DowntimeWizard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Compositions/Dashboard/DowntimeWizard' }

/**
 * The guided Crawler Downtime loop, driven from the real "Crawler Downtime"
 * Guide in the ORM. Prev/Next walk the steps; Mark Complete flips the per-step
 * flag. Rendered as the light "document under glass" in the dark instrument
 * stage. (The rules gate readout is app-injected; omitted here.)
 */
export const Default: Story = () => {
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
          <DowntimeWizard
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

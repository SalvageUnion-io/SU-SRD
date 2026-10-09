import type { Story } from 'component-lib/stories/harness'
import { useState } from 'react'
import { WizShell, WizTracker } from './WizShell'

export default {
  title: 'Compositions/Wizard/Wiz Shell',
}

const STEPS = ['Class', 'Callsign', 'Abilities', 'Equipment', 'Review'] as const

/**
 * The wizard skeleton — poster band,
 * connector-pipe stepper rail, optional option pane, and a sticky ink action
 * pill. Layout-only: all wizard state lives in the caller. Shown mid-build on
 * the Pilot creation flow with live budget trackers and a gate note.
 */
export const Default: Story = () => {
  const [active, setActive] = useState(2)
  return (
    <div className="-m-[var(--ladle-pad,0)]">
      <WizShell
        kind="pilot"
        eyebrow="New Pilot"
        steps={STEPS}
        active={active}
        onStepClick={setActive}
        title="Abilities"
        subtitle="Pick 3 Class Abilities to start."
        trackers={<WizTracker label="Abilities" value="2 / 3" />}
        footerNote="1 ability left to choose"
        onBack={() => setActive((i) => Math.max(0, i - 1))}
        onNext={() => setActive((i) => Math.min(STEPS.length - 1, i + 1))}
        onCancel={() => {}}
        submitLabel="Create Pilot ✦"
      >
        <p className="font-body text-sm text-wk-muted">
          Choose from your Class's ability list. Each ability defines what your Pilot can do outside
          the cockpit.
        </p>
      </WizShell>
    </div>
  )
}

/* Ported from packages/component-lib/src/components/shared/WizShell.stories.tsx. */
import { WizShell, WizTracker } from 'component-lib'

const STEPS = ['Class', 'Callsign', 'Abilities', 'Equipment', 'Review']

/**
 * The shared wizard skeleton — poster band, connector-pipe stepper rail,
 * optional option pane, and a sticky ink action pill. Layout-only: all wizard
 * state lives in the caller. Shown mid-build on the Pilot creation flow with a
 * live budget tracker and a gate note.
 */
export function PilotFlow() {
  return (
    <WizShell
      kind="pilot"
      eyebrow="New Pilot"
      steps={STEPS}
      active={2}
      onStepClick={() => {}}
      title="Abilities"
      subtitle="Pick 3 Class Abilities to start."
      trackers={<WizTracker label="Abilities" value="2 / 3" />}
      footerNote="1 ability left to choose"
      onBack={() => {}}
      onNext={() => {}}
      onCancel={() => {}}
      submitLabel="Create Pilot ✦"
    >
      <p className="font-body text-sm text-wk-muted">
        Choose from your Class&rsquo;s ability list. Each ability defines what your Pilot can do
        outside the cockpit.
      </p>
    </WizShell>
  )
}

/** The mech flow — `kind` re-tones the whole shell. */
export function MechFlow() {
  return (
    <WizShell
      kind="mech"
      eyebrow="New Mech"
      steps={['Chassis', 'Pattern', 'Systems', 'Flavour', 'Review']}
      active={0}
      onStepClick={() => {}}
      title="Chassis"
      subtitle="Every Mech starts from a Chassis."
      trackers={<WizTracker label="Slots" value="0 / 6" />}
      onBack={() => {}}
      onNext={() => {}}
      onCancel={() => {}}
      submitLabel="Create Mech ✦"
    >
      <p className="font-body text-sm text-wk-muted">
        Pick the frame you will build on. Systems and Modules are fitted to its slots in a later
        step.
      </p>
    </WizShell>
  )
}

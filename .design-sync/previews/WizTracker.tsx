/*
 * Composed from the WizShell story, which is the only place `WizTracker`
 * appears — it ships from `./WizShell` as that shell's budget readout and has no
 * story file of its own. Shown standalone here plus in its real slot.
 */
import { WizShell, WizTracker } from 'component-lib'
import { Group, Row, Stack } from '../preview-lib/harness'

/** The budget readout a wizard step puts in the shell's tracker slot. */
export function Readouts() {
  return (
    <div className="sheet--pilot flex flex-col gap-6 bg-paper p-4">
      <Group caption="a count against an allowance">
        <Row>
          <WizTracker label="Abilities" value="2 / 3" />
          <WizTracker label="Equipment" value="1 / 3" />
          <WizTracker label="Slots" value="4 / 6" />
        </Row>
      </Group>
      <Group caption="complete, and not yet started">
        <Row>
          <WizTracker label="Abilities" value="3 / 3" />
          <WizTracker label="Scrap" value="0 / 5" />
        </Row>
      </Group>
    </div>
  )
}

/** In its real slot — the shell's poster band. */
export function InShell() {
  return (
    <WizShell
      kind="pilot"
      eyebrow="New Pilot"
      steps={['Class', 'Callsign', 'Abilities', 'Equipment', 'Review']}
      active={3}
      onStepClick={() => {}}
      title="Equipment"
      subtitle="Take up to 3 pieces of starting Equipment."
      trackers={
        <>
          <WizTracker label="Abilities" value="3 / 3" />
          <WizTracker label="Equipment" value="1 / 3" />
        </>
      }
      footerNote="2 picks left"
      onBack={() => {}}
      onNext={() => {}}
      onCancel={() => {}}
      submitLabel="Create Pilot ✦"
    >
      <p className="font-body text-sm text-wk-muted">
        Two trackers side by side — one satisfied, one still open.
      </p>
    </WizShell>
  )
}

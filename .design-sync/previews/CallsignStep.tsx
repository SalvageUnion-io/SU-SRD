/* Ported from packages/component-lib/src/components/wizard/CallsignStep.stories.tsx. */
import { CallsignStep } from 'component-lib'
import { Group, Stack } from '../preview-lib/harness'

/** The pilot's name + callsign step, with a roll affordance on each field. */
export function EmptyAndFilled() {
  return (
    <div className="sheet--pilot flex flex-col gap-8 bg-paper p-4">
      <Group caption="empty — both fields awaiting input or a roll">
        <CallsignStep name="" callsign="" onChange={() => {}} />
      </Group>
      <Group caption="filled — a rolled pilot identity">
        <CallsignStep name="Vasquez" callsign="Ratchet" onChange={() => {}} />
      </Group>
    </div>
  )
}

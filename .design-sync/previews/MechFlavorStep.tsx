/* Ported from packages/component-lib/src/components/wizard/MechFlavorStep.stories.tsx. */
import { MechFlavorStep } from 'component-lib'
import { Group } from '../preview-lib/harness'

/** A mech flavour field with its roll-on-the-table affordance. */
export function Appearance() {
  return (
    <div className="sheet--mech flex flex-col gap-8 bg-paper p-4">
      <Group caption="multiline, empty">
        <MechFlavorStep
          field="appearance"
          label="Appearance"
          value=""
          onChange={() => {}}
          placeholder="What does the Mech look like?"
          multiline
        />
      </Group>
      <Group caption="multiline, filled">
        <MechFlavorStep
          field="appearance"
          label="Appearance"
          value="Sun-bleached hauler plating over a patchwork of scavenged corpo armour, one arm still bearing an Opus Institute stencil."
          onChange={() => {}}
          placeholder="What does the Mech look like?"
          multiline
        />
      </Group>
    </div>
  )
}

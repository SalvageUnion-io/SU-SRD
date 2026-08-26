/*
 * Ported from packages/component-lib/src/components/wizard/FlavorStep.stories.tsx.
 * The story's standalone `RollTableButton` cluster is dropped — that component
 * is not part of the public surface, so it has no card of its own.
 */
import { FlavorStep } from 'component-lib'
import { Group } from '../preview-lib/harness'

/** A free-text pilot flavour field with its "roll on the table" affordance. */
export function Motto() {
  return (
    <div className="sheet--pilot flex flex-col gap-8 bg-paper p-4">
      <Group caption="empty — the roll affordance is the way in">
        <FlavorStep
          field="motto"
          label="Motto"
          value=""
          onChange={() => {}}
          placeholder="What does your Pilot live by?"
        />
      </Group>
      <Group caption="filled">
        <FlavorStep
          field="motto"
          label="Motto"
          value="No retreat, no surrender."
          onChange={() => {}}
          placeholder="What does your Pilot live by?"
        />
      </Group>
    </div>
  )
}

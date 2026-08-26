/* Ported from packages/component-lib/src/components/wizard/BackgroundStep.stories.tsx. */
import { BackgroundStep } from 'component-lib'
import { Group } from '../preview-lib/harness'

/**
 * The short Background archetype (roll-table driven) plus the freeform bio
 * textarea beneath it.
 */
export function EmptyAndFilled() {
  return (
    <div className="sheet--pilot flex flex-col gap-8 bg-paper p-4">
      <Group caption="empty — awaiting a rolled background or a written bio">
        <BackgroundStep
          background=""
          onChange={() => {}}
          description=""
          onDescriptionChange={() => {}}
        />
      </Group>
      <Group caption="filled — a rolled archetype with a written bio">
        <BackgroundStep
          background="Salvager"
          onChange={() => {}}
          description="Cut her teeth stripping hulks in the Rustbelt before the Union came calling."
          onDescriptionChange={() => {}}
        />
      </Group>
    </div>
  )
}

import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { BackgroundStep } from './BackgroundStep'

export default {
  title: 'Compositions/Wizard/Background Step',
}

/**
 * Background step — the short Background archetype (roll-table driven) plus the
 * freeform bio Textarea beneath it. Split out of the former "Pilot Identity
 * Steps" gallery so it has a sidebar entry of its own.
 */
export const Default: Story = () => {
  const [background, setBackground] = useState('')
  const [description, setDescription] = useState('')
  return (
    <div className="sheet--pilot flex flex-col gap-8 p-4">
      <div>
        <Caption>empty — awaiting a rolled background or a written bio</Caption>
        <BackgroundStep
          background={background}
          onChange={setBackground}
          description={description}
          onDescriptionChange={setDescription}
        />
      </div>
      <div>
        <Caption>filled — a rolled archetype with a written bio</Caption>
        <BackgroundStep
          background="Salvager"
          onChange={() => {}}
          description="Cut her teeth stripping hulks in the Rustbelt before the Union came calling."
          onDescriptionChange={() => {}}
        />
      </div>
    </div>
  )
}

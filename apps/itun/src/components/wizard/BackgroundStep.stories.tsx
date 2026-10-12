import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { BackgroundStep } from './BackgroundStep'

const FRAME: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
  padding: tokens.space[16],
}

export default {
  title: 'Compositions/Wizard/Background Step',
}

/**
 * Background step — the short Background archetype (roll-table driven) plus the
 * freeform bio Textarea beneath it, with a sidebar entry of its own.
 */
export const Default = () => {
  const [background, setBackground] = useState('')
  const [description, setDescription] = useState('')
  return (
    <div className="sheet--pilot" style={FRAME}>
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

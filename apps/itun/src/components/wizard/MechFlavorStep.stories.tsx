import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { MechFlavorStep } from './MechFlavorStep'

const FRAME: CSSProperties = { backgroundColor: tokens.color.paper, padding: tokens.space[16] }

export default {
  title: 'Compositions/Mech Flavor Step',
}

/** A mech flavour field with its roll-on-the-table affordance. */
export const Default = () => {
  const [appearance, setAppearance] = useState('')
  return (
    <div className="sheet--mech" style={FRAME}>
      <Caption>MechFlavorStep — appearance</Caption>
      <MechFlavorStep
        field="appearance"
        label="Appearance"
        value={appearance}
        onChange={setAppearance}
        placeholder="What does the Mech look like?"
        multiline
      />
    </div>
  )
}

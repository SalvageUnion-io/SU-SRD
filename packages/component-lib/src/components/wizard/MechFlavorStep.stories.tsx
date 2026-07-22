import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { MechFlavorStep } from './MechFlavorStep'

export default {
  title: 'Compositions/Mech Flavor Step',
}

/** A mech flavour field with its roll-on-the-table affordance. */
export const Default: Story = () => {
  const [appearance, setAppearance] = useState('')
  return (
    <div className="sheet--mech bg-paper p-4">
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

import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { BackgroundStep } from './BackgroundStep'
import { CallsignStep } from './CallsignStep'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Pilot Identity Steps',
}

/** The pilot's name/callsign and background steps, each with roll affordances. */
export const Default: Story = () => {
  const [name, setName] = useState('')
  const [callsign, setCallsign] = useState('')
  const [background, setBackground] = useState('')
  const [description, setDescription] = useState('')
  return (
    <div className="sheet--pilot flex flex-col gap-8 bg-paper p-4">
      <div>
        <Caption>CallsignStep</Caption>
        <CallsignStep
          name={name}
          callsign={callsign}
          onChange={(field, value) => (field === 'name' ? setName(value) : setCallsign(value))}
        />
      </div>
      <div>
        <Caption>BackgroundStep</Caption>
        <BackgroundStep
          background={background}
          onChange={setBackground}
          description={description}
          onDescriptionChange={setDescription}
        />
      </div>
    </div>
  )
}

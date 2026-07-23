import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { CallsignStep } from './CallsignStep'

export default {
  title: 'Compositions/Wizard/Callsign Step',
}

/** The pilot's name + callsign step, with its roll affordances on each field. */
export const Default: Story = () => {
  const [name, setName] = useState('')
  const [callsign, setCallsign] = useState('')
  return (
    <div className="sheet--pilot flex flex-col gap-8 p-4">
      <div>
        <Caption>empty — both fields awaiting input or a roll</Caption>
        <CallsignStep
          name={name}
          callsign={callsign}
          onChange={(field, value) => (field === 'name' ? setName(value) : setCallsign(value))}
        />
      </div>
      <div>
        <Caption>filled — a rolled pilot identity</Caption>
        <CallsignStep name="Vasquez" callsign="Ratchet" onChange={() => {}} />
      </div>
    </div>
  )
}
